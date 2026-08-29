"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  generateAnswer,
  collectSources,
  safeHttpUrl,
  guardModelAnswer,
  sanitizeConversationHistory,
  formatUserMemory
} = require("./model");

function fixtureContext() {
  return {
    location: { id: "xiuwen", name: "修文龙场" },
    journeyRoute: {
      routeText: "贵阳 → 修文龙场",
      editorialIntent: "下一站由 Agent 根据当时状态自主选择，尚未抵达的地点不构成承诺。",
      stops: [
        { id: "guiyang", name: "贵阳", order: 1, focus: "当代城市日常" },
        { id: "xiuwen", name: "修文龙场", order: 2, focus: "龙场悟道" }
      ],
      currentStop: { id: "xiuwen", name: "修文龙场", order: 2 }
    },
    localTime: { localText: "2026/08/29周六 13:30:00", period: "中午", timezone: "Asia/Shanghai" },
    weather: null,
    localResults: [{
      title: "龙场悟道",
      snippet: "王阳明在贵州龙场的困顿、悟道和讲学，是阳明心学形成的重要阶段。",
      evidenceStatus: "A",
      sources: [{ title: "阳明文化与龙场悟道", url: "https://example.com/longchang" }]
    }],
    web: { provider: "local-only", results: [] }
  };
}

function configuredModel() {
  return {
    ai: {
      configured: true,
      provider: "deepseek",
      apiFormat: "openai",
      baseUrl: "https://api.deepseek.com",
      apiKey: "test-secret-not-real",
      model: "deepseek-v4-pro",
      temperature: 0.35,
      timeoutMs: 1000
    }
  };
}

