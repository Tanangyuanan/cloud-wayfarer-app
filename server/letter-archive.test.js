"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { list } = require("../prototype/pwa/letter-archive.js");
const { hasInternalLanguage, hasUserRelationshipLanguage } = require("./public-writing");

test("冷启动也能读到阿镜已有的行路与旧信", () => {
  const issues = list();
  assert.equal(issues.length, 9);
  assert.deepEqual([...new Set(issues.map((issue) => issue.locationName))], [
    "贵阳", "贵阳·甲秀楼", "青岩古镇", "修文·龙场", "遵义老城", "海龙屯", "赤水河谷", "赤水丹霞"
  ]);
  assert.equal(issues[0].content.letterTitle, "行李放下来的第七天");
  assert.equal(issues.at(-1).content.letterTitle, "雨伞还在门边，我却不一样了");
  assert.ok(issues.every((issue) => issue.kind === "editorial-letter" && issue.status === "ready"));
});

test("旧信是可独立阅读的前台文字，不泄露内部话术或伪造共同记忆", () => {
  for (const issue of list()) {
    const publicCopy = [issue.content.letterTitle, issue.content.deck, issue.content.letterBody, issue.content.cultureBody].filter(Boolean).join("\n");
    assert.equal(hasInternalLanguage(publicCopy), false, issue.id);
    assert.equal(hasUserRelationshipLanguage(publicCopy), false, issue.id);
    assert.match(issue.content.letterBody, /^(?:晚上好|傍晚好|下午好)。/);
    assert.ok(issue.content.letterBody.length >= 180, issue.id);
  }
});

test("返回的旧信数据为独立副本，不会被页面排序污染", () => {
  const first = list();
  first.reverse();
  first[0].content.letterTitle = "已修改";
  const second = list();
  assert.equal(second[0].id, "archive-letter-2026-06-18-guiyang-home");
  assert.notEqual(second.at(-1).content.letterTitle, "已修改");
});
