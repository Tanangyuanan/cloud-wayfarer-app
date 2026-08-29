"use strict";

const crypto = require("node:crypto");
const { createJourneyStore } = require("./journey-store");
const { generateJournalEntry } = require("./journal-generator");
const { LOCATIONS, resolveLocation, explorationCandidates, fallbackNextLocation } = require("./locations");
const { searchKnowledge } = require("./knowledge");
const { getLocalTime, getWeather, getAirQuality, searchWeb } = require("./tools");
const { runAjingDecision } = require("./pi-agent");
const { buildWorldSnapshot } = require("./world-data");
const { getPublicWorldData } = require("./public-world-tools");

const DECISION_WINDOW_MS = 45 * 1000;
const MIN_SIMULATED_SEGMENT_MS = 60 * 1000;
const MAX_REAL_ROUTE_SECONDS = 7 * 24 * 60 * 60;
const PACE_SPEED_MULTIPLIERS = Object.freeze({
  "实时同行": 1,
  "沉浸节奏": 10,
  "快速云游": 40
});

function serviceError(code, message) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = message;
  return error;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function calculateRouteTiming(settings = {}, realDurationSeconds) {
  const realSeconds = clamp(realDurationSeconds, 60, MAX_REAL_ROUTE_SECONDS);
  const realDurationMs = Math.round(realSeconds * 1000);
  const pace = String(settings.pace || "沉浸节奏");
  if (pace === "自定义") {
    const customDurationMs = clamp(settings.durationMinutes || 30, 1, 240) * 60 * 1000;
    return {
      realDurationSeconds: Math.round(realSeconds),
      segmentDurationMs: Math.round(customDurationMs),
      speedMultiplier: Number((realDurationMs / customDurationMs).toFixed(2)),
      source: "road-route-custom"
    };
  }
  const speedMultiplier = PACE_SPEED_MULTIPLIERS[pace] || PACE_SPEED_MULTIPLIERS["沉浸节奏"];
  return {
    realDurationSeconds: Math.round(realSeconds),
    segmentDurationMs: Math.max(MIN_SIMULATED_SEGMENT_MS, Math.round(realDurationMs / speedMultiplier)),
    speedMultiplier,
    source: "road-route"
  };
}

function addEvent(draft, type, title, summary, data, at) {
  draft.events ||= [];
  draft.events.push({
    id: crypto.randomUUID(),
    type,
    at,
    title: String(title || "").slice(0, 100),
    summary: String(summary || "").slice(0, 600),
    data: data || {}
  });
  if (draft.events.length > 160) draft.events = draft.events.slice(-160);
}

function seasonFor(date) {
  const month = date.getUTCMonth() + 1;
  if ([3, 4, 5].includes(month)) return "春季";
  if ([6, 7, 8].includes(month)) return "夏季";
  if ([9, 10, 11].includes(month)) return "秋季";
  return "冬季";
}

function weatherClothing(weather) {
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const clothes = [];
  if (!Number.isFinite(apparent)) clothes.push("轻便外套");
  else if (apparent <= 8) clothes.push("保暖外套", "长裤");
  else if (apparent <= 17) clothes.push("薄外套", "长裤");
  else if (apparent >= 29) clothes.push("透气短袖", "轻薄长裤");
  else clothes.push("长袖上衣", "轻便长裤");
  if (Number(weather?.precipitationMm) > 0 || /雨|雷/.test(String(weather?.condition || ""))) clothes.push("折叠伞", "防滑鞋");
  else clothes.push("步行鞋");
  return [...new Set(clothes)].slice(0, 5);
}

function fallbackPresenceThought(journey, environment, clothing, action, comfort) {
  const location = resolveLocation(journey.state.currentLocationId);
  const placeName = location.visit?.name || location.name;
  const placeFocus = location.visit?.focus || location.focus;
  const plannedNext = action === "continue" ? fallbackNextLocation(journey) : null;
  const weather = environment?.weather;
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const wind = Number(weather?.windKph);
  const rain = Number(weather?.precipitationMm) > 0 || /雨|雷/.test(String(weather?.condition || ""));
  const warm = Number.isFinite(apparent) && apparent >= 26;
  const cool = Number.isFinite(apparent) && apparent <= 16;
  const firstLayer = clothing?.[0] || "身上这层衣服";
  const energy = Number(journey.embodiment?.energy ?? 80);
  const bodyLine = rain
    ? `雨没有下得很急，却很会留人。湿气一点点贴上${firstLayer}，脚步一慢，皮肤就先于眼睛记住了这里。`
    : warm
      ? `体感已经到了 ${Math.round(apparent)}℃ 左右。${firstLayer}开始显得多了一点，我不再想着走得多快，只想先找回自己舒服的呼吸。`
      : cool
        ? `体感只有 ${Math.round(apparent)}℃ 左右，凉意先从露在外面的皮肤进来。我把${firstLayer}收紧一点，脚步也跟着变得更小。`
      : `今天的天气还没能说准。我把脚步放慢一些，不急着猜风从哪边来，也不急着给这一刻添上声音。`;
  const bodyFeeling = energy < 42
    ? "走到这里，我现在确实有点累，腿也不太愿意再快起来。"
    : comfort < 62
      ? "我说不上难受，只是身上有些不舒服，继续赶路的念头也淡了。"
      : "我还走得动，只是不想为了多赶一点路，把身体的感觉压下去。";
  const nextMove = action === "rest"
    ? "所以我想先停下来，好好歇一会儿。"
    : action === "linger"
      ? "所以我想找个舒服些的地方坐一会儿，等身体松下来再走。"
      : Number.isFinite(wind) && wind >= 18
        ? `风速约 ${Math.round(wind)} 公里/小时，我会把下一段路走得更稳一点。`
        : "我想照着现在的速度继续，不催自己。";
  const closing = action === "continue" && plannedNext
    ? `${nextMove}我会从${placeName}出发，往${plannedNext.name}去；沿途先留意${plannedNext.focus}怎样落进普通的一天。`
    : `${nextMove}我先不急着往下一个地方赶，等身体给出一个更明确的答案。等缓过这一阵，再从${placeName}继续游走，看看${placeFocus}怎样落进普通的一天。`;
  return [`${bodyLine}${bodyFeeling}`, closing].join("\n\n");
}

