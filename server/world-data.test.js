"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveLocation } = require("./locations");
const { buildWorldSnapshot, validateWorldSnapshot, dataCatalogSummary } = require("./world-data");

function context(overrides = {}) {
  return {
    location: resolveLocation("fanjingshan"),
    localTime: {
      period: "傍晚",
      localText: "2026/08/29 周六 18:43:00",
      timezone: "Asia/Shanghai"
    },
    season: "夏季",
    observedAt: "2026-08-29T10:43:00.000Z",
    weather: {
      available: true,
      condition: "有雾",
      temperatureC: 15.2,
      apparentTemperatureC: 14.1,
      relativeHumidityPercent: 94,
      precipitationMm: 0.4,
      windKph: 11,
      windDirectionDeg: 190,
      windGustKph: 20,
      cloudCoverPercent: 98,
      visibilityM: 900,
      surfacePressureHpa: 823,
      isDay: true,
      modelElevationM: 2260,
      today: {
        maxTemperatureC: 28,
        sunrise: "2026-08-29T06:24",
        sunset: "2026-08-29T19:10"
      }
    },
    airQuality: {
      available: true,
      usAqi: 38,
      pm25: 7.2,
      pm10: 12,
      ozone: 70,
      nitrogenDioxide: 3,
      sulphurDioxide: 2,
      carbonMonoxide: 150
    },
    publicWorldData: {
      elevation: { available: true, elevationM: 2310 },
      history: { available: true, normalMaxTemperatureC: 20, normalMinTemperatureC: 12, normalPrecipitationMm: 5, precipitationP90Mm: 18, precipitationP95Mm: 26, sampleDays: 100 },
      flood: { available: true, currentDischargeM3s: 20, sevenDayForecastMaxM3s: 45 },
      gbif: { available: true, radiusKmApprox: 25, totalInBoundingBox: 2, records: [{ name: "珙桐" }] },
      inaturalist: { available: true, radiusKm: 25, total: 1, records: [{ name: "黔金丝猴", observedOn: "2026-08-28" }] },
      earthquakes: { available: true, radiusKm: 300, events: [{ magnitude: 3.8, distanceKm: 90 }] },
      fires: { available: true, radiusKmApprox: 100, detections: [{ acquiredAt: "2026-08-29T05:30:00Z" }] },
      orbital: { available: true, elementEpoch: "26241.5", passes: [{ startAt: "2026-08-29T12:00:00Z", maxElevationDeg: 45, visible: true }], nextVisiblePass: { startAt: "2026-08-29T12:00:00Z", maxElevationDeg: 45, visible: true } },
      aviation: { available: true, radiusKmApprox: 100, observedAt: "2026-08-29T10:43:00Z", aircraft: [{ callsign: "CSN123" }] }
    },
    ...overrides
  };
}

test("世界快照把直接观测与推演事件分开并保留表达边界", () => {
  const snapshot = buildWorldSnapshot(context());
  const validation = validateWorldSnapshot(snapshot);
  assert.equal(validation.valid, true, validation.errors.join(", "));
  assert.equal(snapshot.schemaVersion, "1.0.0");
  assert.ok(snapshot.sources.includes("open_meteo_forecast"));
  assert.ok(snapshot.sources.includes("open_meteo_air_quality"));
  assert.ok(snapshot.sources.includes("open_meteo_history"));
  assert.ok(snapshot.sources.includes("gbif_occurrence_api"));
  assert.ok(snapshot.sources.includes("nasa_firms"));
  assert.ok(snapshot.sources.includes("celestrak_gp"));
  assert.ok(snapshot.sources.includes("opensky_live"));
  assert.equal(snapshot.location.modelElevationM, 2310);

  const rain = snapshot.events.find((event) => event.type === "active_precipitation");
  const wetGround = snapshot.events.find((event) => event.type === "wet_ground_risk");
  const fog = snapshot.events.find((event) => event.type === "confirmed_fog");
  const visibility = snapshot.events.find((event) => event.type === "low_visibility");
  const humidity = snapshot.events.find((event) => event.type === "humid_body_load");
  const light = snapshot.events.find((event) => event.type === "golden_hour_window");

  assert.equal(rain.knowledgeMode, "direct_experience");
  assert.equal(wetGround.evidenceMode, "derived");
  assert.equal(wetGround.knowledgeMode, "inference_only");
  assert.match(wetGround.firstPersonBoundary, /不能断言/);
  assert.equal(fog.ruleId, "confirmed_fog");
  assert.equal(visibility.ruleId, "low_visibility");
  assert.equal(humidity.ruleId, "humid_body_load");
  assert.equal(light.ruleId, "golden_hour_window");
  assert.ok(snapshot.events.find((event) => event.type === "temperature_departure_from_history"));
  assert.ok(snapshot.events.find((event) => event.type === "modelled_river_rise"));
  assert.ok(snapshot.events.find((event) => event.type === "recent_nature_reports"));
  assert.ok(snapshot.events.find((event) => event.type === "nearby_earthquake_report"));
  assert.ok(snapshot.events.find((event) => event.type === "nearby_thermal_detection"));
  assert.ok(snapshot.events.find((event) => event.type === "possible_visible_iss_pass"));
  assert.ok(snapshot.events.find((event) => event.type === "aircraft_in_nearby_airspace"));
  assert.ok(snapshot.events.every((event) => event.affects.length > 0));
});

test("空气质量达到阈值时只生成工具获知的身体负担建议", () => {
  const snapshot = buildWorldSnapshot(context({
    weather: { available: false },
    airQuality: { available: true, usAqi: 128, pm25: 44, pm10: 81 }
  }));
  const event = snapshot.events.find((item) => item.type === "air_quality_load");
  assert.equal(event.knowledgeMode, "tool_known");
  assert.equal(event.evidenceMode, "derived");
  assert.match(event.firstPersonBoundary, /不等同于阿镜已经出现/);
  assert.ok(snapshot.maintenance.degradedSources.includes("open_meteo_forecast"));
});

test("数据目录能报告已接入和需合作来源", () => {
  const summary = dataCatalogSummary();
  assert.ok(summary.sourceCounts.integrated >= 15);
  assert.equal(summary.sourceCounts.ready || 0, 0);
  assert.ok(summary.sourceCounts.requires_partnership >= 4);
  assert.ok(summary.implementedRules.includes("active_precipitation"));
});
