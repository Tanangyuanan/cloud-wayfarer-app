"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const commerceLinks = require("../data/commerce-links.json");
const {
  discoveryForLocation,
  recommendationForConversation,
  recommendationGate,
  offerMeetsRecommendationThreshold
} = require("./commerce");

test("外跳目录保持非商业且不包含联盟追踪", () => {
  assert.equal(commerceLinks.policy.commercial, false);
  assert.equal(commerceLinks.policy.affiliateTracking, false);
});

test("所有外跳入口使用 HTTPS 并带核验日期", () => {
  const offers = Object.values(commerceLinks.offersByDiscoveryId).flat();
  assert.ok(offers.length > 0);
  for (const offer of offers) {
    const url = new URL(offer.href);
    assert.equal(url.protocol, "https:");
    assert.match(offer.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(["detail", "product", "search"].includes(offer.linkType));
  }
});

test("门票入口跳到景点详情页而不是平台搜索页", () => {
  for (const locationId of ["fanjingshan", "hailongtun"]) {
    const discovery = discoveryForLocation(locationId);
    assert.equal(discovery.kind, "ticket");
    assert.ok(discovery.offers.length > 0);
    assert.ok(discovery.offers.every((offer) => offer.linkType === "detail"));
    assert.ok(discovery.offers.every((offer) => !new URL(offer.href).pathname.includes("search")));
  }
});

test("返回数据明确说明云游四方不参与第三方交易", () => {
  const discovery = discoveryForLocation("qingyan");
  assert.equal(discovery.disclosure.commercial, false);
  assert.equal(discovery.disclosure.sponsored, false);
  assert.equal(discovery.disclosure.affiliateTracking, false);
  assert.match(discovery.disclosure.message, /非商业/);
  assert.match(discovery.disclosure.message, /不读取支付信息/);
});

test("前台入口不再出现广告或推广服务费文案", () => {
  const projectRoot = path.join(__dirname, "..");
  const publicCopy = ["prototype/index.html", "prototype/app.js"]
    .map((file) => fs.readFileSync(path.join(projectRoot, file), "utf8"))
    .join("\n");
  assert.doesNotMatch(publicCopy, /推广服务费|商业广告|广告入口/);
});

function qualifiedOffer(overrides = {}) {
  return {
    platform: "test",
    platformLabel: "第三方平台",
    actionLabel: "查看详情",
    href: "https://example.com/products/1",
    note: "商品详情页",
    linkType: "product",
    verifiedAt: "2026-08-29",
    recommendationEvidence: {
      verifiedAt: "2026-08-29",
      independentSourceCount: 3,
      reviewCount: 860,
      rating: 4.7,
      ratingScale: 5,
      positiveRate: 0.92,
      sources: [
        { title: "来源一", url: "https://reviews.example.com/a" },
        { title: "来源二", url: "https://reviews.example.org/b" },
        { title: "来源三", url: "https://reviews.example.net/c" }
      ]
    },
    ...overrides
  };
}

function qualifiedDiscovery() {
  return {
    ...discoveryForLocation("qingyan"),
    offers: [qualifiedOffer()]
  };
}

function conversationOptions(overrides = {}) {
  return {
    question: "这里真的值得去吗？如果以后想带一点特产回来呢？",
    answer: "我喜欢这里，但还想把资料看完整。",
    context: {
      location: { id: "qingyan", name: "青岩古镇" },
      localResults: [
        { title: "资料一", sources: [{ title: "资料一", url: "https://facts.example.com/1" }] },
        { title: "资料二", sources: [{ title: "资料二", url: "https://facts.example.org/2" }] },
        { title: "资料三", sources: [{ title: "资料三", url: "https://facts.example.net/3" }] }
      ],
      web: { results: [] }
    },
    journey: { id: "journey-1", state: { currentLocationId: "qingyan" }, events: [] },
    discovery: qualifiedDiscovery(),
    now: new Date("2026-08-29T12:00:00.000Z"),
    conversationHistory: [],
    userMemory: null,
    ...overrides
  };
}

test("只有直接链接和充分、近期的独立评价证据才通过推荐硬门槛", () => {
  assert.equal(offerMeetsRecommendationThreshold(qualifiedOffer(), { now: new Date("2026-08-29T12:00:00Z") }), true);
  assert.equal(offerMeetsRecommendationThreshold(qualifiedOffer({ linkType: "search" }), { now: new Date("2026-08-29T12:00:00Z") }), false);
  assert.equal(offerMeetsRecommendationThreshold(qualifiedOffer({ recommendationEvidence: { ...qualifiedOffer().recommendationEvidence, reviewCount: 30 } }), { now: new Date("2026-08-29T12:00:00Z") }), false);
  assert.equal(Object.values(commerceLinks.offersByDiscoveryId).flat().some((offer) => offerMeetsRecommendationThreshold(offer, { now: new Date("2026-08-29T12:00:00Z") })), false);
});

test("用户拒绝、对话无兴趣或七天冷却期内都不会进入 AI 推荐判断", () => {
  assert.equal(recommendationGate(conversationOptions()).eligible, true);
  assert.equal(recommendationGate(conversationOptions({ question: "给我讲讲这里的历史。" })).reason, "no_user_interest");
  assert.equal(recommendationGate(conversationOptions({ question: "不要再给我推荐商品链接。" })).reason, "user_opted_out");
  assert.equal(recommendationGate(conversationOptions({
    journey: {
      id: "journey-1",
      state: { currentLocationId: "qingyan" },
      events: [{ type: "commerce_recommended", at: "2026-08-28T12:00:00.000Z", data: { discoveryId: "another" } }]
    }
  })).reason, "frequency_limited");
});

test("硬门槛通过后仍由模型做克制判断，返回链接只来自服务端候选", async () => {
  const recommendation = await recommendationForConversation(conversationOptions({
    config: {
      replyAi: {
        configured: true,
        provider: "minimax",
        apiFormat: "openai",
        baseUrl: "https://api.minimaxi.com",
        apiKey: "test-secret",
        model: "MiniMax-M3",
        temperature: 0.1,
        timeoutMs: 1000
      }
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ recommend: true, reason: "你已经在认真考虑带回一点当地味道，这条入口可以留作比较。" }) } }] })
    })
  }));
  assert.match(recommendation.recommendationReason, /留作比较/);
  assert.equal(recommendation.offers[0].href, "https://example.com/products/1");
  assert.equal(recommendation.offers[0].recommendationEvidence, undefined);
  assert.match(recommendation.evidenceSummary, /860 条评价/);
});
