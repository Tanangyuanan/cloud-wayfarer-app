"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createUserMemoryStore, validMemoryId, sanitizeOperation } = require("./user-memory-store");

const MEMORY_ID = "44444444-4444-4444-8444-444444444444";

test("用户长期特征可以跨请求保存、增强与删除", () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "cloud_wayfarer-user-memory-"));
  const store = createUserMemoryStore({ rootDir, now: () => new Date("2026-08-29T08:00:00.000Z") });
  try {
    const first = store.apply(MEMORY_ID, [{
      action: "remember",
      category: "preference",
      value: "喜欢安静、不赶行程的旅行",
      confidence: 0.86
    }]);
    assert.equal(first.changed, true);
    assert.equal(first.profile.features.length, 1);
    assert.equal(first.profile.features[0].evidenceCount, 1);

    const repeated = store.apply(MEMORY_ID, [{
      action: "remember",
      category: "preference",
      value: "喜欢安静、不赶行程的旅行",
      confidence: 0.92
    }]);
    assert.equal(repeated.profile.features.length, 1);
    assert.equal(repeated.profile.features[0].evidenceCount, 2);
    assert.equal(repeated.profile.features[0].confidence, 0.92);

    const forgotten = store.apply(MEMORY_ID, [{
      action: "forget",
      featureId: repeated.profile.features[0].id
    }]);
    assert.equal(forgotten.profile.features.length, 0);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("用户记忆编号拒绝路径穿越，敏感与未知类别不会保存", () => {
  assert.equal(validMemoryId("../../etc/passwd"), null);
  assert.equal(sanitizeOperation({ action: "remember", category: "identity", value: "身份证 123" }), null);
  assert.equal(sanitizeOperation({ action: "remember", category: "preference", value: "我的 API key 是 abc" }), null);
  assert.deepEqual(
    sanitizeOperation({ action: "remember", category: "communication_style", value: "先给结论，再解释" }),
    { action: "remember", category: "communication_style", value: "先给结论，再解释", confidence: 0.7 }
  );
});
