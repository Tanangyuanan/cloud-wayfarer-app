"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pickStartLocation } = require("./locations");

const DEFAULT_ROOT = path.resolve(__dirname, "..", "data", "journeys");
const JOURNEY_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEDIA_NAME_PATTERN = /^[0-9a-f-]+\.(?:jpg|jpeg|png|webp)$/i;
const INITIAL_ROUTE = ["guiyang"];
const PACE_DURATIONS = { "实时同行": 40, "沉浸节奏": 30, "快速云游": 8, "睡前漫游": 20 };

function publicError(code, message) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = message;
  return error;
}

function assertJourneyId(id) {
  if (!JOURNEY_ID_PATTERN.test(String(id || ""))) throw publicError("invalid_journey_id", "旅程编号无效。");
  return String(id);
}

function sanitizeSettings(value = {}) {
  const pace = String(value.pace || "沉浸节奏").slice(0, 20);
  const requestedDuration = Number(value.durationMinutes);
  return {
    mode: String(value.mode || "自驾").slice(0, 20),
    pace,
    destination: "贵州",
    theme: String(value.theme || "第一次认识贵州").trim().slice(0, 40),
    // A blank clue must stay blank. Example copy belongs in placeholders, not
    // persisted relationship memory that the model may mistake for user words.
    commission: String(value.commission || "").trim().slice(0, 600),
    discoveryMode: "surprise",
    durationMinutes: Number.isFinite(requestedDuration)
      ? Math.max(1, Math.min(240, Math.round(requestedDuration)))
      : (PACE_DURATIONS[pace] || 30)
  };
}

function event(type, at, title, summary = "", data = {}) {
  return { id: crypto.randomUUID(), type, at, title, summary, data };
}

function initialState(settings, timestamp, startLocationId = INITIAL_ROUTE[0]) {
  return {
    phase: "draft",
    currentStopIndex: 0,
    originLocationId: startLocationId,
    currentLocationId: startLocationId,
    nextLocationId: null,
    nextLocationRevealed: false,
    explorationIntent: "先到贵阳生活一会，再决定下一站。",
    routeProgress: 0,
    segmentProgress: 0,
    segmentStartedAt: null,
    segmentDurationMs: settings.durationMinutes * 60 * 1000,
    segmentRealDurationSeconds: null,
    segmentSpeedMultiplier: null,
    segmentTimingSource: "pace-fallback",
    segmentTimingKey: null,
    nextEventAt: null,
    pausedAt: null,
    pausedFromPhase: null,
    waitingSince: null,
    decisionDeadlineAt: null,
    startedAt: null,
    completedAt: null,
    lastSyncedAt: timestamp
  };
}

function initialEmbodiment(timestamp) {
  return {
    energy: 82,
    hunger: 28,
    comfort: 76,
    mood: "准备出发，有点期待",
    clothing: ["轻便外套", "防滑步行鞋"],
    thought: "先让真实的路和天气决定今天会变成什么样。",
    environment: null,
    updatedAt: timestamp
  };
}

function migrateJourney(value) {
  const journey = value && typeof value === "object" ? value : {};
  const timestamp = journey.updatedAt || journey.createdAt || new Date().toISOString();
  journey.route = Array.isArray(journey.route) && journey.route.length ? journey.route : [...INITIAL_ROUTE];
  journey.settings = sanitizeSettings(journey.settings);
  journey.entries = Array.isArray(journey.entries) ? journey.entries : [];
  journey.generation = journey.generation && typeof journey.generation === "object" ? journey.generation : {};
  journey.events = Array.isArray(journey.events) ? journey.events : [];
  journey.decisions = Array.isArray(journey.decisions) ? journey.decisions : [];
  journey.memories = Array.isArray(journey.memories) ? journey.memories : [];
  journey.preferences = journey.preferences && typeof journey.preferences === "object" ? journey.preferences : { learned: [] };
  journey.preferences.learned = Array.isArray(journey.preferences.learned) ? journey.preferences.learned : [];
  journey.agent = {
    name: "阿镜",
    framework: "@earendil-works/pi-agent-core",
    frameworkVersion: "0.84.4",
    status: "ready",
    lastRun: null,
    ...(journey.agent || {})
  };
  journey.state = { ...initialState(journey.settings, timestamp, journey.route[0]), ...(journey.state || {}) };
  journey.state.originLocationId ||= journey.route[0] || journey.state.currentLocationId || INITIAL_ROUTE[0];
  journey.embodiment = { ...initialEmbodiment(timestamp), ...(journey.embodiment || {}) };
  journey.schemaVersion = 4;
  return journey;
}

