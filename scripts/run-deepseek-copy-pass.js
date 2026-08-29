#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runDir = path.resolve(process.argv[2] || path.join(root, "05_drafts", "deepseek-copy-pass", runId));
const inputDir = path.join(runDir, "input");
const outputDir = path.join(runDir, "output");

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

fs.mkdirSync(outputDir, { recursive: true });
run("build-deepseek-copy-input.js", [inputDir]);
for (const filename of fs.readdirSync(inputDir).filter((name) => name.endsWith(".json")).sort()) {
  run("deepseek-copy-editor.js", [path.join(inputDir, filename), path.join(outputDir, filename)]);
}
process.stdout.write(`全部 DeepSeek V4 Pro 文案批次已完成：${runDir}\n`);
