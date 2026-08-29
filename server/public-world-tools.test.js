"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  getPublicWorldData,
  getActiveFires,
  getOrbitalPasses,
  parseCsv,
  clearPublicWorldCaches,
  publicWorldCapabilitySummary
} = require("./public-world-tools");

function config(overrides = {}) {
  return {
    publicWorld: {
      enabled: true,
      timeoutMs: 1000,
      slowTimeoutMs: 1000,
      elevationEnabled: true,
      historyEnabled: true,
      historyYears: 5,
      floodEnabled: true,
      gbifEnabled: true,
      inaturalistEnabled: true,
      biodiversityRadiusKm: 25,
      earthquakeEnabled: true,
      earthquakeRadiusKm: 300,
      firmsEnabled: true,
      firmsMapKey: "test-firms-key",
      fireRadiusKm: 100,
      orbitalEnabled: true,
      aviationEnabled: true,
      aviationRadiusKm: 100,
      openSkyClientId: "",
      openSkyClientSecret: "",
      ...overrides
    }
  };
}

function response(value, kind = "json") {
  return {
    ok: true,
    status: 200,
    json: async () => kind === "json" ? value : JSON.parse(value),
    text: async () => kind === "text" ? value : JSON.stringify(value)
  };
}

test("所有公开世界接口都能解析成统一的可用结果", async () => {
  clearPublicWorldCaches();
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.startsWith("https://api.open-meteo.com/v1/elevation")) return response({ elevation: [1280] });
    if (url.startsWith("https://archive-api.open-meteo.com/v1/archive")) return response({
      daily: {
        time: ["2022-08-25", "2023-08-29", "2024-09-02", "2025-08-28"],
        temperature_2m_max: [24, 25, 26, 27],
        temperature_2m_min: [15, 16, 17, 18],
        precipitation_sum: [0, 2, 8, 20]
      }
    });
    if (url.startsWith("https://flood-api.open-meteo.com/v1/flood")) return response({
      latitude: 27.9, longitude: 108.7,
      daily: {
        time: ["2026-08-22", "2026-08-29", "2026-08-30"],
        river_discharge: [20, 30, 55], river_discharge_mean: [20, 30, 50], river_discharge_max: [24, 36, 60]
      }
    });
    if (url.startsWith("https://api.gbif.org/v1/occurrence/search")) return response({
      count: 1,
      results: [{ key: 7, vernacularName: "珙桐", scientificName: "Davidia involucrata", eventDate: "2026-08-20", decimalLatitude: 27.9, decimalLongitude: 108.7, basisOfRecord: "HUMAN_OBSERVATION" }]
    });
    if (url.startsWith("https://api.inaturalist.org/v1/observations")) return response({
      total_results: 1,
      results: [{ id: 8, observed_on: "2026-08-28", quality_grade: "research", uri: "https://www.inaturalist.org/observations/8", taxon: { name: "Rhinopithecus brelichi", preferred_common_name: "黔金丝猴" } }]
    });
    if (url.startsWith("https://earthquake.usgs.gov/fdsnws/event/1/query")) return response({
      features: [{ id: "eq1", properties: { mag: 3.8, place: "贵州附近", time: Date.parse("2026-08-28T00:00:00Z"), url: "https://earthquake.usgs.gov/eq1" }, geometry: { coordinates: [108.7, 27.9, 10] } }]
    });
    if (url.startsWith("https://firms.modaps.eosdis.nasa.gov/api/area/csv")) return response(
      "latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,frp\n27.9,108.7,330,0.4,0.4,2026-08-29,0530,N,nominal,12.5\n",
      "text"
    );
    if (url.startsWith("https://celestrak.org/NORAD/elements/gp.php")) return response(
      "ISS (ZARYA)\n1 25544U 98067A   26241.50000000  .00016717  00000+0  30166-3 0  9991\n2 25544  51.6400 250.0000 0005000  90.0000 270.0000 15.50000000123456\n",
      "text"
    );
    if (url.startsWith("https://opensky-network.org/api/states/all")) return response({
      time: 1787981400,
      states: [["780001", "CSN123", "China", 1787981400, 1787981400, 108.8, 27.8, 9000, false, 220, 180, 0, null, 9200, null, false, 0, 4]]
    });
    throw new Error(`unexpected_url:${url}`);
  };
  try {
    const result = await getPublicWorldData("fanjingshan", config(), new Date("2026-08-29T05:30:00Z"));
    assert.deepEqual(Object.keys(result), ["elevation", "history", "flood", "gbif", "inaturalist", "earthquakes", "fires", "orbital", "aviation"]);
    assert.ok(Object.values(result).every((item) => item.available), JSON.stringify(result));
    assert.equal(result.elevation.elevationM, 1280);
    assert.equal(result.history.normalMaxTemperatureC, 25.5);
    assert.equal(result.gbif.records[0].name, "珙桐");
    assert.equal(result.inaturalist.records[0].name, "黔金丝猴");
    assert.equal(result.earthquakes.events[0].magnitude, 3.8);
    assert.equal(result.fires.detections.length, 1);
    assert.equal(result.orbital.object, "国际空间站 ISS");
    assert.equal(result.aviation.aircraft[0].callsign, "CSN123");
    assert.equal(urls.length, 9);
  } finally {
    global.fetch = originalFetch;
    clearPublicWorldCaches();
  }
});

test("FIRMS缺少免费密钥时明确标记未配置且不发网络请求", async () => {
  clearPublicWorldCaches();
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error("不应调用"); };
  try {
    const result = await getActiveFires("guiyang", config({ firmsMapKey: "" }));
    assert.equal(result.available, false);
    assert.equal(result.reason, "missing_map_key");
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("CelesTrak直连失败时自动使用每日同步的公开TLE镜像", async () => {
  clearPublicWorldCaches();
  const originalFetch = global.fetch;
  global.fetch = async (input) => {
    const url = String(input);
    if (url.includes("celestrak.org")) return { ok: false, status: 503 };
    if (url.includes("tle.ivanstanojevic.me")) return response({
      satelliteId: 25544,
      line1: "1 25544U 98067A   26241.50000000  .00016717  00000+0  30166-3 0  9991",
      line2: "2 25544  51.6400 250.0000 0005000  90.0000 270.0000 15.50000000123456"
    });
    throw new Error(`unexpected_url:${url}`);
  };
  try {
    const result = await getOrbitalPasses("guiyang", config(), new Date("2026-08-29T05:30:00Z"));
    assert.equal(result.available, true);
    assert.equal(result.provider, "tle_api_celestrak_mirror");
  } finally {
    global.fetch = originalFetch;
    clearPublicWorldCaches();
  }
});

test("CSV解析支持引号、逗号和双引号转义", () => {
  assert.deepEqual(parseCsv('name,note\n"一号,点位","有""引号"""\n'), [{ name: "一号,点位", note: '有"引号"' }]);
});

test("能力摘要区分默认公开访问、必需密钥和可选认证", () => {
  const summary = publicWorldCapabilitySummary(config({ firmsMapKey: "", openSkyClientId: "id", openSkyClientSecret: "secret" }));
  assert.equal(summary.sources.elevation.auth, "none");
  assert.equal(summary.sources.firms.configured, false);
  assert.equal(summary.sources.aviation.authenticated, true);
});
