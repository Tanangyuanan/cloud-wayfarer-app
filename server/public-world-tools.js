"use strict";

const satellite = require("satellite.js");
const { resolveLocation } = require("./locations");

const caches = new Map();
const tokenCache = { value: null, expiresAt: 0 };
const AU_KM = 149_597_870.7;
const EARTH_RADIUS_KM = 6378.137;

const CACHE_TTL = {
  elevation: 30 * 24 * 60 * 60 * 1000,
  history: 7 * 24 * 60 * 60 * 1000,
  flood: 6 * 60 * 60 * 1000,
  gbif: 6 * 60 * 60 * 1000,
  inaturalist: 60 * 60 * 1000,
  earthquakes: 15 * 60 * 1000,
  fires: 30 * 60 * 1000,
  orbital: 6 * 60 * 60 * 1000,
  aviation: 10 * 60 * 1000
};

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchResponse(url, options = {}, timeoutMs = 8000) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response;
  } finally {
    timeout.clear();
  }
}

async function fetchJson(url, options, timeoutMs) {
  return (await fetchResponse(url, options, timeoutMs)).json();
}

async function fetchText(url, options, timeoutMs) {
  return (await fetchResponse(url, options, timeoutMs)).text();
}

function cacheKey(source, locationId, extra = "") {
  return `${source}:${locationId}:${extra}`;
}

async function cached(source, key, task) {
  const id = cacheKey(source, key);
  const hit = caches.get(id);
  if (hit && Date.now() - hit.storedAt < CACHE_TTL[source]) return { ...hit.value, cache: "hit" };
  const value = await task();
  if (value.available) caches.set(id, { storedAt: Date.now(), value });
  return value;
}

function unavailable(tool, location, reason, error = null) {
  return {
    tool,
    available: false,
    location: location.name,
    reason,
    fetchedAt: new Date().toISOString(),
    ...(error ? { detail: String(error.status || error.code || error.message || "upstream_error").slice(0, 80) } : {})
  };
}

function failure(tool, location, error) {
  const reason = error?.name === "AbortError" ? "timeout"
    : error?.status === 429 ? "rate_limited"
      : error?.status === 401 || error?.status === 403 ? "unauthorized"
        : "upstream_error";
  return unavailable(tool, location, reason, error);
}

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86_400_000);
}

function round(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function mean(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function percentile(values, p) {
  const valid = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!valid.length) return null;
  const index = (valid.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return valid[lower] + (valid[upper] - valid[lower]) * (index - lower);
}

function longitudeDelta(latitude, radiusKm) {
  return radiusKm / Math.max(20, 111.32 * Math.cos(latitude * Math.PI / 180));
}

function boundingBox(location, radiusKm) {
  const latDelta = radiusKm / 110.574;
  const lonDelta = longitudeDelta(location.latitude, radiusKm);
  return {
    south: round(location.latitude - latDelta, 4),
    west: round(location.longitude - lonDelta, 4),
    north: round(location.latitude + latDelta, 4),
    east: round(location.longitude + lonDelta, 4)
  };
}

function source(title, url) {
  return { title, url };
}

async function getElevation(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.elevationEnabled) return unavailable("elevation", location, "disabled");
  return cached("elevation", location.id, async () => {
    const params = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude) });
    try {
      const data = await fetchJson(`https://api.open-meteo.com/v1/elevation?${params}`, {}, config.publicWorld.timeoutMs);
      return {
        tool: "elevation", available: true, location: location.name,
        elevationM: round(data.elevation?.[0], 0), fetchedAt: new Date().toISOString(),
        source: source("Open-Meteo Elevation API / Copernicus DEM", "https://open-meteo.com/en/docs/elevation-api")
      };
    } catch (error) { return failure("elevation", location, error); }
  });
}

function sameSeasonWindow(date, candidate) {
  const target = Date.UTC(2000, date.getUTCMonth(), date.getUTCDate());
  const sample = Date.UTC(2000, candidate.getUTCMonth(), candidate.getUTCDate());
  const days = Math.abs(sample - target) / 86_400_000;
  return Math.min(days, 366 - days) <= 7;
}