test("任意非空表达都由模型理解，不再匹配固定话术", async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => ({ choices: [{ message: { content: "我听见了，我们接着聊。" } }] }) };
  };
  try {
    const inputs = ["你好", "谢谢啦", "我今天有点烦", "量子纠缠是什么？", "讲个冷笑话"];
    for (const question of inputs) {
      const result = await generateAnswer({ question, context: fixtureContext(), config: configuredModel() });
      assert.equal(result.modelUsed, true);
      assert.equal(result.degraded, false);
      assert.equal(result.answer, "我听见了，我们接着聊。");
    }
    assert.equal(requests.length, inputs.length);
    inputs.forEach((input, index) => {
      assert.match(requests[index].body.messages[1].content, new RegExp(`用户问题：${input.replace(/[?？]/g, ".")}`));
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("文字内容按 DeepSeek OpenAI 兼容协议发送并解析回答", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "龙场悟道的价值在困境与行动之间。[1]" } }] }) };
  };
  try {
    const result = await generateAnswer({
      question: "为什么值得理解龙场悟道？",
      context: fixtureContext(),
      config: configuredModel()
    });
    assert.equal(captured.url, "https://api.deepseek.com/chat/completions");
    assert.equal(captured.options.headers.authorization, "Bearer test-secret-not-real");
    assert.equal(captured.options.headers["x-api-key"], undefined);
    assert.equal(captured.body.model, "deepseek-v4-pro");
    assert.equal(captured.body.temperature, 0.35);
    assert.deepEqual(captured.body.thinking, { type: "disabled" });
    assert.match(captured.body.messages[0].content, /可以自然回应用户的任何话题/);
    assert.match(captured.body.messages[0].content, /回答长度随对话自然变化/);
    assert.match(captured.body.messages[0].content, /禁止补写上下文没有提供的道路、石阶、植被、建筑/);
    assert.match(captured.body.messages[1].content, /用户问题：为什么值得理解龙场悟道/);
    assert.match(captured.body.messages[1].content, /云游四方已审核\/待审核知识/);
    assert.match(captured.body.messages[1].content, /已经实际走过并被记录的轨迹/);
    assert.match(captured.body.messages[1].content, /当前路线节点：第 2 站 · 修文龙场/);
    assert.match(captured.body.messages[1].content, /自主探索原则/);
    assert.equal(result.modelUsed, true);
    assert.equal(result.degraded, false);
    assert.match(result.answer, /\[1\]/);
    assert.equal(JSON.stringify(result).includes("test-secret-not-real"), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test("模型回答按上游 SSE 增量流式返回", async () => {
  const originalFetch = global.fetch;
  let captured;
  const encoder = new TextEncoder();
  global.fetch = async (_url, options) => {
    captured = JSON.parse(options.body);
    return {
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"先说结论："}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"**值得去** [1]"}}]}\n\ndata: [DONE]\n\n'));
          controller.close();
        }
      })
    };
  };
  try {
    const deltas = [];
    const result = await generateAnswer({
      question: "为什么值得去？",
      context: fixtureContext(),
      config: configuredModel(),
      onToken: (delta) => deltas.push(delta)
    });
    assert.equal(captured.stream, true);
    assert.deepEqual(deltas, ["先说结论：", "**值得去** [1]"]);
    assert.equal(result.answer, "先说结论：**值得去** [1]");
    assert.equal(result.modelUsed, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("最近 20 条对话按真实角色顺序发送，并携带相关长期特征", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: "第二点是把节奏放慢。" } }] }) };
  };
  try {
    const history = Array.from({ length: 24 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `第${index + 1}条`
    }));
    const userMemory = {
      features: [{ category: "communication_style", value: "先给结论，再解释", confidence: 0.9, evidenceCount: 2 }]
    };
    const result = await generateAnswer({
      question: "你刚才的第二点呢？",
      context: fixtureContext(),
      config: configuredModel(),
      conversationHistory: history,
      userMemory
    });
    assert.equal(result.answer, "第二点是把节奏放慢。");
    assert.equal(captured.messages.length, 22);
    assert.equal(captured.messages[1].content, "第5条");
    assert.equal(captured.messages[20].content, "第24条");
    assert.match(captured.messages[21].content, /先给结论，再解释/);
    assert.deepEqual(sanitizeConversationHistory(history).map((item) => item.content), history.slice(-20).map((item) => item.content));
    assert.match(formatUserMemory(userMemory), /communication_style/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("阿镜聊天存在专用配置时固定通过 MiniMax 回复", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ content: [{ type: "text", text: "我先从这座楼和水的关系讲起。[1]" }] }) };
  };
  try {
    const config = configuredModel();
    config.replyAi = {
      configured: true,
      provider: "minimax",
      apiFormat: "anthropic",
      baseUrl: "https://api.minimaxi.com/anthropic",
      apiKey: "test-minimax-secret-not-real",
      model: "MiniMax-M3",
      temperature: 0.2,
      timeoutMs: 1000
    };
    const result = await generateAnswer({
      question: "甲秀楼为什么建在水上？",
      context: fixtureContext(),
      config
    });
    assert.equal(captured.url, "https://api.minimaxi.com/anthropic/v1/messages");
    assert.equal(captured.options.headers["x-api-key"], "test-minimax-secret-not-real");
    assert.equal(captured.options.headers.authorization, undefined);
    assert.equal(captured.body.model, "MiniMax-M3");
    assert.equal(captured.body.temperature, 0.2);
    assert.equal(result.provider, "minimax");
    assert.equal(result.model, "MiniMax-M3");
    assert.equal(result.modelUsed, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("模型上游失败时返回带来源的降级答案", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error("upstream unavailable"); };
  try {
    const result = await generateAnswer({
      question: "龙场悟道是什么？",
      context: fixtureContext(),
      config: configuredModel()
    });
    assert.equal(result.modelUsed, false);
    assert.equal(result.degraded, true);
    assert.equal(result.provider, "deepseek");
    assert.equal(result.model, "deepseek-v4-pro");
    assert.match(result.answer, /龙场悟道/);
    assert.equal(result.sources.length, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("口述故事问题也交给模型，同时明确禁止虚构老人原话", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "我还没找到可以核对的完整口述版本，所以先不替讲述者补原话。" } }] }) };
  };
  try {
    const context = fixtureContext();
    context.location = { id: "hailongtun", name: "海龙屯" };
    const result = await generateAnswer({
      question: "请搜索老一辈怎么讲海龙屯的故事？",
      context,
      config: configuredModel()
    });
    assert.equal(result.modelUsed, true);
    assert.equal(result.degraded, false);
    assert.match(result.answer, /不替讲述者补原话/);
    assert.match(captured.body.messages[0].content, /不得自行生成‘老人说……’式直接引语/);
    assert.match(captured.body.messages[1].content, /请搜索老一辈怎么讲海龙屯的故事/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("来源 URL 只允许 HTTP 和 HTTPS", () => {
  assert.equal(safeHttpUrl("javascript:alert(1)"), null);
  assert.equal(safeHttpUrl("not a url"), null);
  assert.equal(safeHttpUrl("https://example.com/a"), "https://example.com/a");
  const context = fixtureContext();
  context.web.results.push({ title: "不可信链接", url: "javascript:alert(1)" });
  const sources = collectSources(context);
  assert.equal(sources.find((source) => source.title === "不可信链接").url, null);
});

test("未引用的具体观察段会被替换，越界来源编号会被清除", () => {
  const answer = guardModelAnswer(
    "龙场悟道是重要思想节点 [1]，但这条说法没有来源 [9]。\n\n继续观察线索：沿某条古道看石阶和古树。",
    [{ id: 1, title: "有效来源" }]
  );
  assert.match(answer, /重要思想节点 \[1\]/);
  assert.equal(answer.includes("[9]"), false);
  assert.equal(answer.includes("古道"), false);
  assert.match(answer, /抵达后可以验证一个问题/);
});
