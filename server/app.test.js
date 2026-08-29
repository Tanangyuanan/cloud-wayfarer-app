"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createRequestHandler } = require("./app");
const { searchKnowledge } = require("./knowledge");
const { getLocalTime } = require("./tools");
const { createUserMemoryStore } = require("./user-memory-store");

function testConfig() {
  return {
    ai: { enabled: false, configured: false, baseUrl: "", apiKey: "", model: "", timeoutMs: 100 },
    weather: { enabled: false, timeoutMs: 100 },
    search: { provider: "local-only", allowPublicSearch: false, timeoutMs: 100, tavilyKey: "", braveKey: "", serperKey: "" }
  };
}

async function invoke({ method = "GET", url = "/", body, config = testConfig(), journeyService, userMemoryStore, synthesizeSpeech, commerceRecommender } = {}) {
  const handler = createRequestHandler({ config, journeyService, userMemoryStore, synthesizeSpeech, commerceRecommender, now: () => new Date("2026-08-29T05:30:00.000Z") });
  const payload = body == null ? null : Buffer.from(JSON.stringify(body));
  const request = {
    method,
    url,
    headers: {},
    socket: { remoteAddress: "test-client" },
    async *[Symbol.asyncIterator]() {
      if (payload) yield payload;
    }
  };
  const result = { status: 0, headers: {}, raw: "", binary: null };
  const response = {
    headersSent: false,
    writeHead(status, headers) { this.headersSent = true; result.status = status; result.headers = headers || {}; },
    write(value = "") { result.raw += String(value); return true; },
    end(value = "") {
      if (Buffer.isBuffer(value)) result.binary = value;
      else result.raw += String(value);
    }
  };
  await handler(request, response);
  result.body = result.headers["content-type"]?.startsWith("application/json") && result.raw ? JSON.parse(result.raw) : result.binary;
  return result;
}

test("知识库可以检索龙场悟道及其来源", () => {
  const results = searchKnowledge("为什么要先去修文龙场？", 3);
  assert.ok(results.length > 0);
  assert.equal(results[0].title, "龙场悟道");
  assert.ok(results[0].sources.some((source) => source.url));
});

test("明确景点问题不会被体验等泛词扩散到无关知识", () => {
  const results = searchKnowledge("为什么龙场悟道值得体验？", 5);
  assert.deepEqual(results.map((item) => item.title), ["龙场悟道"]);
});

test("路线类泛问只召回明确命中的龙场资料", () => {
  const results = searchKnowledge("为什么这条云游路线先去修文龙场？请结合云游四方资料回答。", 8);
  assert.deepEqual(results.map((item) => item.title), ["龙场悟道"]);
});

test("当地时间由服务器和时区确定", () => {
  const result = getLocalTime("guiyang", new Date("2026-08-29T05:30:00.000Z"));
  assert.equal(result.location, "贵阳");
  assert.equal(result.period, "中午");
  assert.match(result.localText, /13:30/);
});

test("青岩互动书页读取古镇自己的环境坐标", async () => {
  const response = await invoke({ url: "/api/ai/context?location=qingyan" });
  assert.equal(response.status, 200);
  assert.equal(response.body.location.id, "qingyan");
  assert.equal(response.body.location.name, "青岩古镇");
  assert.ok(Math.abs(response.body.location.latitude - 26.331095) < 0.001);
  assert.ok(Math.abs(response.body.location.longitude - 106.686834) < 0.001);
  assert.equal(response.body.localTime.location, "青岩古镇");
});

test("非商业的第三方入口按当前位置返回，并把支付与地址留给平台", async () => {
  const response = await invoke({ url: "/api/commerce/discoveries?location=qingyan" });
  assert.equal(response.status, 200);
  assert.equal(response.body.discovery.locationId, "qingyan");
  assert.match(response.body.discovery.title, /玫瑰糖/);
  assert.equal(response.body.discovery.disclosure.transactionOwner, "platform");
  assert.equal(response.body.discovery.disclosure.commercial, false);
  assert.equal(response.body.discovery.disclosure.sponsored, false);
  assert.equal(response.body.discovery.disclosure.affiliateTracking, false);
  assert.ok(response.body.discovery.offers.some((offer) => offer.platform === "taobao"));
  assert.equal(JSON.stringify(response.body).includes("收货地址"), true);
});

