"use strict";

const fs = require("node:fs");
const path = require("node:path");

function unquote(value) {
  const text = String(value || "").trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

function loadLocalEnv(filename = path.resolve(__dirname, "..", ".env")) {
  if (!fs.existsSync(filename)) return false;
  const content = fs.readFileSync(filename, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] == null) process.env[name] = unquote(rawValue);
  }
  return true;
}

module.exports = { loadLocalEnv };