async function getHistoricalWeather(locationId, config, observedAt = new Date()) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.historyEnabled) return unavailable("historical_weather", location, "disabled");
  const current = new Date(observedAt);
  const endYear = current.getUTCFullYear() - 1;
  const startYear = endYear - config.publicWorld.historyYears + 1;
  const rangeKey = `${current.getUTCMonth() + 1}-${current.getUTCDate()}-${startYear}-${endYear}`;
  return cached("history", `${location.id}:${rangeKey}`, async () => {
    const startDate = new Date(Date.UTC(startYear, Math.max(0, current.getUTCMonth() - 1), 1));
    const endDate = new Date(Date.UTC(endYear, Math.min(11, current.getUTCMonth() + 1) + 1, 0));
    const params = new URLSearchParams({
      latitude: String(location.latitude), longitude: String(location.longitude),
      start_date: ymd(startDate), end_date: ymd(endDate), timezone: location.timezone,
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum"
    });
    try {
      const data = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${params}`, {}, config.publicWorld.slowTimeoutMs);
      const daily = data.daily || {};
      const rows = (daily.time || []).map((date, index) => ({
        date,
        maxTemperatureC: daily.temperature_2m_max?.[index],
        minTemperatureC: daily.temperature_2m_min?.[index],
        precipitationMm: daily.precipitation_sum?.[index]
      })).filter((row) => sameSeasonWindow(current, new Date(`${row.date}T00:00:00Z`)));
      return {
        tool: "historical_weather", available: true, location: location.name,
        baselineYears: [startYear, endYear], sampleDays: rows.length,
        normalMaxTemperatureC: round(mean(rows.map((row) => row.maxTemperatureC))),
        normalMinTemperatureC: round(mean(rows.map((row) => row.minTemperatureC))),
        normalPrecipitationMm: round(mean(rows.map((row) => row.precipitationMm))),
        precipitationP90Mm: round(percentile(rows.map((row) => row.precipitationMm), 0.9)),
        precipitationP95Mm: round(percentile(rows.map((row) => row.precipitationMm), 0.95)),
        fetchedAt: new Date().toISOString(),
        source: source("Open-Meteo Historical Weather API", "https://open-meteo.com/en/docs/historical-weather-api")
      };
    } catch (error) { return failure("historical_weather", location, error); }
  });
}

async function getFlood(locationId, config, observedAt = new Date()) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.floodEnabled) return unavailable("flood", location, "disabled");
  return cached("flood", location.id, async () => {
    const params = new URLSearchParams({
      latitude: String(location.latitude), longitude: String(location.longitude),
      daily: "river_discharge,river_discharge_mean,river_discharge_max",
      past_days: "7", forecast_days: "7"
    });
    try {
      const data = await fetchJson(`https://flood-api.open-meteo.com/v1/flood?${params}`, {}, config.publicWorld.slowTimeoutMs);
      const daily = data.daily || {};
      const today = ymd(new Date(observedAt));
      const currentIndex = Math.max(0, (daily.time || []).findIndex((date) => date >= today));
      const discharge = daily.river_discharge || [];
      const forecast = discharge.slice(currentIndex, currentIndex + 7).map(Number).filter(Number.isFinite);
      const previous = Number(discharge[Math.max(0, currentIndex - 7)]);
      const current = Number(discharge[currentIndex]);
      return {
        tool: "flood", available: true, location: location.name,
        gridLatitude: data.latitude, gridLongitude: data.longitude,
        currentDischargeM3s: round(current),
        sevenDayAgoDischargeM3s: round(previous),
        sevenDayForecastMaxM3s: forecast.length ? round(Math.max(...forecast)) : null,
        sevenDayChangePercent: Number.isFinite(current) && Number.isFinite(previous) && previous > 0 ? round((current - previous) / previous * 100) : null,
        forecast: (daily.time || []).slice(currentIndex, currentIndex + 7).map((date, index) => ({ date, dischargeM3s: round(discharge[currentIndex + index]) })),
        fetchedAt: new Date().toISOString(),
        source: source("Open-Meteo Flood API / GloFAS", "https://open-meteo.com/en/docs/flood-api")
      };
    } catch (error) { return failure("flood", location, error); }
  });
}

