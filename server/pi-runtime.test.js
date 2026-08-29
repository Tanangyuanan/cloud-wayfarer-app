"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("Agent 环境工具会保留高关注实时事件并压缩大体量观测记录", async () => {
  const { compactEnvironmentForAgent, compactJourneyForAgent } = await import("./pi-runtime.mjs");
  const compact = compactEnvironmentForAgent({
    location: { id: "qingyan", name: "青岩古镇" },
    localTime: { localText: "2026/08/29周六 19:10:00", period: "傍晚" },
    season: "夏季",
    weather: { available: true, condition: "大体晴朗", temperatureC: 24, windGustKph: 47 },
    airQuality: { available: true, usAqi: 70, pm25: 11.8 },
    observedAt: "2026-08-29T11:10:00.000Z",
    publicWorldData: {
      inaturalist: { records: Array.from({ length: 100 }, (_, index) => ({ id: index, name: `物种${index}` })) }
    },
    world: {
      observedAt: "2026-08-29T11:10:00.000Z",
      events: [{
        type: "nearby_earthquake_report",
        title: "USGS记录到附近M4.9地震",
        evidenceMode: "reported_observation",
        knowledgeMode: "tool_known",
        confidence: 0.86,
        affects: ["安全", "路线"],
        firstPersonBoundary: "不表示所在地一定有震感。",
        expiresAt: "2026-08-29T12:10:00.000Z",
        attentionScore: 94
      }],
      observations: [{
        dimension: "生命",
        metric: "nearby_inaturalist_observations",
        value: {
          radiusKm: 25,
          total: 8781,
          records: Array.from({ length: 100 }, (_, index) => ({
            name: `物种${index}`,
            scientificName: `Species ${index}`,
            observedOn: "2026-08-20",
            qualityGrade: "research"
          }))
        },
        sourceId: "inaturalist_observations",
        evidenceMode: "reported_observation",
        confidence: 0.72,
        observedAt: "2026-08-29T11:10:00.000Z",
        expiresAt: "2026-08-29T12:10:00.000Z"
      }],
      sources: ["open_meteo_forecast", "inaturalist_observations"],
      maintenance: { degradedSources: [], unconfiguredSources: ["nasa_firms"], disabledSources: [] }
    }
  });

  assert.equal(compact.world.events[0].type, "nearby_earthquake_report");
  assert.match(compact.world.events[0].firstPersonBoundary, /不表示所在地一定有震感/);
  assert.equal(compact.world.observations[0].value.recentExamples.length, 3);
  assert.equal(compact.publicWorldData, undefined);
  assert.ok(JSON.stringify(compact).length < 7000);

  const compactJourney = compactJourneyForAgent({
    id: "journey-1",
    embodiment: { energy: 72, environment: { ...compact, publicWorldData: { oversized: true } } },
    memories: [{ text: "这段记忆应继续保留" }]
  });
  assert.equal(compactJourney.embodiment.environment.publicWorldData, undefined);
  assert.equal(compactJourney.memories[0].text, "这段记忆应继续保留");
});