test("地方物产线索与山路体力信息分别连接实物和未来到访入口", async () => {
  const zunyi = await invoke({ url: "/api/commerce/discoveries?location=zunyi" });
  assert.equal(zunyi.status, 200);
  assert.match(zunyi.body.discovery.moment, /地方物产名称/);
  assert.doesNotMatch(zunyi.body.discovery.moment, /队伍|刚出炉|吃过|闻到/);
  assert.equal(zunyi.body.discovery.kind, "physical");

  const hailongtun = await invoke({ url: "/api/commerce/discoveries?location=hailongtun" });
  assert.equal(hailongtun.status, 200);
  assert.match(hailongtun.body.discovery.moment, /双腿读山势/);
  assert.equal(hailongtun.body.discovery.kind, "ticket");
  assert.equal(hailongtun.body.discovery.offers[0].platform, "ctrip");
  assert.equal(hailongtun.body.discovery.offers[0].linkType, "detail");
  assert.match(hailongtun.body.discovery.offers[0].href, /^https:\/\/you\.ctrip\.com\/sight\//);
});

test("没有核验交易样品的地点不借用其他城市商品", async () => {
  const response = await invoke({ url: "/api/commerce/discoveries?location=xiuwen" });
  assert.equal(response.status, 200);
  assert.equal(response.body.discovery, null);
});

test("健康检查不会返回任何密钥", async () => {
  const config = testConfig();
  config.ai = {
    ...config.ai,
    enabled: true,
    configured: true,
    baseUrl: "https://model-gateway.invalid",
    apiKey: "test-secret-must-not-leak",
    model: "test-model"
  };
  config.replyAi = {
    enabled: true,
    configured: true,
    provider: "minimax",
    apiFormat: "anthropic",
    baseUrl: "https://reply-gateway.invalid",
    apiKey: "test-reply-secret-must-not-leak",
    model: "MiniMax-M3"
  };
  const response = await invoke({ url: "/api/health", config });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.capabilities.model.configured, true);
  assert.equal(response.body.capabilities.reply.provider, "minimax");
  assert.equal(response.body.capabilities.reply.model, "MiniMax-M3");
  assert.equal(response.body.capabilities.commerce.mode, "external-link-catalog");
  assert.equal(response.body.capabilities.commerce.commercial, false);
  assert.equal(JSON.stringify(response.body).includes("apiKey"), false);
  assert.equal(JSON.stringify(response.body).includes("test-secret-must-not-leak"), false);
  assert.equal(JSON.stringify(response.body).includes("test-reply-secret-must-not-leak"), false);
  assert.equal(JSON.stringify(response.body).includes("model-gateway.invalid"), false);
});

test("来信语音接口只把正文交给服务端 MiniMax 合成器并返回音频", async () => {
  const config = testConfig();
  config.speech = { configured: true, provider: "minimax", model: "speech-2.8-hd" };
  let received = null;
  const response = await invoke({
    method: "POST",
    url: "/api/speech/letter",
    body: { text: "从南明河边慢慢讲起。" },
    config,
    synthesizeSpeech: async (input) => {
      received = input;
      return { audio: Buffer.alloc(256, 7), mimeType: "audio/mpeg", provider: "MiniMax", model: "speech-2.8-hd" };
    }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "audio/mpeg");
  assert.equal(response.body.length, 256);
  assert.equal(received.text, "从南明河边慢慢讲起。");
  assert.equal(received.config, config);
});

test("未配置模型时提问仍返回知识库降级答案和来源", async () => {
  const response = await invoke({
    method: "POST",
    url: "/api/ai/ask",
    body: { question: "为什么要去修文龙场？", locationId: "xiuwen" }
  });
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.meta.degraded, true);
  assert.match(response.body.answer, /龙场悟道/);
  assert.ok(response.body.sources.length > 0);
});

