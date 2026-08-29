"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createJourneyStore } = require("./journey-store");
const { createJourneyService, fallbackDecision, calculateRouteTiming } = require("./journey-service");

test("真实道路时间按旅程节奏换算为地图推进时长", () => {
  assert.deepEqual(calculateRouteTiming({ pace: "实时同行" }, 7200), {
    realDurationSeconds: 7200,
    segmentDurationMs: 7200000,
    speedMultiplier: 1,
    source: "road-route"
  });
  assert.equal(calculateRouteTiming({ pace: "沉浸节奏" }, 7200).segmentDurationMs, 720000);
  assert.equal(calculateRouteTiming({ pace: "快速云游" }, 7200).segmentDurationMs, 180000);
  assert.deepEqual(calculateRouteTiming({ pace: "自定义", durationMinutes: 15 }, 7200), {
    realDurationSeconds: 7200,
    segmentDurationMs: 900000,
    speedMultiplier: 8,
    source: "road-route-custom"
  });
});

test("无模型时的此刻正文仍是有段落的旅途片段", () => {
  const journey = {
    state: { currentLocationId: "guiyang" },
    embodiment: { energy: 71 },
    settings: { commission: "替我留意雨天如何改变人的脚步。" },
    route: ["guiyang"]
  };
  const environment = {
    weather: {
      available: true,
      condition: "小雨",
      apparentTemperatureC: 28,
      precipitationMm: 0.8,
      windKph: 9
    }
  };
  const decision = fallbackDecision(journey, environment, "抵达贵阳");

  assert.match(decision.thought, /雨没有下得很急/);
  assert.match(decision.thought, /\n\n/);
  assert.match(decision.thought, /衣服|脚步/);
  assert.match(decision.thought, /甲秀楼/);
  assert.doesNotMatch(decision.thought, /这不是背景信息|根据环境快照/);
  assert.ok(decision.thought.length >= 150);
});