async function getGbifOccurrences(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.gbifEnabled) return unavailable("gbif_occurrences", location, "disabled");
  return cached("gbif", location.id, async () => {
    const box = boundingBox(location, config.publicWorld.biodiversityRadiusKm);
    const params = new URLSearchParams({
      decimalLatitude: `${box.south},${box.north}`,
      decimalLongitude: `${box.west},${box.east}`,
      hasCoordinate: "true", hasGeospatialIssue: "false", occurrenceStatus: "PRESENT", limit: "30"
    });
    try {
      const data = await fetchJson(`https://api.gbif.org/v1/occurrence/search?${params}`, {}, config.publicWorld.timeoutMs);
      const records = (data.results || []).map((item) => ({
        id: item.key,
        name: item.vernacularName || item.species || item.scientificName || null,
        scientificName: item.scientificName || null,
        eventDate: item.eventDate || item.lastInterpreted || null,
        latitude: item.decimalLatitude,
        longitude: item.decimalLongitude,
        basisOfRecord: item.basisOfRecord,
        datasetTitle: item.datasetTitle || null
      })).sort((a, b) => Date.parse(b.eventDate || 0) - Date.parse(a.eventDate || 0)).slice(0, 12);
      return {
        tool: "gbif_occurrences", available: true, location: location.name,
        radiusKmApprox: config.publicWorld.biodiversityRadiusKm,
        totalInBoundingBox: data.count || 0, records,
        fetchedAt: new Date().toISOString(),
        source: source("GBIF Occurrence API", "https://techdocs.gbif.org/en/openapi/")
      };
    } catch (error) { return failure("gbif_occurrences", location, error); }
  });
}