test("聊天问答支持 SSE 增量与最终结果事件", async () => {
  const response = await invoke({
    method: "POST",
    url: "/api/ai/ask",
    body: { question: "为什么要去修文龙场？", locationId: "xiuwen", stream: true }
  });
  assert.equal(response.status, 200);
  assert.match(response.headers["content-type"], /text\/event-stream/);
  assert.match(response.raw, /event: delta\ndata: \{"delta":"[^"]+/);
  assert.match(response.raw, /event: final\ndata: \{"ok":true/);
  assert.match(response.raw, /龙场悟道/);
});

test("一个字的表达也直接交给模型理解", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "嗨，我在。" } }] }) };
  };
  try {
    const config = testConfig();
    config.ai = {
      enabled: true,
      configured: true,
      provider: "deepseek",
      apiFormat: "openai",
      baseUrl: "https://model.invalid",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.2,
      timeoutMs: 1000
    };
    const response = await invoke({ method: "POST", url: "/api/ai/ask", body: { question: "嗨", locationId: "guiyang" }, config });
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
    assert.equal(response.body.meta.modelUsed, true);
    assert.equal(response.body.meta.degraded, false);
    assert.equal(response.body.answer, "嗨，我在。");
    assert.match(captured.body.messages[1].content, /用户问题：嗨/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("问答接口携带短期对话，并把稳定用户特征写入跨会话私域记忆", async () => {
  const originalFetch = global.fetch;
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-app-user-memory-"));
  const memoryId = "55555555-5555-4555-8555-555555555555";
  const userMemoryStore = createUserMemoryStore({ rootDir, now: () => new Date("2026-08-29T05:30:00.000Z") });
  const config = testConfig();
  config.replyAi = {
    enabled: true,
    configured: true,
    provider: "minimax",
    apiFormat: "anthropic",
    baseUrl: "https://model.invalid",
    apiKey: "test-key",
    model: "MiniMax-M3",
    temperature: 0.2,
    timeoutMs: 1000
  };
  const answerPrompts = [];
  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    if (String(request.system).includes("私域记忆整理器")) {
      return { ok: true, json: async () => ({ content: [{ type: "text", text: JSON.stringify({ operations: [{
        action: "remember",
        category: "travel_style",
        value: "喜欢安静、不赶行程的旅行",
        confidence: 0.9
      }] }) }] }) };
    }
    answerPrompts.push(request);
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "好，我会把节奏放慢一点。" }] }) };
  };
  try {
    const first = await invoke({
      method: "POST",
      url: "/api/ai/ask",
      body: {
        question: "我喜欢安静一点、不赶行程的旅行",
        locationId: "guiyang",
        memoryId,
        conversationHistory: [{ role: "assistant", content: "你偏好怎样的旅行？" }]
      },
      config,
      userMemoryStore
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.meta.memory.shortTermMessages, 1);
    assert.equal(first.body.meta.memory.updated, true);
    assert.equal(first.body.meta.memory.longTermFeatures, 1);
    assert.equal(answerPrompts[0].messages[0].content, "你偏好怎样的旅行？");

    const second = await invoke({
      method: "POST",
      url: "/api/ai/ask",
      body: { question: "那你给我推荐一种玩法", locationId: "guiyang", memoryId },
      config,
      userMemoryStore
    });
    assert.equal(second.body.meta.memory.longTermFeatures, 1);
    assert.match(answerPrompts[1].messages.at(-1).content, /喜欢安静、不赶行程的旅行/);

    const cleared = await invoke({
      method: "POST",
      url: "/api/ai/ask",
      body: { question: "清空关于我的全部记忆", locationId: "guiyang", memoryId },
      config,
      userMemoryStore
    });
    assert.equal(cleared.body.meta.memory.updated, true);
    assert.equal(cleared.body.meta.memory.longTermFeatures, 0);
    assert.equal(userMemoryStore.read(memoryId).features.length, 0);
  } finally {
    global.fetch = originalFetch;
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("普通问答默认不进入共同记忆，只有明确选择才记住", async () => {
  const remembered = [];
  const journeyService = {
    rememberExchange(...args) { remembered.push(args); }
  };
  const common = { question: "为什么要去修文龙场？", locationId: "xiuwen", journeyId: "33333333-3333-4333-8333-333333333333" };
  const ephemeral = await invoke({ method: "POST", url: "/api/ai/ask", body: common, journeyService });
  assert.equal(ephemeral.body.meta.remembered, false);
  assert.equal(remembered.length, 0);

  const persistent = await invoke({ method: "POST", url: "/api/ai/ask", body: { ...common, remember: true, replyToEntryId: "entry-letter-1" }, journeyService });
  assert.equal(persistent.body.meta.remembered, true);
  assert.equal(remembered.length, 1);
  assert.equal(remembered[0][3].replyToEntryId, "entry-letter-1");
});

test("对话只展示通过服务端审核的克制推荐，并写入旅程频控记录", async () => {
  const recommendation = {
    id: "qingyan-rose-candy",
    locationId: "qingyan",
    title: "青岩玫瑰糖",
    recommendationReason: "你正在找适合带回去的当地味道，这条可留作比较。",
    offers: [{ href: "https://example.com/products/rose-candy", linkType: "product" }]
  };
  const recorded = [];
  const journeyService = {
    get() {
      return { id: "33333333-3333-4333-8333-333333333333", state: { currentLocationId: "qingyan" }, events: [] };
    },
    recordCommerceRecommendation(...args) { recorded.push(args); }
  };
  const response = await invoke({
    method: "POST",
    url: "/api/ai/ask",
    body: {
      question: "这里有什么真的值得带回去？",
      locationId: "qingyan",
      journeyId: "33333333-3333-4333-8333-333333333333"
    },
    journeyService,
    commerceRecommender: async () => recommendation
  });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.recommendation, recommendation);
  assert.equal(response.body.meta.recommendationIncluded, true);
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0][0], "33333333-3333-4333-8333-333333333333");
  assert.equal(recorded[0][1].id, "qingyan-rose-candy");
});