function fallbackDecision(journey, environment, reason) {
  const weather = environment?.weather;
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const rain = Number(weather?.precipitationMm) > 0 || /雨|雷/.test(String(weather?.condition || ""));
  const wind = Number(weather?.windKph) || 0;
  const comfort = clamp(78 - (rain ? 14 : 0) - Math.max(0, wind - 18) / 2 - (Number.isFinite(apparent) ? Math.abs(apparent - 21) * 1.4 : 0), 20, 92);
  const currentEnergy = Number(journey.embodiment?.energy ?? 80);
  const action = currentEnergy < 28 || /雷暴/.test(String(weather?.condition || ""))
    ? "rest"
    : comfort < 62 || rain
      ? "linger"
      : "continue";
  const nextLocation = fallbackNextLocation(journey);
  const clothing = weatherClothing(weather);
  return {
    action,
    nextLocationId: action === "continue" ? nextLocation.id : null,
    nextStopReason: action === "continue"
      ? `先去${nextLocation.region}，沿“${nextLocation.focus}”这条线索继续看看。`
      : action === "linger"
        ? "我现在有点不舒服，想先找个合适的地方缓一缓。"
        : "身体状态比赶往某个景点更重要，休息后再重新选择。",
    mood: action === "rest" ? "有点累，决定先停一停" : action === "linger" ? "身上不太舒服，想慢一点" : "安静地期待下一段路",
    clothing,
    comfort: Math.round(comfort),
    energyDelta: action === "rest" ? 4 : action === "linger" ? -1 : -5,
    thought: fallbackPresenceThought(journey, environment, clothing, action, comfort),
    reason: action === "rest"
      ? "身体已经有些跟不上了，我想先停下来，把呼吸和力气找回来。"
      : "天气、体力和一路留下的问题放在一起，我更想顺着这一点好奇继续走。",
    contentIntent: `从${resolveLocation(journey.state.currentLocationId).visit?.name || resolveLocation(journey.state.currentLocationId).name}此刻的环境与云游四方线索出发，写一页有来源、也有个人判断的旅行记录。`,
    deliveryFormat: "note",
    whyForUser: journey.settings?.commission
      ? `你说过：“${String(journey.settings.commission).slice(0, 70)}”今天走到这里时，我又想起了这句话。`
      : "今天的天气轻轻改了这段路，我想把这一刻寄回来。",
    researchStatus: "not-needed"
  };
}

function publicJourneySnapshot(journey) {
  return {
    id: journey.id,
    settings: journey.settings,
    route: journey.route,
    state: journey.state,
    embodiment: journey.embodiment,
    memories: (journey.memories || []).slice(-12).map((memory) => ({
      id: memory.id,
      kind: memory.kind,
      at: memory.at || memory.occurredAt,
      location: memory.location || null,
      text: String(memory.text || memory.whatHappened || "").slice(0, 320),
      reflection: String(memory.reflection || "").slice(0, 260),
      scope: memory.scope || memory.privacy || null,
      replyToEntryId: memory.replyToEntryId || null,
      preferenceUpdates: memory.preferenceUpdates || []
    })),
    preferences: journey.preferences || { learned: [] },
    decisions: (journey.decisions || []).slice(-8),
    visited: (journey.entries || []).map((entry) => ({ locationId: entry.locationId, locationName: entry.locationName, generatedAt: entry.meta?.generatedAt })),
    recentEvents: (journey.events || []).slice(-10).map(({ type, at, title, summary }) => ({ type, at, title, summary }))
  };
}

function normalizeDecision(journey, decision) {
  const normalized = { ...decision };
  if (normalized.action !== "continue") {
    normalized.nextLocationId = null;
    return normalized;
  }
  const requested = String(normalized.nextLocationId || "").trim();
  const isAvailable = Boolean(
    LOCATIONS[requested]
    && requested !== journey.state.currentLocationId
    && !journey.route.includes(requested)
  );
  const nextLocation = isAvailable ? LOCATIONS[requested] : fallbackNextLocation(journey);
  normalized.nextLocationId = nextLocation.id;
  normalized.nextStopReason = String(normalized.nextStopReason || `沿${nextLocation.focus}继续探索。`).slice(0, 180);
  return normalized;
}