async function getINaturalistObservations(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.inaturalistEnabled) return unavailable("inaturalist_observations", location, "disabled");
  return cached("inaturalist", location.id, async () => {
    const params = new URLSearchParams({
      lat: String(location.latitude), lng: String(location.longitude),
      radius: String(config.publicWorld.biodiversityRadiusKm),
      order_by: "observed_on", order: "desc", per_page: "20"
    });
    try {
      const data = await fetchJson(`https://api.inaturalist.org/v1/observations?${params}`, {
        headers: { "user-agent": "CloudWayfarerCloudJourney/1.0 (local prototype)" }
      }, config.publicWorld.timeoutMs);
      const records = (data.results || []).map((item) => ({
        id: item.id,
        name: item.taxon?.preferred_common_name || item.taxon?.name || null,
        scientificName: item.taxon?.name || null,
        observedOn: item.observed_on || item.time_observed_at || null,
        qualityGrade: item.quality_grade || null,
        placeGuess: item.place_guess || null,
        geoprivacy: item.geoprivacy || null,
        url: item.uri || `https://www.inaturalist.org/observations/${item.id}`
      })).slice(0, 12);
      return {
        tool: "inaturalist_observations", available: true, location: location.name,
        radiusKm: config.publicWorld.biodiversityRadiusKm,
        total: data.total_results || records.length, records,
        fetchedAt: new Date().toISOString(),
        source: source("iNaturalist Observations API", "https://api.inaturalist.org/v1/docs/")
      };
    } catch (error) { return failure("inaturalist_observations", location, error); }
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function getEarthquakes(locationId, config, observedAt = new Date()) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.earthquakeEnabled) return unavailable("earthquakes", location, "disabled");
  return cached("earthquakes", location.id, async () => {
    const params = new URLSearchParams({
      format: "geojson", latitude: String(location.latitude), longitude: String(location.longitude),
      maxradiuskm: String(config.publicWorld.earthquakeRadiusKm),
      starttime: addDays(new Date(observedAt), -7).toISOString(),
      endtime: new Date(observedAt).toISOString(), orderby: "magnitude", limit: "30", eventtype: "earthquake"
    });
    try {
      const data = await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`, {
        headers: { "user-agent": "CloudWayfarerCloudJourney/1.0 (local prototype)" }
      }, config.publicWorld.timeoutMs);
      const events = (data.features || []).map((feature) => ({
        id: feature.id,
        magnitude: feature.properties?.mag,
        place: feature.properties?.place || null,
        occurredAt: feature.properties?.time ? new Date(feature.properties.time).toISOString() : null,
        depthKm: feature.geometry?.coordinates?.[2] ?? null,
        latitude: feature.geometry?.coordinates?.[1] ?? null,
        longitude: feature.geometry?.coordinates?.[0] ?? null,
        distanceKm: round(haversineKm(location.latitude, location.longitude, feature.geometry?.coordinates?.[1], feature.geometry?.coordinates?.[0])),
        url: feature.properties?.url || null
      }));
      return {
        tool: "earthquakes", available: true, location: location.name,
        radiusKm: config.publicWorld.earthquakeRadiusKm, lookbackDays: 7, events,
        fetchedAt: new Date().toISOString(),
        source: source("USGS Earthquake Event API", "https://earthquake.usgs.gov/fdsnws/event/1/")
      };
    } catch (error) { return failure("earthquakes", location, error); }
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
    } else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

async function getActiveFires(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.firmsEnabled) return unavailable("active_fires", location, "disabled");
  if (!config.publicWorld.firmsMapKey) return unavailable("active_fires", location, "missing_map_key");
  return cached("fires", location.id, async () => {
    const box = boundingBox(location, config.publicWorld.fireRadiusKm);
    const area = `${box.west},${box.south},${box.east},${box.north}`;
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(config.publicWorld.firmsMapKey)}/VIIRS_SNPP_NRT/${area}/2`;
    try {
      const rows = parseCsv(await fetchText(url, {}, config.publicWorld.timeoutMs));
      const detections = rows.map((item) => ({
        latitude: Number(item.latitude), longitude: Number(item.longitude),
        acquiredAt: item.acq_date && item.acq_time ? `${item.acq_date}T${String(item.acq_time).padStart(4, "0").slice(0, 2)}:${String(item.acq_time).padStart(4, "0").slice(2)}:00Z` : null,
        confidence: item.confidence || null, brightTi4K: round(item.bright_ti4), frpMw: round(item.frp), satellite: item.satellite || null
      })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      return {
        tool: "active_fires", available: true, location: location.name,
        radiusKmApprox: config.publicWorld.fireRadiusKm, detections,
        fetchedAt: new Date().toISOString(),
        source: source("NASA FIRMS Active Fire API", "https://firms.modaps.eosdis.nasa.gov/web-services/")
      };
    } catch (error) { return failure("active_fires", location, error); }
  });
}

function vectorMagnitude(vector) {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

function satelliteIsSunlit(positionEci, date) {
  const sunAu = satellite.sunPos(satellite.jday(date)).rsun;
  const sun = { x: sunAu[0] * AU_KM, y: sunAu[1] * AU_KM, z: sunAu[2] * AU_KM };
  const toEarth = { x: -positionEci.x, y: -positionEci.y, z: -positionEci.z };
  const toSun = { x: sun.x - positionEci.x, y: sun.y - positionEci.y, z: sun.z - positionEci.z };
  const cosine = (toEarth.x * toSun.x + toEarth.y * toSun.y + toEarth.z * toSun.z) / (vectorMagnitude(toEarth) * vectorMagnitude(toSun));
  const separation = Math.acos(Math.max(-1, Math.min(1, cosine)));
  const earthAngularRadius = Math.asin(EARTH_RADIUS_KM / vectorMagnitude(toEarth));
  return separation > earthAngularRadius;
}

function lookAngles(satrec, location, date) {
  const state = satellite.propagate(satrec, date);
  if (!state.position || typeof state.position === "boolean") return null;
  const gmst = satellite.gstime(date);
  const observer = {
    longitude: satellite.degreesToRadians(location.longitude),
    latitude: satellite.degreesToRadians(location.latitude),
    height: Math.max(0, Number(location.elevationM || 0)) / 1000
  };
  const look = satellite.ecfToLookAngles(observer, satellite.eciToEcf(state.position, gmst));
  const sunAu = satellite.sunPos(satellite.jday(date)).rsun;
  const sunEci = { x: sunAu[0] * AU_KM, y: sunAu[1] * AU_KM, z: sunAu[2] * AU_KM };
  const sunLook = satellite.ecfToLookAngles(observer, satellite.eciToEcf(sunEci, gmst));
  return {
    elevationDeg: satellite.radiansToDegrees(look.elevation),
    azimuthDeg: satellite.radiansToDegrees(look.azimuth),
    groundSunElevationDeg: satellite.radiansToDegrees(sunLook.elevation),
    sunlit: satelliteIsSunlit(state.position, date)
  };
}

function calculatePasses(tle1, tle2, location, startDate, hours = 24) {
  const satrec = satellite.twoline2satrec(tle1, tle2);
  const passes = [];
  let active = null;
  for (let minute = 0; minute <= hours * 60; minute += 1) {
    const date = new Date(startDate.getTime() + minute * 60_000);
    const look = lookAngles(satrec, location, date);
    const above = look && look.elevationDeg >= 10;
    if (above && !active) active = { startAt: date.toISOString(), maxAt: date.toISOString(), endAt: date.toISOString(), maxElevationDeg: look.elevationDeg, visible: false };
    if (above && active) {
      active.endAt = date.toISOString();
      if (look.elevationDeg > active.maxElevationDeg) {
        active.maxElevationDeg = look.elevationDeg;
        active.maxAt = date.toISOString();
      }
      if (look.groundSunElevationDeg <= -6 && look.sunlit) active.visible = true;
    }
    if (!above && active) {
      active.maxElevationDeg = round(active.maxElevationDeg);
      passes.push(active);
      active = null;
    }
  }
  if (active) { active.maxElevationDeg = round(active.maxElevationDeg); passes.push(active); }
  return passes;
}

async function getOrbitalPasses(locationId, config, observedAt = new Date(), elevationM = 0) {
  const location = { ...resolveLocation(locationId), elevationM };
  if (!config?.publicWorld?.enabled || !config.publicWorld.orbitalEnabled) return unavailable("orbital_passes", location, "disabled");
  const cacheDate = ymd(new Date(observedAt));
  return cached("orbital", `${location.id}:${cacheDate}`, async () => {
    try {
      let tle1;
      let tle2;
      let provider = "celestrak_direct";
      try {
        const text = await fetchText("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE", {
          headers: { "user-agent": "CloudWayfarerCloudJourney/1.0 (local prototype)" }
        }, Math.min(5000, config.publicWorld.timeoutMs));
        const lines = text.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        tle1 = lines.find((line) => line.startsWith("1 "));
        tle2 = lines.find((line) => line.startsWith("2 "));
      } catch {
        const mirror = await fetchJson("https://tle.ivanstanojevic.me/api/tle/25544", {
          headers: { "user-agent": "CloudWayfarerCloudJourney/1.0 (local prototype)" }
        }, config.publicWorld.timeoutMs);
        tle1 = mirror.line1;
        tle2 = mirror.line2;
        provider = "tle_api_celestrak_mirror";
      }
      if (!tle1 || !tle2) throw new Error("invalid_tle");
      const passes = calculatePasses(tle1, tle2, location, new Date(observedAt), 24);
      return {
        tool: "orbital_passes", available: true, location: location.name,
        object: "国际空间站 ISS", catalogNumber: "25544",
        elementEpoch: tle1.slice(18, 32).trim(), provider, passes,
        nextVisiblePass: passes.find((pass) => pass.visible) || null,
        fetchedAt: new Date().toISOString(),
        source: source("CelesTrak GP Data", "https://celestrak.org/NORAD/documentation/gp-data-formats.php")
      };
    } catch (error) { return failure("orbital_passes", location, error); }
  });
}

async function getOpenSkyToken(config) {
  if (!config.publicWorld.openSkyClientId || !config.publicWorld.openSkyClientSecret) return null;
  if (tokenCache.value && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.publicWorld.openSkyClientId,
    client_secret: config.publicWorld.openSkyClientSecret
  });
  const data = await fetchJson("https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString()
  }, config.publicWorld.timeoutMs);
  tokenCache.value = data.access_token;
  tokenCache.expiresAt = Date.now() + Math.max(60, Number(data.expires_in || 1800) - 60) * 1000;
  return tokenCache.value;
}

async function getAircraftStates(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.publicWorld?.enabled || !config.publicWorld.aviationEnabled) return unavailable("aircraft_states", location, "disabled");
  return cached("aviation", location.id, async () => {
    const box = boundingBox(location, config.publicWorld.aviationRadiusKm);
    const params = new URLSearchParams({ lamin: String(box.south), lomin: String(box.west), lamax: String(box.north), lomax: String(box.east), extended: "1" });
    try {
      const token = await getOpenSkyToken(config);
      const data = await fetchJson(`https://opensky-network.org/api/states/all?${params}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      }, config.publicWorld.timeoutMs);
      const aircraft = (data.states || []).map((item) => ({
        icao24: item[0], callsign: String(item[1] || "").trim() || null,
        originCountry: item[2] || null, longitude: item[5], latitude: item[6],
        barometricAltitudeM: item[7], onGround: item[8], velocityMs: item[9], headingDeg: item[10],
        verticalRateMs: item[11], geometricAltitudeM: item[13], category: item[17] ?? null
      })).filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
      return {
        tool: "aircraft_states", available: true, location: location.name,
        radiusKmApprox: config.publicWorld.aviationRadiusKm,
        observedAt: data.time ? new Date(data.time * 1000).toISOString() : null,
        aircraft, authenticated: Boolean(token), fetchedAt: new Date().toISOString(),
        source: source("OpenSky Network Live API", "https://openskynetwork.github.io/opensky-api/")
      };
    } catch (error) { return failure("aircraft_states", location, error); }
  });
}

async function getPublicWorldData(locationId, config, observedAt = new Date(), elevationM = 0) {
  const tasks = {
    elevation: getElevation(locationId, config),
    history: getHistoricalWeather(locationId, config, observedAt),
    flood: getFlood(locationId, config, observedAt),
    gbif: getGbifOccurrences(locationId, config),
    inaturalist: getINaturalistObservations(locationId, config),
    earthquakes: getEarthquakes(locationId, config, observedAt),
    fires: getActiveFires(locationId, config),
    orbital: getOrbitalPasses(locationId, config, observedAt, elevationM),
    aviation: getAircraftStates(locationId, config)
  };
  const entries = await Promise.all(Object.entries(tasks).map(async ([key, promise]) => [key, await promise]));
  return Object.fromEntries(entries);
}

function clearPublicWorldCaches() {
  caches.clear();
  tokenCache.value = null;
  tokenCache.expiresAt = 0;
}

function publicWorldCapabilitySummary(config) {
  const world = config?.publicWorld || {};
  return {
    enabled: Boolean(world.enabled),
    sources: {
      elevation: { enabled: Boolean(world.enabled && world.elevationEnabled), auth: "none" },
      history: { enabled: Boolean(world.enabled && world.historyEnabled), auth: "none" },
      flood: { enabled: Boolean(world.enabled && world.floodEnabled), auth: "none" },
      gbif: { enabled: Boolean(world.enabled && world.gbifEnabled), auth: "none" },
      inaturalist: { enabled: Boolean(world.enabled && world.inaturalistEnabled), auth: "none" },
      earthquakes: { enabled: Boolean(world.enabled && world.earthquakeEnabled), auth: "none" },
      firms: { enabled: Boolean(world.enabled && world.firmsEnabled), configured: Boolean(world.firmsMapKey), auth: "map_key" },
      orbital: { enabled: Boolean(world.enabled && world.orbitalEnabled), auth: "none" },
      aviation: {
        enabled: Boolean(world.enabled && world.aviationEnabled),
        authenticated: Boolean(world.openSkyClientId && world.openSkyClientSecret),
        auth: "optional_oauth"
      }
    }
  };
}

module.exports = {
  getElevation,
  getHistoricalWeather,
  getFlood,
  getGbifOccurrences,
  getINaturalistObservations,
  getEarthquakes,
  getActiveFires,
  getOrbitalPasses,
  getAircraftStates,
  getPublicWorldData,
  calculatePasses,
  parseCsv,
  clearPublicWorldCaches,
  publicWorldCapabilitySummary
};
