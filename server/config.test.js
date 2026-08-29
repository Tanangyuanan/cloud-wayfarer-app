"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getConfig } = require("./config");

const AI_ENV_NAMES = [
  "AI_PROVIDER", "AI_API_KEY", "AI_BASE_URL", "AI_MODEL", "AI_API_FORMAT", "AI_ENABLED",
  "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL", "DEEPSEEK_MODEL",
  "MINIMAX_API_KEY", "MINIMAX_BASE_URL", "MINIMAX_MODEL",
  "MINIMAX_CHAT_ENABLED", "MINIMAX_CHAT_API_KEY", "MINIMAX_CHAT_BASE_URL", "MINIMAX_CHAT_MODEL", "MINIMAX_CHAT_TEMPERATURE", "MINIMAX_CHAT_TIMEOUT_MS",
  "MINIMAX_IMAGE_ENABLED", "MINIMAX_IMAGE_API_KEY", "MINIMAX_IMAGE_BASE_URL", "MINIMAX_IMAGE_MODEL", "MINIMAX_IMAGE_TIMEOUT_MS",
  "MINIMAX_SPEECH_ENABLED", "MINIMAX_SPEECH_API_KEY", "MINIMAX_SPEECH_BASE_URL", "MINIMAX_SPEECH_MODEL", "MINIMAX_SPEECH_VOICE_ID", "MINIMAX_SPEECH_SPEED", "MINIMAX_SPEECH_TIMEOUT_MS",
  "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL"
];

function withAiEnvironment(values, callback) {
  const original = Object.fromEntries(AI_ENV_NAMES.map((name) => [name, process.env[name]]));
  for (const name of AI_ENV_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return callback();
  } finally {
    for (const name of AI_ENV_NAMES) {
      if (original[name] == null) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}

test("服务端端口使用 Cloud Wayfarer 配置名", () => {
  const original = process.env.CLOUD_WAYFARER_PORT;
  process.env.CLOUD_WAYFARER_PORT = "9123";
  try {
    assert.equal(getConfig().port, 9123);
  } finally {
    if (original == null) delete process.env.CLOUD_WAYFARER_PORT;
    else process.env.CLOUD_WAYFARER_PORT = original;
  }
});

test("内容模型使用 DeepSeek，同时阿镜回复固定使用 MiniMax", () => {
  withAiEnvironment({
    DEEPSEEK_API_KEY: "test-deepseek-secret",
    MINIMAX_API_KEY: "test-minimax-secret"
  }, () => {
    const config = getConfig();
    assert.equal(config.ai.provider, "deepseek");
    assert.equal(config.ai.apiFormat, "openai");
    assert.equal(config.ai.baseUrl, "https://api.deepseek.com");
    assert.equal(config.ai.model, "deepseek-v4-pro");
    assert.equal(config.ai.temperature, 0.35);
    assert.equal(config.ai.configured, true);
    assert.equal(config.replyAi.provider, "minimax");
    assert.equal(config.replyAi.apiFormat, "anthropic");
    assert.equal(config.replyAi.baseUrl, "https://api.minimaxi.com/anthropic");
    assert.equal(config.replyAi.model, "MiniMax-M3");
    assert.equal(config.replyAi.temperature, 0.2);
    assert.equal(config.replyAi.configured, true);
    assert.equal(config.image.provider, "minimax");
    assert.equal(config.image.configured, true);
    assert.equal(config.speech.provider, "minimax");
    assert.equal(config.speech.model, "speech-2.8-hd");
    assert.equal(config.speech.voiceId, "Chinese (Mandarin)_News_Anchor");
    assert.equal(config.speech.emotion, "calm");
    assert.equal(config.speech.configured, true);
  });
});

test("阿镜回复可以使用独立 MiniMax 配置，不改变内容模型", () => {
  withAiEnvironment({
    DEEPSEEK_API_KEY: "test-deepseek-secret",
    MINIMAX_API_KEY: "test-minimax-secret",
    MINIMAX_CHAT_API_KEY: "test-chat-secret",
    MINIMAX_CHAT_BASE_URL: "https://chat-gateway.invalid/anthropic/",
    MINIMAX_CHAT_MODEL: "MiniMax-Chat-Test",
    MINIMAX_CHAT_TEMPERATURE: "0.18",
    MINIMAX_CHAT_TIMEOUT_MS: "56000"
  }, () => {
    const config = getConfig();
    assert.equal(config.ai.provider, "deepseek");
    assert.equal(config.replyAi.provider, "minimax");
    assert.equal(config.replyAi.baseUrl, "https://chat-gateway.invalid/anthropic");
    assert.equal(config.replyAi.apiKey, "test-chat-secret");
    assert.equal(config.replyAi.model, "MiniMax-Chat-Test");
    assert.equal(config.replyAi.temperature, 0.18);
    assert.equal(config.replyAi.timeoutMs, 56000);
  });
});

test("没有 DeepSeek Key 时自动模式仍可回退到 MiniMax", () => {
  withAiEnvironment({
    AI_PROVIDER: "auto",
    MINIMAX_API_KEY: "test-minimax-secret",
    ANTHROPIC_AUTH_TOKEN: "test-other-secret",
    ANTHROPIC_BASE_URL: "https://other-gateway.invalid",
    ANTHROPIC_MODEL: "other-model"
  }, () => {
    const config = getConfig();
    assert.equal(config.ai.provider, "minimax");
    assert.equal(config.ai.baseUrl, "https://api.minimaxi.com/anthropic");
    assert.equal(config.ai.model, "MiniMax-M3");
    assert.equal(config.ai.temperature, 0.2);
    assert.equal(config.ai.configured, true);
    assert.equal(config.image.configured, true);
    assert.equal(config.image.model, "image-01");
  });
});

test("显式 AI 配置可以覆盖自动 MiniMax 选择", () => {
  withAiEnvironment({
    MINIMAX_API_KEY: "test-minimax-secret",
    AI_PROVIDER: "custom",
    AI_API_KEY: "test-custom-secret",
    AI_BASE_URL: "https://custom-model.invalid/root/",
    AI_MODEL: "custom-model"
  }, () => {
    const config = getConfig();
    assert.equal(config.ai.provider, "custom");
    assert.equal(config.ai.baseUrl, "https://custom-model.invalid/root");
    assert.equal(config.ai.model, "custom-model");
  });
});

test("显式关闭模型后即使存在 Key 也不启用", () => {
  withAiEnvironment({ DEEPSEEK_API_KEY: "test-deepseek-secret", AI_ENABLED: "false" }, () => {
    const config = getConfig();
    assert.equal(config.ai.provider, "deepseek");
    assert.equal(config.ai.configured, false);
  });
});