test("站点生成结果写入旅程且重复请求幂等复用", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-service-"));
  const store = createJourneyStore({ rootDir, now: () => new Date("2026-08-29T08:00:00.000Z") });
  let generationCount = 0;
  const generator = async ({ locationId }) => {
    generationCount += 1;
    return { id: "entry-1", locationId, routeOrder: 1, status: "ready", content: {}, image: {}, sources: [] };
  };
  const service = createJourneyService({ config: {}, store, generator, now: () => new Date("2026-08-29T08:00:00.000Z") });
  try {
    const journey = service.create({ mode: "自驾" });
    const first = await service.generateStop(journey.id, "guiyang");
    const second = await service.generateStop(journey.id, "guiyang");
    assert.equal(first.reused, false);
    assert.equal(second.reused, true);
    assert.equal(generationCount, 1);
    assert.equal(service.get(journey.id).generation.guiyang.status, "ready");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("多站内容按路线顺序渐进写入并可由新服务实例恢复", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-multi-stop-"));
  const store = createJourneyStore({ rootDir, now: () => new Date("2026-08-29T08:00:00.000Z") });
  const routeOrder = { guiyang: 1, xiuwen: 2 };
  const generator = async ({ locationId }) => ({
    id: `entry-${locationId}`,
    locationId,
    routeOrder: routeOrder[locationId],
    status: "ready",
    content: { headline: locationId },
    image: { type: "project-asset" },
    sources: [{ id: 1, title: "测试来源", url: "https://example.com" }]
  });
  const now = () => new Date("2026-08-29T08:00:00.000Z");
  try {
    const service = createJourneyService({ config: {}, store, generator, now });
    const journey = service.create({ mode: "自驾" });
    await service.generateStop(journey.id, "guiyang");
    store.update(journey.id, (draft) => {
      draft.route.push("xiuwen");
      draft.state.currentStopIndex = 1;
      draft.state.currentLocationId = "xiuwen";
      return draft;
    });
    await service.generateStop(journey.id, "xiuwen");

    const restoredService = createJourneyService({ config: {}, store, generator, now });
    const restored = restoredService.get(journey.id);
    assert.deepEqual(restored.entries.map((entry) => entry.locationId), ["guiyang", "xiuwen"]);
    assert.equal(restored.generation.guiyang.status, "ready");
    assert.equal(restored.generation.xiuwen.status, "ready");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("生成失败会持久化，之后重试成功会替换为就绪状态", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-retry-"));
  const store = createJourneyStore({ rootDir, now: () => new Date("2026-08-29T08:00:00.000Z") });
  let attempts = 0;
  const generator = async ({ locationId }) => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary_upstream_failure");
    return { id: "entry-retried", locationId, routeOrder: 1, status: "ready", content: {}, image: {}, sources: [] };
  };
  const now = () => new Date("2026-08-29T08:00:00.000Z");
  try {
    const service = createJourneyService({ config: {}, store, generator, now });
    const journey = service.create({ mode: "自驾" });
    await assert.rejects(service.generateStop(journey.id, "guiyang"), /temporary_upstream_failure/);

    const failed = createJourneyService({ config: {}, store, generator, now }).get(journey.id);
    assert.equal(failed.generation.guiyang.status, "failed");
    assert.match(failed.generation.guiyang.error, /temporary_upstream_failure/);

    const retried = await service.generateStop(journey.id, "guiyang");
    assert.equal(retried.entry.id, "entry-retried");
    assert.equal(retried.journey.generation.guiyang.status, "ready");
    assert.equal(retried.journey.entries.length, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("服务重启后会恢复已抵达但尚未完成的站点，不混用上一站环境", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-arrival-recovery-"));
  const now = () => new Date("2026-08-29T08:00:00.000Z");
  const store = createJourneyStore({ rootDir, now });
  const generatedLocations = [];
  const agentLocations = [];
  const service = createJourneyService({
    config: { ai: { configured: false }, weather: { enabled: false }, search: { enabled: false } },
    store,
    now,
    generator: async ({ locationId }) => {
      generatedLocations.push(locationId);
      return { id: `entry-${locationId}`, locationId, routeOrder: 2, status: "ready", content: {}, image: {}, sources: [] };
    },
    agentRunner: async ({ journeySnapshot }) => {
      const locationId = journeySnapshot.state.currentLocationId;
      agentLocations.push(locationId);
      return {
        model: "test-model",
        environment: { location: { id: locationId, name: locationId }, weather: { available: false } },
        decision: {
          action: "linger",
          nextLocationId: null,
          mood: `刚到${locationId}`,
          clothing: ["轻便外套"],
          comfort: 70,
          energyDelta: -1,
          thought: `这是${locationId}自己的环境与正文，不再沿用上一站。`,
          reason: "先看清这一站。",
          contentIntent: "记录当前地点。",
          deliveryFormat: "note",
          whyForUser: "这一站已经重新接上。",
          researchStatus: "not-needed"
        },
        trace: []
      };
    }
  });
  try {
    const created = service.create({ durationMinutes: 1 });
    store.update(created.id, (draft) => {
      draft.route.push("duyun");
      draft.state.currentStopIndex = 1;
      draft.state.currentLocationId = "duyun";
      draft.state.phase = "arrived";
      draft.embodiment.environment = { location: { id: "chishui", name: "赤水河谷" }, weather: { available: true, condition: "小雨" } };
      draft.embodiment.thought = "这是上一站赤水河谷的旧正文。";
      return draft;
    });

    const recovered = await service.sync(created.id);

    assert.deepEqual(agentLocations, ["duyun"]);
    assert.deepEqual(generatedLocations, ["duyun"]);
    assert.equal(recovered.state.phase, "waiting_decision");
    assert.equal(recovered.embodiment.environment.location.id, "duyun");
    assert.match(recovered.embodiment.thought, /都匀|duyun/);
    assert.equal(recovered.agent.lastRun.locationId, "duyun");
    assert.equal(recovered.entries.at(-1).locationId, "duyun");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("PI Agent 自主选择下一站并驱动环境具身与自动装订闭环", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-pi-loop-"));
  let clock = new Date("2026-08-29T08:00:00.000Z");
  const now = () => new Date(clock);
  const store = createJourneyStore({ rootDir, now });
  const routeOrder = { guiyang: 1, xiuwen: 2, zunyi: 3, hailongtun: 4, chishui: 5 };
  const generator = async ({ locationId, agentDecision }) => ({
    id: `entry-${locationId}`,
    locationId,
    locationName: locationId,
    routeOrder: routeOrder[locationId],
    status: "ready",
    content: { headline: `${locationId}-${agentDecision.mood}` },
    image: { type: "project-asset" },
    sources: [],
    meta: { generatedAt: now().toISOString() }
  });
  let agentRuns = 0;
  const agentRunner = async ({ handlers }) => {
    agentRuns += 1;
    const inspected = await handlers.inspectJourney();
    assert.ok(inspected.state.currentLocationId);
    assert.ok(inspected.preferences);
    if (agentRuns > 1) assert.ok(inspected.preferences.learned.length > 0);
    return {
      framework: "@earendil-works/pi-agent-core",
      frameworkVersion: "0.84.4",
      model: "MiniMax-M3",
      environment: {
        season: "夏季",
        weather: { available: true, condition: "小雨", apparentTemperatureC: 22, relativeHumidityPercent: 86, windKph: 9 }
      },
      decision: {
        action: "continue",
        nextLocationId: agentRuns === 1 ? "xiuwen" : "zunyi",
        nextStopReason: agentRuns === 1 ? "先沿困境与行动的线索去修文。" : "再看看历史转折如何进入城市生活。",
        mood: "雨里更愿意慢一点",
        clothing: ["薄外套", "折叠伞", "防滑鞋"],
        comfort: 68,
        energyDelta: -4,
        thought: "湿度和小雨让我放慢脚步，也改变了今天愿意停留的位置。",
        reason: "天气与委托共同影响选择。",
        contentIntent: "记录雨如何改变一段贵州旅程。",
        researchStatus: "not-needed"
      },
      trace: [{ type: "tool_end", tool: "observe_environment", ok: true }]
    };
  };
  const service = createJourneyService({
    config: { ai: { configured: false }, weather: { enabled: false }, search: { enabled: false, provider: "local-only", allowPublicSearch: false } },
    store,
    generator,
    agentRunner,
    now
  });
  try {
    const created = service.create({
      mode: "自驾",
      pace: "快速云游",
      durationMinutes: 1,
      theme: "贵州美食与日常生活",
      commission: "多看看雨天里普通人的生活。"
    });
    assert.equal(created.state.phase, "draft");
    assert.deepEqual(created.route, ["guiyang"]);
    assert.equal(created.state.nextLocationId, null);
    assert.equal(created.settings.theme, "贵州美食与日常生活");

    const started = await service.start(created.id);
    assert.equal(started.state.phase, "travelling");
    assert.deepEqual(started.route, ["guiyang", "xiuwen"]);
    assert.equal(started.state.nextLocationRevealed, true);
    assert.equal(started.state.explorationIntent, "先沿困境与行动的线索去修文。");
    assert.equal(started.state.explorationIntent.includes("修文"), true);
    assert.equal(started.entries.length, 1);
    assert.equal(started.memories.some((memory) => memory.kind === "experience"), true);
    assert.equal(started.agent.framework, "@earendil-works/pi-agent-core");
    assert.deepEqual(started.embodiment.clothing, ["薄外套", "折叠伞", "防滑鞋"]);

    const repeatedDecision = await service.command(created.id, { action: "ai_decide" });
    assert.deepEqual(repeatedDecision.route, ["guiyang", "xiuwen"]);
    assert.equal(repeatedDecision.state.nextLocationId, "xiuwen");
    assert.equal(agentRuns, 1);

    clock = new Date("2026-08-29T08:01:01.000Z");
    const arrived = await service.sync(created.id);
    assert.equal(arrived.state.currentLocationId, "xiuwen");
    assert.equal(arrived.state.phase, "waiting_decision");
    assert.deepEqual(arrived.entries.map((entry) => entry.locationId), ["guiyang", "xiuwen"]);
    assert.equal(agentRuns, 2);

    const remembered = await service.command(created.id, { action: "commission", note: "下一站多留意早餐。" });
    assert.equal(remembered.memories.at(-1).text, "下一站多留意早餐。");
    const continuing = await service.command(created.id, { action: "next" });
    assert.equal(continuing.state.phase, "travelling");
    assert.equal(continuing.state.nextLocationId, "zunyi");
    assert.deepEqual(continuing.route, ["guiyang", "xiuwen", "zunyi"]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("Agent 选择安静不寄时保留经历记忆，但不生成或装订来信", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-silent-memory-"));
  const now = () => new Date("2026-08-29T08:00:00.000Z");
  const store = createJourneyStore({ rootDir, now });
  let generationCount = 0;
  const service = createJourneyService({
    config: { ai: { configured: false }, weather: { enabled: false }, search: { enabled: false } },
    store,
    generator: async () => { generationCount += 1; throw new Error("silent_should_not_generate"); },
    agentRunner: async () => ({
      model: "MiniMax-M3",
      environment: { observedAt: now().toISOString(), weather: { available: false } },
      decision: {
        action: "linger",
        nextLocationId: null,
        mood: "刚到，想先安静一会",
        clothing: ["薄外套"],
        comfort: 70,
        energyDelta: -2,
        thought: "这一刻先留给自己。",
        reason: "刚抵达，还没有形成值得寄出的内容。",
        contentIntent: "先观察，不产出。",
        deliveryFormat: "silent",
        whyForUser: "安静比硬写一封到站通知更诚实。",
        researchStatus: "not-needed"
      },
      trace: []
    }),
    now
  });
  try {
    const created = service.create({ durationMinutes: 1 });
    const started = await service.start(created.id);
    assert.equal(generationCount, 0);
    assert.equal(started.entries.length, 0);
    assert.ok(started.state.nextLocationId);
    assert.notEqual(started.state.nextLocationId, started.state.currentLocationId);
    assert.equal(started.state.nextLocationRevealed, true);
    assert.match(started.state.explorationIntent, /等这一刻停稳，我想去/);
    assert.equal(started.memories.some((memory) => memory.kind === "experience"), true);
    assert.equal(started.events.some((event) => event.type === "quiet_moment"), true);
    assert.equal(started.preferences.learned.length, 1);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("用户回复具体来信后形成带关联关系的共同记忆", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-postcard-reply-"));
  const now = () => new Date("2026-08-29T08:00:00.000Z");
  const store = createJourneyStore({ rootDir, now });
  const service = createJourneyService({ config: {}, store, now });
  try {
    const created = service.create({});
    store.update(created.id, (draft) => {
      draft.entries.push({ id: "entry-letter-1", locationId: "guiyang", routeOrder: 1, status: "ready", content: {} });
      return draft;
    });
    const updated = service.rememberExchange(
      created.id,
      "这场雨让我想起小时候的铁皮棚。",
      "我会记住，以后遇到贵州的雨再替我们听一听。",
      { replyToEntryId: "entry-letter-1" }
    );
    const memory = updated.memories.at(-1);
    assert.equal(memory.kind, "shared_reply");
    assert.equal(memory.replyToEntryId, "entry-letter-1");
    assert.equal(memory.scope, "relationship_private");
    assert.equal(updated.events.at(-1).type, "postcard_reply");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("旅程管理可暂停等待中的阿镜、原地继续并收好本程", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-journey-management-"));
  let clock = new Date("2026-08-29T08:00:00.000Z");
  const now = () => clock;
  const store = createJourneyStore({ rootDir, now });
  const service = createJourneyService({ config: {}, store, now });
  try {
    const created = service.create({});
    store.update(created.id, (draft) => {
      draft.state.phase = "waiting_decision";
      draft.state.waitingSince = clock.toISOString();
      draft.state.decisionDeadlineAt = "2026-08-29T08:10:00.000Z";
      return draft;
    });

    const paused = await service.command(created.id, { action: "pause" });
    assert.equal(paused.state.phase, "paused");
    assert.equal(paused.state.pausedFromPhase, "waiting_decision");

    clock = new Date("2026-08-29T08:02:00.000Z");
    const resumed = await service.command(created.id, { action: "resume" });
    assert.equal(resumed.state.phase, "waiting_decision");
    assert.equal(resumed.state.pausedFromPhase, null);
    assert.equal(resumed.state.decisionDeadlineAt, "2026-08-29T08:12:00.000Z");

    const completed = await service.command(created.id, { action: "complete" });
    assert.equal(completed.state.phase, "completed");
    assert.equal(completed.status, "completed");
    assert.equal(completed.events.at(-1).type, "journey_completed");
    assert.equal(completed.events.at(-1).data.requestedBy, "user");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("客户端算路结果会校准当前路段计时，并拒绝过期路段覆盖", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-route-timing-"));
  const clock = new Date("2026-08-29T08:00:00.000Z");
  const now = () => new Date(clock);
  const store = createJourneyStore({ rootDir, now });
  const service = createJourneyService({ config: {}, store, now });
  try {
    const created = service.create({ mode: "步行", pace: "沉浸节奏", durationMinutes: 30 });
    store.update(created.id, (draft) => {
      draft.route = ["guiyang", "xiuwen"];
      draft.state.phase = "travelling";
      draft.state.currentStopIndex = 0;
      draft.state.currentLocationId = "guiyang";
      draft.state.nextLocationId = "xiuwen";
      draft.state.segmentStartedAt = clock.toISOString();
      draft.state.nextEventAt = "2026-08-29T08:30:00.000Z";
      return draft;
    });

    const synced = await service.command(created.id, {
      action: "sync_route_timing",
      fromLocationId: "guiyang",
      toLocationId: "xiuwen",
      realDurationSeconds: 7200
    });
    assert.equal(synced.state.segmentRealDurationSeconds, 7200);
    assert.equal(synced.state.segmentDurationMs, 12 * 60 * 1000);
    assert.equal(synced.state.segmentSpeedMultiplier, 10);
    assert.equal(synced.state.segmentTimingSource, "road-route");
    assert.equal(synced.state.nextEventAt, "2026-08-29T08:12:00.000Z");

    const stale = await service.command(created.id, {
      action: "sync_route_timing",
      fromLocationId: "xiuwen",
      toLocationId: "zunyi",
      realDurationSeconds: 18000
    });
    assert.equal(stale.state.segmentRealDurationSeconds, 7200);
    assert.equal(stale.state.segmentDurationMs, 12 * 60 * 1000);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
