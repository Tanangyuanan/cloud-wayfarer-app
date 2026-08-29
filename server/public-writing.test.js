"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasInternalLanguage, hasUserRelationshipLanguage, cleanPublicHeading } = require("./public-writing");
const { buildDynamicAgentContext, readAgentDocuments } = require("./agent-context");

test("公开文字守卫识别截图中的内部话术与格式枚举", () => {
  const leaked = [
    "远方来信 · note",
    "这一笺先把雨天在河谷里的身体感受放进来。",
    "盐运、酒、长征需要再走一步才能补齐，暂不写成亲历。",
    "用户的委托是看贵州真实的日常。",
    "阿镜写在渡口边：我没有编一段酒坊故事，因为今天没走到。"
  ].join("\n");
  assert.equal(hasInternalLanguage(leaked), true);
  assert.equal(cleanPublicHeading("# 河谷里的一封短信", 80), "河谷里的一封短信");
  assert.equal(hasUserRelationshipLanguage("你留的那条线索今天落地了。"), true);
  assert.equal(hasUserRelationshipLanguage("小雨落在赤水河上，我把脚步放慢了。"), false);
});

test("写作提示词加载统一前台规范，动态上下文不再携带寄信内部字段", () => {
  assert.match(readAgentDocuments("journal"), /PUBLIC_WRITING\.md/);
  const context = buildDynamicAgentContext({
    id: "journey-1",
    settings: { commission: "想看看贵州普通的一天。" },
    state: {}, embodiment: {}, preferences: {}, memories: [], decisions: [],
    entries: [{
      id: "entry-1", status: "ready", locationName: "赤水",
      content: { headline: "雨落河谷", observation: "雨让脚步慢了下来。" },
      delivery: { format: "note", whyForUser: "内部理由" }
    }]
  });
  assert.doesNotMatch(context, /whyForUser|deliveryFormat|\"format\":\"note\"/);
  assert.match(context, /想看看贵州普通的一天/);
});

test("移动端来信不再自动拼接问候、内部理由或原始格式名", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "prototype", "pwa", "app.js"), "utf8");
  assert.doesNotMatch(source, /entry\.delivery\?\.whyForUser/);
  assert.doesNotMatch(source, /entry\.delivery\?\.format/);
  assert.doesNotMatch(source, /element\("p", "", "你好。"\)/);
  assert.doesNotMatch(source, /模型生成|后端降级内容|后端来信/);
});

test("此刻页把疲惫、体感和下一步写进第一人称正文", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "prototype", "app.js"), "utf8");
  assert.match(source, /function embodiedMomentProse/);
  assert.match(source, /我现在确实有点累/);
  assert.match(source, /所以我想\$\{action\}/);
  assert.doesNotMatch(source, /眼下能确认的，是我已经到了/);
  assert.doesNotMatch(source, /现场声音和更具体的景象还没有接入/);
});