test("路线方向问题也交给模型结合旅程上下文回答", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "我现在沿着已经发生的行动继续判断，未公开的下一站先不提前说。" } }] }) };
  };
  const journeyService = {
    get() {
      return {
        id: "33333333-3333-4333-8333-333333333333",
        settings: { commission: "自由探索真实日常，不要提前告诉我下一站。" },
        state: { currentLocationId: "guiyang", nextLocationId: "xiuwen", nextLocationRevealed: false },
        agent: { lastRun: { decision: {
          nextStopReason: "先去修文龙场。",
          contentIntent: "从贵阳当下的城市日常出发，继续核对文化线索。"
        } } }
      };
    }
  };
  try {
    const config = testConfig();
    config.ai = {
      enabled: true,
      configured: true,
      provider: "deepseek",
      apiFormat: "openai",
      baseUrl: "https://model.invalid",
      apiKey: "test-key",
      model: "test-model",
      temperature: 0.2,
      timeoutMs: 1000
    };
    const response = await invoke({
      method: "POST",
      url: "/api/ai/ask",
      body: { question: "你为什么选择现在这个方向？", locationId: "guiyang", journeyId: "33333333-3333-4333-8333-333333333333" },
      journeyService,
      config
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.meta.modelUsed, true);
    assert.equal(response.body.meta.answerKind, "grounded-answer");
    assert.match(response.body.answer, /未公开的下一站先不提前说/);
    assert.match(captured.body.messages[1].content, /用户问题：你为什么选择现在这个方向/);
    assert.match(captured.body.messages[1].content, /自由探索真实日常/);
    assert.match(captured.body.messages[1].content, /从贵阳当下的城市日常出发，继续核对文化线索/);
    assert.doesNotMatch(captured.body.messages[1].content, /nextLocationId|先去修文龙场/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("过长问题被拒绝", async () => {
  const response = await invoke({ method: "POST", url: "/api/ai/ask", body: { question: "问".repeat(801) } });
  assert.equal(response.status, 400);
});

test("旅程接口可以创建手账并触发站点生成", async () => {
  const journey = { id: "11111111-1111-4111-8111-111111111111", entries: [], route: ["guiyang"] };
  const generated = { ...journey, entries: [{ id: "entry-1", locationId: "guiyang", status: "ready" }] };
  const journeyService = {
    create(settings) { return { ...journey, settings }; },
    get() { return journey; },
    async generateStop() { return { journey: generated, entry: generated.entries[0], reused: false }; },
    media() { throw new Error("not used"); }
  };
  const created = await invoke({ method: "POST", url: "/api/journeys", body: { mode: "步行", pace: "快速云游" }, journeyService });
  assert.equal(created.status, 201);
  assert.equal(created.body.journey.settings.mode, "步行");
  const result = await invoke({ method: "POST", url: `/api/journeys/${journey.id}/stops/guiyang/generate`, body: {}, journeyService });
  assert.equal(result.status, 200);
  assert.equal(result.body.entry.locationId, "guiyang");
  assert.equal(result.body.reused, false);
});

test("旅程 API 暴露 PI Agent 启动、服务端同步与用户指令", async () => {
  const journey = {
    id: "22222222-2222-4222-8222-222222222222",
    state: { phase: "draft", currentLocationId: "guiyang" },
    entries: [],
    route: ["guiyang", "xiuwen"]
  };
  const travelling = { ...journey, state: { ...journey.state, phase: "travelling", nextLocationId: "xiuwen" } };
  const paused = { ...travelling, state: { ...travelling.state, phase: "paused" } };
  const journeyService = {
    create(settings) { return { ...journey, settings }; },
    get() { return journey; },
    async start() { return travelling; },
    async sync() { return travelling; },
    async command(_id, body) { return body.action === "pause" ? paused : travelling; },
    async generateStop() { return { journey: travelling, entry: null, reused: false }; },
    media() { throw new Error("not used"); }
  };
  const started = await invoke({ method: "POST", url: `/api/journeys/${journey.id}/start`, body: {}, journeyService });
  assert.equal(started.status, 200);
  assert.equal(started.body.journey.state.phase, "travelling");

  const synced = await invoke({ url: `/api/journeys/${journey.id}`, journeyService });
  assert.equal(synced.body.journey.state.nextLocationId, "xiuwen");

  const commanded = await invoke({ method: "POST", url: `/api/journeys/${journey.id}/commands`, body: { action: "pause" }, journeyService });
  assert.equal(commanded.body.journey.state.phase, "paused");

  const health = await invoke({ url: "/api/health", journeyService });
  assert.equal(health.body.capabilities.agent.framework, "@earendil-works/pi-agent-core");
  assert.equal(health.body.capabilities.agent.persona, "阿镜");
});
