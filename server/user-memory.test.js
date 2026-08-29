"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  shouldInspectUserMemory,
  asksToClearUserMemory,
  parseJsonObject
} = require("./user-memory");

test("只让稳定特征和记忆管理表达进入长期记忆整理", () => {
  assert.equal(shouldInspectUserMemory("我喜欢安静一点的旅行"), true);
  assert.equal(shouldInspectUserMemory("以后称呼我小唐"), true);
  assert.equal(shouldInspectUserMemory("忘掉我不吃辣这件事"), true);
  assert.equal(shouldInspectUserMemory("我今天有点烦"), false);
  assert.equal(shouldInspectUserMemory("甲秀楼怎么走？"), false);
  assert.equal(asksToClearUserMemory("清空关于我的全部记忆"), true);
});

test("记忆整理器可以解析纯 JSON 和代码围栏", () => {
  assert.deepEqual(parseJsonObject('{"operations":[]}'), { operations: [] });
  assert.deepEqual(parseJsonObject('```json\n{"operations":[{"action":"forget","query":"辣"}]}\n```').operations[0], {
    action: "forget",
    query: "辣"
  });
});