function reusableArrivalRun(journey) {
  const currentLocationId = String(journey?.state?.currentLocationId || "");
  const lastRun = journey?.agent?.lastRun;
  const environment = journey?.embodiment?.environment;
  const observedLocationId = String(environment?.location?.id || "");
  const runLocationId = String(lastRun?.locationId || observedLocationId);
  if (!currentLocationId || runLocationId !== currentLocationId || !lastRun?.decision) return null;
  return {
    framework: journey.agent?.framework,
    frameworkVersion: journey.agent?.frameworkVersion,
    model: lastRun.model,
    decision: lastRun.decision,
    environment,
    trace: lastRun.trace || [],
    degraded: Boolean(lastRun.degraded),
    reason: lastRun.degradedReason || null
  };
}

function createJourneyService(options = {}) {
  const config = options.config || { ai: { configured: false }, weather: { enabled: false }, search: { enabled: false } };
  const store = options.store || createJourneyStore({ ...(options.storeOptions || {}), random: options.random || Math.random });
  const generator = options.generator || generateJournalEntry;
  const fetchImpl = options.fetchImpl || global.fetch;
  const now = options.now || (() => new Date());
  const agentRunner = options.agentRunner || runAjingDecision;
  const generationLocks = new Map();
  const syncLocks = new Map();

  function timestamp() {
    return now().toISOString();
  }

  function create(settings) {
    return store.create(settings);
  }

  function get(id) {
    return store.read(id);
  }

  async function generateStop(journeyId, locationId, agentDecision = null) {
    const journey = store.read(journeyId);
    const location = resolveLocation(locationId);
    const arrivedRoute = journey.route.slice(0, journey.state.currentStopIndex + 1);
    if (!arrivedRoute.includes(location.id)) throw serviceError("location_not_in_journey", "这个地点还没有成为已抵达的旅程事实。");
    const existing = journey.entries.find((entry) => entry.locationId === location.id && entry.status === "ready");
    if (existing) return { journey, entry: existing, reused: true };

    const lockKey = `${journeyId}:${location.id}`;
    if (generationLocks.has(lockKey)) return generationLocks.get(lockKey);
    const task = (async () => {
      store.update(journeyId, (draft) => {
        draft.generation[location.id] = { status: "generating", startedAt: timestamp(), error: null };
        return draft;
      });
      try {
        const entry = await generator({
          journeyId,
          locationId: location.id,
          config,
          fetchImpl,
          now: now(),
          agentDecision,
          routeIds: journey.route,
          journeySnapshot: journey,
          writeMedia: (buffer, extension) => store.writeMedia(journeyId, buffer, extension)
        });
        const updated = store.update(journeyId, (draft) => {
          draft.entries = draft.entries.filter((candidate) => candidate.locationId !== location.id);
          draft.entries.push(entry);
          draft.entries.sort((a, b) => a.routeOrder - b.routeOrder);
          draft.generation[location.id] = { status: "ready", completedAt: timestamp(), error: null };
          addEvent(draft, "journal_bound", `${location.name}已经装订进手账`, entry.content?.headline || "新页面已经寄回", { entryId: entry.id, imageType: entry.image?.type }, timestamp());
          return draft;
        });
        return { journey: updated, entry, reused: false };
      } catch (error) {
        store.update(journeyId, (draft) => {
          draft.generation[location.id] = {
            status: "failed",
            completedAt: timestamp(),
            error: error.name === "AbortError" ? "generation_timeout" : String(error.code || error.message || "generation_failed").slice(0, 120)
          };
          addEvent(draft, "journal_failed", `${location.name}这一页暂时没有写成`, "已有旅程状态不会丢失，可以稍后重试。", {}, timestamp());
          return draft;
        });
        throw error;
      } finally {
        generationLocks.delete(lockKey);
      }
    })();
    generationLocks.set(lockKey, task);
    return task;
  }

  async function observe(journey) {
    const locationId = journey.state.currentLocationId;
    const observationTime = now();
    const weatherConfig = config.weather ? config : { ...config, weather: { enabled: false, timeoutMs: 1000 } };
    const airQualityConfig = config.airQuality ? config : { ...config, airQuality: { enabled: false, timeoutMs: 1000 } };
    const [weather, airQuality, publicWorldData] = await Promise.all([
      getWeather(locationId, weatherConfig),
      getAirQuality(locationId, airQualityConfig),
      getPublicWorldData(locationId, config, observationTime)
    ]);
    const location = resolveLocation(locationId);
    const localTime = getLocalTime(locationId, observationTime);
    const season = seasonFor(observationTime);
    const observedAt = observationTime.toISOString();
    return {
      location,
      localTime,
      season,
      weather,
      airQuality,
      publicWorldData,
      world: buildWorldSnapshot({ location, localTime, season, weather, airQuality, publicWorldData, observedAt }),
      observedAt
    };
  }

  async function runAgent(journey, reason) {
    let environment;
    const handlers = {
      inspectJourney: async () => publicJourneySnapshot(store.read(journey.id)),
      observeEnvironment: async () => {
        environment ||= await observe(store.read(journey.id));
        return environment;
      },
      recallKnowledge: async (query) => searchKnowledge(query, 5),
      researchStory: async (query, researchReason) => {
        const searchConfig = config.search ? config : { ...config, search: { enabled: false, provider: "local-only", allowPublicSearch: false } };
        return { reason: researchReason, ...(await searchWeb(`${resolveLocation(journey.state.currentLocationId).name} ${query}`, searchConfig, 5)) };
      },
      exploreNextPlaces: async (intention) => explorationCandidates({
        currentLocationId: journey.state.currentLocationId,
        visited: journey.route,
        theme: journey.settings?.theme,
        commission: `${journey.settings?.commission || ""} ${intention || ""}`,
        limit: 12
      }).map(({ id, name, region, focus, tags, distanceKm }) => ({ id, name, region, focus, tags, distanceKm }))
    };
    try {
      const run = await agentRunner({ config, reason, journeySnapshot: publicJourneySnapshot(journey), handlers });
      environment ||= run.environment || await observe(journey);
      const decision = normalizeDecision(journey, run.decision || fallbackDecision(journey, environment, reason));
      return { ...run, decision, environment, degraded: !run.decision };
    } catch (error) {
      environment ||= await observe(journey);
      return {
        framework: "@earendil-works/pi-agent-core",
        frameworkVersion: "0.84.4",
        model: null,
        decision: normalizeDecision(journey, fallbackDecision(journey, environment, reason)),
        environment,
        knowledge: null,
        research: null,
        response: "",
        trace: [],
        degraded: true,
        reason: String(error.code || error.message || "pi_agent_unavailable").slice(0, 120)
      };
    }
  }

  function persistAgentRun(journeyId, run, reason) {
    return store.update(journeyId, (draft) => {
      const decision = run.decision;
      const oldEnergy = Number(draft.embodiment?.energy ?? 80);
      draft.embodiment = {
        ...draft.embodiment,
        energy: clamp(oldEnergy + decision.energyDelta, 0, 100),
        comfort: clamp(decision.comfort, 0, 100),
        mood: decision.mood,
        clothing: decision.clothing,
        thought: decision.thought,
        environment: run.environment,
        updatedAt: timestamp()
      };
      draft.state.explorationIntent = decision.action === "continue"
        ? String(decision.nextStopReason || decision.reason || "我已经选好了下一站。").slice(0, 180)
        : decision.reason;
      draft.agent.lastRun = {
        at: timestamp(),
        locationId: draft.state.currentLocationId,
        reason: String(reason || "").slice(0, 300),
        model: run.model,
        degraded: Boolean(run.degraded),
        degradedReason: run.reason || null,
        decision,
        trace: run.trace || []
      };
      draft.agent.status = run.degraded ? "degraded" : "ready";
      const actionLabel = {
        continue: "继续往前走",
        linger: "再多留一会儿",
        rest: "先停下来休息",
        wait_user: "等一等远方的话",
        complete: "在这里收住这一程"
      }[decision.action] || "照着此刻的感觉走";
      addEvent(draft, "agent_decision", `阿镜决定${actionLabel}`, decision.thought, {
        mood: decision.mood,
        clothing: decision.clothing,
        researchStatus: decision.researchStatus,
        framework: draft.agent.framework,
        degraded: Boolean(run.degraded)
      }, timestamp());
      return draft;
    });
  }

  function persistExperienceMemory(journeyId, run, reason) {
    return store.update(journeyId, (draft) => {
      const decision = run.decision;
      const location = resolveLocation(draft.state.currentLocationId);
      const alreadyRemembered = draft.memories.some((memory) =>
        memory?.kind === "experience" && memory?.location?.id === location.id
      );
      if (alreadyRemembered) return draft;
      const occurredAt = timestamp();
      const weather = run.environment?.weather;
      const weatherText = weather?.available
        ? `${weather.condition}，体感 ${weather.apparentTemperatureC ?? weather.temperatureC}℃`
        : "天气服务未返回";
      const memory = {
        id: crypto.randomUUID(),
        kind: "experience",
        occurredAt,
        location: { id: location.id, city: location.region, place: location.name },
        whatHappened: `抵达${location.name}后，阿镜在${weatherText}的环境里选择${decision.action}。`,
        perception: {
          environment: run.environment || null,
          body: {
            energy: draft.embodiment?.energy,
            comfort: draft.embodiment?.comfort,
            clothing: draft.embodiment?.clothing || []
          }
        },
        emotion: { labels: [decision.mood].filter(Boolean), intensity: decision.action === "rest" ? 0.72 : 0.55 },
        action: decision.action,
        outcome: decision.action === "continue"
          ? "已经形成下一段移动意图；下一站与选择理由会在行程中公开。"
          : decision.deliveryFormat === "silent"
            ? "这一刻没有寄信，只留在她自己的经历里。"
            : `她决定${decision.action === "linger" ? "多停留一会" : decision.action === "rest" ? "先休息" : "等待下一步"}。`,
        reflection: String(decision.reason || reason || "").slice(0, 500),
        preferenceUpdates: [{
          key: "journey_pace",
          signal: decision.action,
          delta: decision.action === "linger" || decision.action === "rest" ? 0.04 : 0.02,
          reason: String(decision.reason || "").slice(0, 220)
        }],
        evidence: {
          environmentObservedAt: run.environment?.observedAt || null,
          weatherSource: weather?.source || null,
          decisionModel: run.model || null
        },
        privacy: "private",
        salience: decision.action === "rest" || decision.action === "linger" ? 0.72 : 0.56
      };
      draft.memories.push(memory);
      if (draft.memories.length > 80) draft.memories = draft.memories.slice(-80);
      draft.preferences ||= { learned: [] };
      draft.preferences.learned ||= [];
      const learned = draft.preferences.learned.find((item) => item.key === "journey_pace" && item.signal === decision.action);
      if (learned) {
        learned.strength = clamp(Number(learned.strength || 0.5) + memory.preferenceUpdates[0].delta, 0, 1);
        learned.evidenceCount = Number(learned.evidenceCount || 1) + 1;
        learned.updatedAt = occurredAt;
        learned.lastMemoryId = memory.id;
      } else {
        draft.preferences.learned.push({
          key: "journey_pace",
          signal: decision.action,
          strength: 0.54,
          evidenceCount: 1,
          updatedAt: occurredAt,
          lastMemoryId: memory.id
        });
      }
      addEvent(draft, "memory_reflected", `阿镜记住了${location.name}这一刻`, memory.reflection, { memoryId: memory.id }, occurredAt);
      return draft;
    });
  }

  async function arrivalPipeline(journeyId, reason) {
    const journey = store.read(journeyId);
    const savedRun = reusableArrivalRun(journey);
    const run = savedRun || await runAgent(journey, reason);
    if (!savedRun) persistAgentRun(journeyId, run, reason);
    persistExperienceMemory(journeyId, run, reason);
    if (run.decision.deliveryFormat !== "silent") {
      await generateStop(journeyId, journey.state.currentLocationId, run.decision);
    } else {
      store.update(journeyId, (draft) => {
        const alreadyQuiet = draft.events.some((item) =>
          item?.type === "quiet_moment" && item?.data?.locationId === draft.state.currentLocationId
        );
        if (!alreadyQuiet) {
          addEvent(draft, "quiet_moment", `${resolveLocation(draft.state.currentLocationId).name}这一刻没有寄信`, "我只把这段路收进记忆，等以后再回头看。", { deliveryFormat: "silent", locationId: draft.state.currentLocationId }, timestamp());
        }
        return draft;
      });
    }
    return { journey: store.read(journeyId), run };
  }

  function beginNextSegment(journeyId, at = now(), decision = null) {
    return store.update(journeyId, (draft) => {
      const effectiveDecision = decision || draft.agent?.lastRun?.decision || {};
      if (effectiveDecision.action === "complete") {
        draft.state.phase = "completed";
        draft.state.completedAt = at.toISOString();
        draft.state.nextLocationId = null;
        draft.status = "completed";
        addEvent(draft, "journey_completed", "我想在这里收住这一程", "已经走过的路和写下的页面，都会继续留在手帐里。", {}, at.toISOString());
        return draft;
      }
      const requested = String(effectiveDecision.nextLocationId || draft.state.nextLocationId || "").trim();
      const target = LOCATIONS[requested] && requested !== draft.state.currentLocationId && !draft.route.includes(requested)
        ? LOCATIONS[requested]
        : fallbackNextLocation(draft);
      draft.route.push(target.id);
      draft.state.phase = "travelling";
      draft.state.segmentStartedAt = at.toISOString();
      draft.state.segmentProgress = 0;
      draft.state.segmentDurationMs = draft.settings.durationMinutes * 60 * 1000;
      draft.state.segmentRealDurationSeconds = null;
      draft.state.segmentSpeedMultiplier = null;
      draft.state.segmentTimingSource = "pace-fallback";
      draft.state.segmentTimingKey = null;
      draft.state.nextLocationId = target.id;
      draft.state.nextLocationRevealed = true;
      draft.state.explorationIntent = String(effectiveDecision.nextStopReason || `我想去${target.name}，沿着“${target.focus}”继续看看。`).slice(0, 180);
      draft.state.nextEventAt = new Date(at.getTime() + draft.state.segmentDurationMs).toISOString();
      draft.state.waitingSince = null;
      draft.state.decisionDeadlineAt = null;
      draft.state.pausedAt = null;
      addEvent(draft, "departed", `从${resolveLocation(draft.state.currentLocationId).name}前往${target.name}`, draft.state.explorationIntent, { from: draft.state.currentLocationId, to: target.id, destinationHidden: false }, at.toISOString());
      return draft;
    });
  }

  async function start(journeyId) {
    let journey = store.read(journeyId);
    if (journey.state.phase !== "draft") return sync(journeyId);
    const startLocation = resolveLocation(journey.state.originLocationId || journey.state.currentLocationId);
    store.update(journeyId, (draft) => {
      draft.state.phase = "arrived";
      draft.state.startedAt = timestamp();
      draft.state.lastSyncedAt = timestamp();
      addEvent(draft, "journey_started", `我从${startLocation.name}开始这一程`, draft.settings.commission, { theme: draft.settings.theme, startLocationId: startLocation.id }, timestamp());
      return draft;
    });
    const { run } = await arrivalPipeline(journeyId, `旅程刚刚开始。先在${startLocation.name}建立环境快照、身体状态与第一张抵达页，再自主选择并明确告诉用户下一站；不要沿用预设游线。`);
    journey = run.decision.action === "continue"
      ? beginNextSegment(journeyId, now(), run.decision)
      : store.update(journeyId, (draft) => {
        const plannedNext = fallbackNextLocation(draft);
        draft.state.phase = "waiting_decision";
        draft.state.nextLocationId = plannedNext.id;
        draft.state.nextLocationRevealed = true;
        draft.state.explorationIntent = `等这一刻停稳，我想去${plannedNext.name}，沿着“${plannedNext.focus}”继续看看。`.slice(0, 180);
        draft.state.waitingSince = timestamp();
        draft.state.decisionDeadlineAt = new Date(now().getTime() + (run.decision.action === "rest" ? 10 * 60_000 : DECISION_WINDOW_MS)).toISOString();
        return draft;
      });
    return journey;
  }

  async function doSync(journeyId) {
    let journey = store.read(journeyId);
    const at = now();
    if (["draft", "completed", "failed"].includes(journey.state.phase)) return journey;

    if (journey.state.phase === "arrived") {
      const arrivedName = resolveLocation(journey.state.currentLocationId).name;
      const { run } = await arrivalPipeline(journeyId, `恢复${arrivedName}尚未完成的抵达记录。重新确认这一站的环境、身体与内容，再决定下一步。`);
      if (run.decision.action === "complete") return beginNextSegment(journeyId, at, run.decision);
      return store.update(journeyId, (draft) => {
        draft.state.phase = "waiting_decision";
        draft.state.waitingSince = timestamp();
        const waitMs = run.decision.action === "rest" ? 10 * 60 * 1000 : run.decision.action === "linger" ? 3 * 60 * 1000 : DECISION_WINDOW_MS;
        draft.state.decisionDeadlineAt = new Date(now().getTime() + waitMs).toISOString();
        addEvent(draft, "decision_window", "这一站先停一会儿", "你可以让阿镜多留一会，或让她在合适的时候自己选择下一站。", { defaultAction: run.decision.action }, timestamp());
        return draft;
      });
    }

    if (journey.state.phase === "waiting_decision") {
      const deadline = Date.parse(journey.state.decisionDeadlineAt || "");
      if (Number.isFinite(deadline) && at.getTime() >= deadline) return beginNextSegment(journeyId, at);
      return journey;
    }
    if (journey.state.phase !== "travelling") return journey;

    const startedAt = Date.parse(journey.state.segmentStartedAt || "");
    if (!Number.isFinite(startedAt)) return beginNextSegment(journeyId, at);
    const ratio = clamp((at.getTime() - startedAt) / Math.max(1000, journey.state.segmentDurationMs), 0, 1);
    journey = store.update(journeyId, (draft) => {
      draft.state.segmentProgress = ratio;
      draft.state.routeProgress = ratio;
      draft.state.lastSyncedAt = at.toISOString();
      return draft;
    });
    if (ratio < 1) return journey;

    journey = store.update(journeyId, (draft) => {
      draft.state.currentStopIndex = Math.min(draft.route.length - 1, draft.state.currentStopIndex + 1);
      draft.state.currentLocationId = draft.route[draft.state.currentStopIndex];
      draft.state.nextLocationId = null;
      draft.state.nextLocationRevealed = false;
      draft.state.segmentProgress = 1;
      draft.state.routeProgress = 1;
      draft.state.phase = "arrived";
      draft.state.nextEventAt = null;
      addEvent(draft, "arrived", `抵达${resolveLocation(draft.state.currentLocationId).name}`, "阿镜正在感知环境并整理新的手账页。", { locationId: draft.state.currentLocationId }, at.toISOString());
      return draft;
    });
    const arrivedName = resolveLocation(journey.state.currentLocationId).name;
    const { run } = await arrivalPipeline(journeyId, `刚刚抵达${arrivedName}。结合共同话题、环境与既有记忆，决定此刻如何停留、写什么；如果继续，重新探索并自主选择下一站。`);
    journey = store.read(journeyId);
    if (run.decision.action === "complete") return beginNextSegment(journeyId, at, run.decision);
    return store.update(journeyId, (draft) => {
      draft.state.phase = "waiting_decision";
      draft.state.waitingSince = timestamp();
      const waitMs = run.decision.action === "rest" ? 10 * 60 * 1000 : run.decision.action === "linger" ? 3 * 60 * 1000 : DECISION_WINDOW_MS;
      draft.state.decisionDeadlineAt = new Date(now().getTime() + waitMs).toISOString();
      addEvent(draft, "decision_window", "这一站先停一会儿", "你可以让阿镜多留一会，或让她在合适的时候自己选择下一站。", { defaultAction: run.decision.action }, timestamp());
      return draft;
    });
  }

  async function sync(journeyId) {
    if (syncLocks.has(journeyId)) return syncLocks.get(journeyId);
    const task = doSync(journeyId).finally(() => syncLocks.delete(journeyId));
    syncLocks.set(journeyId, task);
    return task;
  }

  async function command(journeyId, input = {}) {
    const action = String(input.action || "").trim();
    const at = now();
    if (action === "sync_route_timing") {
      const current = store.read(journeyId);
      if (current.state.phase !== "travelling") return current;
      const fromLocationId = String(input.fromLocationId || "").trim();
      const toLocationId = String(input.toLocationId || "").trim();
      const currentFrom = current.route[current.state.currentStopIndex];
      const currentTo = current.route[current.state.currentStopIndex + 1];
      if (!fromLocationId || !toLocationId || fromLocationId !== currentFrom || toLocationId !== currentTo) return current;
      const requestedRealDuration = Number(input.realDurationSeconds);
      if (!Number.isFinite(requestedRealDuration) || requestedRealDuration <= 0) {
        throw serviceError("invalid_route_timing", "道路时间无效，请重新计算路线。");
      }
      const timing = calculateRouteTiming(current.settings, requestedRealDuration);
      const routeAvailable = input.routeAvailable !== false;
      const timingSource = routeAvailable
        ? timing.source
        : timing.source.replace("road-route", "mode-speed-fallback");
      const timingKey = [fromLocationId, toLocationId, current.settings.mode, current.settings.pace, timing.realDurationSeconds, timingSource].join("|");
      if (current.state.segmentTimingKey === timingKey) return current;
      store.update(journeyId, (draft) => {
        if (draft.state.phase !== "travelling") return draft;
        const draftFrom = draft.route[draft.state.currentStopIndex];
        const draftTo = draft.route[draft.state.currentStopIndex + 1];
        if (draftFrom !== fromLocationId || draftTo !== toLocationId) return draft;
        const startedAt = Date.parse(draft.state.segmentStartedAt || at.toISOString());
        draft.state.segmentDurationMs = timing.segmentDurationMs;
        draft.state.segmentRealDurationSeconds = timing.realDurationSeconds;
        draft.state.segmentSpeedMultiplier = timing.speedMultiplier;
        draft.state.segmentTimingSource = timingSource;
        draft.state.segmentTimingKey = timingKey;
        draft.state.segmentProgress = clamp((at.getTime() - startedAt) / timing.segmentDurationMs, 0, 1);
        draft.state.routeProgress = draft.state.segmentProgress;
        draft.state.nextEventAt = new Date(startedAt + timing.segmentDurationMs).toISOString();
        return draft;
      });
      return sync(journeyId);
    }

    await sync(journeyId);
    let journey = store.read(journeyId);
    if (journey.state.phase === "completed") return journey;

    if (action === "pause") {
      if (!["travelling", "waiting_decision", "arrived"].includes(journey.state.phase)) return journey;
      return store.update(journeyId, (draft) => {
        draft.state.pausedFromPhase = draft.state.phase;
        draft.state.phase = "paused";
        draft.state.pausedAt = at.toISOString();
        addEvent(draft, "paused", "旅程暂停", "阿镜会保留现在的位置和状态。", {}, at.toISOString());
        return draft;
      });
    }
    if (action === "resume") {
      if (journey.state.phase !== "paused") return journey;
      return store.update(journeyId, (draft) => {
        const pausedAt = Date.parse(draft.state.pausedAt || at.toISOString());
        const pausedDurationMs = Math.max(0, at.getTime() - pausedAt);
        const resumePhase = ["travelling", "waiting_decision", "arrived"].includes(draft.state.pausedFromPhase)
          ? draft.state.pausedFromPhase
          : "travelling";
        if (resumePhase === "travelling") {
          const segmentStartedAt = Date.parse(draft.state.segmentStartedAt || at.toISOString());
          draft.state.segmentStartedAt = new Date(segmentStartedAt + pausedDurationMs).toISOString();
          draft.state.nextEventAt = new Date(Date.parse(draft.state.segmentStartedAt) + draft.state.segmentDurationMs).toISOString();
        } else if (resumePhase === "waiting_decision" && draft.state.decisionDeadlineAt) {
          draft.state.decisionDeadlineAt = new Date(Date.parse(draft.state.decisionDeadlineAt) + pausedDurationMs).toISOString();
        }
        draft.state.phase = resumePhase;
        draft.state.pausedAt = null;
        draft.state.pausedFromPhase = null;
        addEvent(draft, "resumed", "旅程继续", draft.state.explorationIntent || "她仍没有公开下一站。", {}, at.toISOString());
        return draft;
      });
    }
    if (action === "complete") {
      return store.update(journeyId, (draft) => {
        draft.state.phase = "completed";
        draft.state.completedAt = at.toISOString();
        draft.state.nextEventAt = null;
        draft.state.decisionDeadlineAt = null;
        draft.state.pausedAt = null;
        draft.state.pausedFromPhase = null;
        draft.status = "completed";
        addEvent(draft, "journey_completed", "这一程已经收好", "已经走过的轨迹和见闻会继续留在手账里。", { requestedBy: "user" }, at.toISOString());
        return draft;
      });
    }
    if (action === "linger") {
      const minutes = clamp(input.minutes || 5, 1, 60);
      return store.update(journeyId, (draft) => {
        draft.state.phase = "waiting_decision";
        draft.state.waitingSince = at.toISOString();
        draft.state.decisionDeadlineAt = new Date(at.getTime() + minutes * 60 * 1000).toISOString();
        addEvent(draft, "user_linger", `用户请阿镜多留 ${minutes} 分钟`, String(input.note || "再慢一点看看这里。"), {}, at.toISOString());
        return draft;
      });
    }
    if (action === "next") {
      if (journey.state.phase === "travelling") {
        store.update(journeyId, (draft) => {
          draft.state.segmentStartedAt = new Date(at.getTime() - draft.state.segmentDurationMs).toISOString();
          addEvent(draft, "user_fast_forward", "用户快进到下一站", "路线顺序不变，阿镜将完成抵达与装订。", {}, at.toISOString());
          return draft;
        });
        return sync(journeyId);
      }
      if (["waiting_decision", "arrived", "paused"].includes(journey.state.phase)) return beginNextSegment(journeyId, at);
      return journey;
    }
    if (action === "commission") {
      const note = String(input.note || "").trim().slice(0, 500);
      if (!note) throw serviceError("invalid_command", "请写下想让阿镜继续留意的线索。");
      return store.update(journeyId, (draft) => {
        draft.memories.push({ id: crypto.randomUUID(), kind: "user_clue", at: at.toISOString(), text: note });
        draft.decisions.push({ id: crypto.randomUUID(), action, at: at.toISOString(), note });
        addEvent(draft, "user_clue", "收到一枚来自你的远方线索", note, {}, at.toISOString());
        return draft;
      });
    }
    if (action === "ai_decide") {
      // 行进中的下一站已经是 Agent 刚刚提交的决策。重复执行会把
      // 另一个候选地追加到 route，造成“写进路线却没有抵达”的假轨迹。
      if (journey.state.phase === "travelling") return journey;
      const run = await runAgent(journey, "对方把下一步交给阿镜决定。请结合天气、身体、共同话题、记忆与路线，做一个有后果的选择。");
      journey = persistAgentRun(journeyId, run, "用户让阿镜决定下一步");
      if (run.decision.action === "continue") return beginNextSegment(journeyId, at, run.decision);
      const minutes = run.decision.action === "rest" ? 10 : 3;
      return command(journeyId, { action: "linger", minutes, note: run.decision.reason });
    }
    throw serviceError("invalid_command", "这个旅程指令暂不支持。");
  }

  async function processDueJourneys() {
    const active = store.list().filter((journey) => !["draft", "completed", "failed"].includes(journey.state.phase));
    const results = [];
    for (const journey of active) {
      try { results.push(await sync(journey.id)); } catch { /* 单个旅程失败不阻塞其他旅程。 */ }
    }
    return results;
  }

  function rememberExchange(journeyId, question, answer, options = {}) {
    if (!journeyId) return null;
    return store.update(journeyId, (draft) => {
      const at = timestamp();
      const replyToEntryId = String(options.replyToEntryId || "").trim();
      const isReply = Boolean(replyToEntryId && draft.entries.some((entry) => entry.id === replyToEntryId));
      draft.memories.push({
        id: crypto.randomUUID(),
        kind: isReply ? "shared_reply" : "conversation",
        at,
        text: String(question || "").slice(0, 800),
        response: String(answer || "").slice(0, 1200),
        replyToEntryId: isReply ? replyToEntryId : null,
        scope: isReply ? "relationship_private" : "private",
        authorizedByUser: true
      });
      if (draft.memories.length > 80) draft.memories = draft.memories.slice(-80);
      addEvent(
        draft,
        isReply ? "postcard_reply" : "conversation",
        isReply ? "你回了阿镜一封信" : "你和阿镜在路上聊了一句",
        String(question || "").slice(0, 260),
        isReply ? { replyToEntryId, memoryScope: "relationship_private" } : {},
        at
      );
      return draft;
    });
  }

  function recordCommerceRecommendation(journeyId, recommendation) {
    if (!journeyId || !recommendation?.id) return null;
    return store.update(journeyId, (draft) => {
      const alreadyRecorded = (draft.events || []).some((event) =>
        event?.type === "commerce_recommended" && event?.data?.discoveryId === recommendation.id
      );
      if (alreadyRecorded) return draft;
      addEvent(
        draft,
        "commerce_recommended",
        `阿镜克制地提到${String(recommendation.title || "一条第三方入口").slice(0, 80)}`,
        String(recommendation.recommendationReason || "这条入口与刚才的对话直接相关。").slice(0, 180),
        {
          discoveryId: String(recommendation.id).slice(0, 100),
          locationId: String(recommendation.locationId || draft.state.currentLocationId || "").slice(0, 60),
          evidenceSummary: String(recommendation.evidenceSummary || "").slice(0, 180)
        },
        timestamp()
      );
      return draft;
    });
  }

  function media(journeyId, filename) {
    return store.resolveMedia(journeyId, filename);
  }

  return { create, get, start, sync, command, rememberExchange, recordCommerceRecommendation, processDueJourneys, generateStop, media, store };
}

module.exports = {
  createJourneyService,
  serviceError,
  fallbackDecision,
  fallbackPresenceThought,
  publicJourneySnapshot,
  calculateRouteTiming,
  PACE_SPEED_MULTIPLIERS
};