function createJourneyStore(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT);
  const now = options.now || (() => new Date());
  // Store 单测默认保持确定性；正式 service 会显式传入 Math.random。
  const random = options.random || (() => 0);

  function journeyDir(id) {
    return path.join(rootDir, assertJourneyId(id));
  }

  function journeyFile(id) {
    return path.join(journeyDir(id), "journey.json");
  }

  function ensureRoot() {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  function write(journey) {
    ensureRoot();
    const directory = journeyDir(journey.id);
    fs.mkdirSync(path.join(directory, "media"), { recursive: true });
    const target = journeyFile(journey.id);
    const temporary = `${target}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(journey, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(temporary, target);
    return journey;
  }

  function create(settings = {}) {
    const timestamp = now().toISOString();
    const safeSettings = sanitizeSettings(settings);
    const startLocation = pickStartLocation(random);
    const initialRoute = [startLocation.id];
    return write({
      id: crypto.randomUUID(),
      status: "active",
      route: initialRoute,
      settings: safeSettings,
      agent: {
        name: "阿镜",
        framework: "@earendil-works/pi-agent-core",
        frameworkVersion: "0.84.4",
        status: "ready",
        lastRun: null
      },
      state: initialState(safeSettings, timestamp, startLocation.id),
      embodiment: initialEmbodiment(timestamp),
      entries: [],
      generation: {},
      memories: [],
      preferences: { learned: [] },
      decisions: [],
      events: [safeSettings.commission
        ? event("journey_created", timestamp, "收到你写下的一句话", safeSettings.commission, { theme: safeSettings.theme, startLocationId: startLocation.id })
        : event("journey_created", timestamp, "旅程已经建立", `阿镜将在${startLocation.name}落脚，再让真实的路开始。`, { theme: safeSettings.theme, startLocationId: startLocation.id })],
      createdAt: timestamp,
      updatedAt: timestamp,
      schemaVersion: 4
    });
  }

  function read(id) {
    const target = journeyFile(id);
    try {
      return migrateJourney(JSON.parse(fs.readFileSync(target, "utf8")));
    } catch (error) {
      if (error.code === "ENOENT") throw publicError("journey_not_found", "没有找到这次旅行手账。");
      throw error;
    }
  }

  function list() {
    ensureRoot();
    return fs.readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && JOURNEY_ID_PATTERN.test(entry.name))
      .map((entry) => {
        try { return read(entry.name); } catch { return null; }
      })
      .filter(Boolean);
  }

  function update(id, updater) {
    const journey = read(id);
    const next = updater(structuredClone(journey)) || journey;
    next.id = journey.id;
    next.updatedAt = now().toISOString();
    return write(next);
  }

  function writeMedia(id, buffer, extension = "jpg") {
    assertJourneyId(id);
    if (!Buffer.isBuffer(buffer) || buffer.length < 128 || buffer.length > 15 * 1024 * 1024) {
      throw publicError("invalid_generated_media", "生成图片格式无效。");
    }
    const safeExtension = ["jpg", "jpeg", "png", "webp"].includes(extension) ? extension : "jpg";
    const filename = `${crypto.randomUUID()}.${safeExtension}`;
    const directory = path.join(journeyDir(id), "media");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, filename), buffer, { mode: 0o600 });
    return filename;
  }

  function resolveMedia(id, filename) {
    assertJourneyId(id);
    if (!MEDIA_NAME_PATTERN.test(String(filename || ""))) throw publicError("invalid_media_name", "图片地址无效。");
    const target = path.join(journeyDir(id), "media", filename);
    let stat;
    try { stat = fs.statSync(target); } catch { throw publicError("media_not_found", "没有找到这张手账图片。"); }
    if (!stat.isFile()) throw publicError("media_not_found", "没有找到这张手账图片。");
    return { path: target, size: stat.size, extension: path.extname(target).slice(1).toLowerCase() };
  }

  return { rootDir, create, read, update, list, writeMedia, resolveMedia };
}

module.exports = { createJourneyStore, assertJourneyId, sanitizeSettings, migrateJourney, INITIAL_ROUTE, DEFAULT_ROUTE: INITIAL_ROUTE };
