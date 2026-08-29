"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_ROOT = path.resolve(__dirname, "..", "data", "user-memories");
const MEMORY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CATEGORIES = new Set([
  "preference", "interest", "communication_style", "travel_style",
  "habit", "goal", "constraint", "preferred_name"
]);
const SENSITIVE_PATTERN = /(?:api[_ -]?key|token|密码|口令|密钥|身份证|护照号|银行卡|信用卡|手机号|电话号码|详细地址|住址|病史|诊断|宗教|政治立场|性取向)/i;

function cleanText(value, maxLength = 240) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validMemoryId(value) {
  const id = String(value || "").trim();
  return MEMORY_ID_PATTERN.test(id) ? id : null;
}

function emptyProfile(id) {
  return { id, features: [], createdAt: null, updatedAt: null, schemaVersion: 1 };
}

function normalizeFeature(value) {
  return cleanText(value, 240).toLocaleLowerCase("zh-CN").replace(/[，。！？、,.!?\s]/g, "");
}

function sanitizeOperation(operation) {
  if (!operation || typeof operation !== "object") return null;
  const action = operation.action === "forget" ? "forget" : operation.action === "remember" ? "remember" : null;
  if (!action) return null;
  if (action === "forget") {
    const featureId = cleanText(operation.featureId, 80);
    const query = cleanText(operation.query, 120);
    return featureId || query ? { action, featureId: featureId || null, query: query || null } : null;
  }
  const category = cleanText(operation.category, 40);
  const value = cleanText(operation.value, 240);
  if (!ALLOWED_CATEGORIES.has(category) || value.length < 2 || SENSITIVE_PATTERN.test(value)) return null;
  const confidence = Math.max(0.5, Math.min(1, Number(operation.confidence) || 0.7));
  return { action, category, value, confidence };
}

function createUserMemoryStore(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const now = options.now || (() => new Date());

  function profileFile(id) {
    const safeId = validMemoryId(id);
    if (!safeId) return null;
    return path.join(rootDir, `${safeId}.json`);
  }

  function read(id) {
    const safeId = validMemoryId(id);
    if (!safeId) return null;
    const target = profileFile(safeId);
    try {
      const value = JSON.parse(fs.readFileSync(target, "utf8"));
      return {
        ...emptyProfile(safeId),
        ...value,
        id: safeId,
        features: Array.isArray(value.features) ? value.features.slice(-100) : []
      };
    } catch (error) {
      if (error.code === "ENOENT") return emptyProfile(safeId);
      throw error;
    }
  }

  function write(profile) {
    fs.mkdirSync(rootDir, { recursive: true });
    const target = profileFile(profile.id);
    if (!target) return null;
    const temporary = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(profile, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, target);
    return profile;
  }

  function apply(id, rawOperations = []) {
    const profile = read(id);
    if (!profile) return { profile: null, changed: false, applied: 0 };
    const timestamp = now().toISOString();
    let changed = false;
    let applied = 0;
    for (const rawOperation of rawOperations.slice(0, 8)) {
      const operation = sanitizeOperation(rawOperation);
      if (!operation) continue;
      if (operation.action === "forget") {
        const before = profile.features.length;
        const query = normalizeFeature(operation.query);
        profile.features = profile.features.filter((feature) => {
          if (operation.featureId && feature.id === operation.featureId) return false;
          return !(query && normalizeFeature(feature.value).includes(query));
        });
        if (profile.features.length !== before) { changed = true; applied += before - profile.features.length; }
        continue;
      }
      const normalized = normalizeFeature(operation.value);
      const existing = profile.features.find((feature) =>
        feature.category === operation.category && normalizeFeature(feature.value) === normalized
      );
      if (existing) {
        existing.confidence = Math.max(existing.confidence || 0.5, operation.confidence);
        existing.evidenceCount = (existing.evidenceCount || 1) + 1;
        existing.lastObservedAt = timestamp;
      } else {
        profile.features.push({
          id: crypto.randomUUID(),
          category: operation.category,
          value: operation.value,
          confidence: operation.confidence,
          evidenceCount: 1,
          firstObservedAt: timestamp,
          lastObservedAt: timestamp,
          scope: "relationship_private"
        });
      }
      changed = true;
      applied += 1;
    }
    if (!changed) return { profile, changed: false, applied: 0 };
    profile.features = profile.features.slice(-100);
    profile.createdAt ||= timestamp;
    profile.updatedAt = timestamp;
    profile.schemaVersion = 1;
    return { profile: write(profile), changed: true, applied };
  }

  function clear(id) {
    const profile = read(id);
    if (!profile || !profile.features.length) return { profile, changed: false, applied: 0 };
    const count = profile.features.length;
    profile.features = [];
    profile.updatedAt = now().toISOString();
    return { profile: write(profile), changed: true, applied: count };
  }

  return { rootDir, read, apply, clear };
}

module.exports = {
  createUserMemoryStore,
  validMemoryId,
  sanitizeOperation,
  ALLOWED_CATEGORIES,
  DEFAULT_ROOT
};
