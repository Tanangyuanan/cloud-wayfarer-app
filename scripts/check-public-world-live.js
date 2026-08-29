#!/usr/bin/env node
"use strict";

const { loadLocalEnv } = require("../server/load-env");
const { getConfig } = require("../server/config");
const { resolveLocation } = require("../server/locations");
const { getPublicWorldData } = require("../server/public-world-tools");

async function main() {
  loadLocalEnv();
  const location = resolveLocation(process.argv[2] || "guiyang");
  const results = await getPublicWorldData(location.id, getConfig(), new Date());
  const summary = Object.fromEntries(Object.entries(results).map(([key, value]) => [key, {
    available: Boolean(value.available),
    reason: value.available ? null : value.reason || "unknown",
    detail: value.available ? null : value.detail || null,
    cache: value.cache || "miss"
  }]));
  console.log(JSON.stringify({ location: { id: location.id, name: location.name }, sources: summary }, null, 2));
  const hardFailures = Object.values(results).filter((value) => !value.available && !["missing_map_key", "disabled", "unauthorized", "rate_limited"].includes(value.reason));
  if (hardFailures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error.message || error).slice(0, 120) }));
  process.exitCode = 1;
});
