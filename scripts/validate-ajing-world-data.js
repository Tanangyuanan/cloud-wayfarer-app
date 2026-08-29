#!/usr/bin/env node
"use strict";

const sources = require("../data/ajing-world/data-sources.json");
const rules = require("../data/ajing-world/inference-rules.json");
const schema = require("../data/ajing-world/world-snapshot.schema.json");
const { buildWorldSnapshot, validateWorldSnapshot } = require("../server/world-data");
const { resolveLocation } = require("../server/locations");

const errors = [];

function uniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item.id) errors.push(`${label}: missing id`);
    else if (seen.has(item.id)) errors.push(`${label}: duplicate id ${item.id}`);
    else seen.add(item.id);
  }
}

uniqueIds(sources.sources, "source");
uniqueIds(rules.rules, "rule");
if (!/^\d{4}-\d{2}-\d{2}$/.test(sources.meta?.checkedAt || "")) errors.push("source registry: checkedAt missing or invalid");

const validStatuses = new Set(Object.keys(sources.statusDefinitions));
for (const source of sources.sources) {
  for (const field of ["name", "acquisition", "access", "integrationStatus", "evidenceMode", "firstPersonBoundary"]) {
    if (!source[field]) errors.push(`source ${source.id || "unknown"}: missing ${field}`);
  }
  if (!validStatuses.has(source.integrationStatus)) errors.push(`source ${source.id}: unknown status ${source.integrationStatus}`);
  if (!Array.isArray(source.dimensions) || !source.dimensions.length) errors.push(`source ${source.id}: dimensions missing`);
  if (source.officialDocs && !/^https:\/\//.test(source.officialDocs)) errors.push(`source ${source.id}: officialDocs must use https`);
  if (["public_api", "public_feed"].includes(source.acquisition) && source.integrationStatus !== "integrated") {
    errors.push(`source ${source.id}: public interface must be integrated`);
  }
}

for (const rule of rules.rules) {
  for (const field of ["status", "kind", "requires", "logic", "output", "confidence", "evidenceMode", "affects"]) {
    if (rule[field] == null) errors.push(`rule ${rule.id || "unknown"}: missing ${field}`);
  }
  if (!Array.isArray(rule.requires) || !rule.requires.length) errors.push(`rule ${rule.id}: requires missing`);
  if (!Array.isArray(rule.affects) || !rule.affects.length) errors.push(`rule ${rule.id}: affects missing`);
}

if (schema.properties?.schemaVersion?.const !== "1.0.0") errors.push("snapshot schema version mismatch");

const sample = buildWorldSnapshot({
  location: resolveLocation("guiyang"),
  localTime: { period: "下午", localText: "2026/08/29 15:30:00" },
  season: "夏季",
  observedAt: "2026-08-29T07:30:00.000Z",
  weather: {
    available: true,
    condition: "小雨",
    temperatureC: 24,
    apparentTemperatureC: 25,
    relativeHumidityPercent: 90,
    precipitationMm: 0.3,
    windKph: 8,
    isDay: true,
    today: { sunrise: "2026-08-29T06:25", sunset: "2026-08-29T19:14" }
  },
  airQuality: { available: true, usAqi: 40, pm25: 8, pm10: 15 }
});
const validation = validateWorldSnapshot(sample);
errors.push(...validation.errors.map((error) => `sample snapshot: ${error}`));

if (errors.length) {
  console.error(`阿镜世界数据校验失败（${errors.length}项）：`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const byStatus = Object.groupBy(sources.sources, (source) => source.integrationStatus);
  console.log("阿镜世界数据校验通过");
  console.log(`数据源：${sources.sources.length}；规则：${rules.rules.length}；样例观测：${sample.observations.length}；样例事件：${sample.events.length}`);
  console.log(Object.fromEntries(Object.entries(byStatus).map(([status, items]) => [status, items.length])));
}
