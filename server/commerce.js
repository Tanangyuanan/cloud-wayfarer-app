"use strict";

const commerceLinks = require("../data/commerce-links.json");
const { requestTextModel } = require("./text-model-client");

const DEFAULT_RECOMMENDATION_POLICY = Object.freeze({
  minimumLocationSources: 3,
  minimumIndependentReviewSources: 3,
  minimumReviewCount: 200,
  minimumRatingOutOfFive: 4.5,
  minimumPositiveRate: 0.85,
  maximumEvidenceAgeDays: 90,
  cooldownHours: 168,
  maximumPerJourney: 2
});
const RECOMMENDATION_INTEREST_PATTERN = /值得|喜欢|推荐|想去|想尝|好吃|好玩|怎么买|哪里买|购买|带回|伴手礼|特产|门票|预约|预订|收藏|安排|以后去|亲自去/;
const RECOMMENDATION_OPTOUT_PATTERN = /(?:不要|别再|不想|拒绝|屏蔽|关闭|讨厌).{0,10}(?:广告|推广|商品|购买|推荐|链接)/;

const DISCOVERIES = {
  guiyang: {
    id: "guiyang-maojian-travel-tin",
    locationId: "guiyang",
    kind: "physical",
    title: "都匀毛尖 · 旅行小罐",
    origin: "贵州黔南",
    discoveryHeading: "沿贵州茶事，翻到都匀毛尖",
    moment: "都匀毛尖是贵州代表性绿茶之一。这张卡先把它收作地方物产线索，具体饮用感受留到真正遇见以后。",
    question: "要不要先记下它？以后真正到访或选购时，再去核对产地、商家和当日价格。",
    story: "这里只提供地方物产的第三方检索入口，不替具体商家背书；购买前请核对产地、店铺和平台保障。",
    image: "/prototype/assets/culture/FOD-029.jpeg",
    imageAlt: "贵州都匀毛尖茶园里的采茶场景",
    fulfillment: "由第三方平台购买与配送",
    priceLabel: "价格以平台页面为准",
    verification: "人工整理入口 · 不代表商家背书"
  },
  qingyan: {
    id: "qingyan-rose-candy",
    locationId: "qingyan",
    kind: "physical",
    title: "青岩玫瑰糖 · 手作小盒",
    origin: "贵阳青岩",
    discoveryHeading: "青岩的物产资料里，有一条玫瑰糖线索",
    moment: "这张卡暂时只记录“青岩玫瑰糖”这个物产名称；具体门店、制作过程和味道仍要逐项核对。",
    question: "要不要先收下这条线索？以后选购时，再核对具体门店、配料与保质期。",
    story: "这里只提供地方物产的第三方检索入口，不替具体商家背书；购买前请核对门店、配料和平台保障。",
    image: "/prototype/assets/attractions/CTY-002.png",
    imageAlt: "青岩古镇的河桥和山地城镇景观",
    fulfillment: "由第三方平台购买与配送",
    priceLabel: "价格以平台页面为准",
    verification: "人工整理入口 · 不代表商家背书"
  },
  fanjingshan: {
    id: "fanjingshan-ticket",
    locationId: "fanjingshan",
    kind: "ticket",
    title: "梵净山 · 预约门票",
    origin: "铜仁江口",
    discoveryHeading: "给未来到访梵净山留一个入口",
    moment: "梵净山的入园日期、线路与余量都会变化。这张卡只把查询入口留在这里，不把任何一天的库存写成已经确认。",
    question: "如果以后想亲自来，要不要先收藏入口，届时再去平台核对日期和入园条件？",
    story: "门票价格与余量以持牌平台实时页面为准；云游四方只在合适的旅程节点提示，不自行承诺库存。",
    image: "/prototype/assets/attractions/PEK-002.jpg",
    imageAlt: "贵州梵净山的山峰与自然景观",
    fulfillment: "平台预约 · 到场核销",
    priceLabel: "以平台实时日期与库存为准",
    verification: "第三方景点详情页 · 2026-08-29 核验"
  },
  zunyi: {
    id: "zunyi-egg-cake-travel-box",
    locationId: "zunyi",
    kind: "physical",
    title: "遵义鸡蛋糕 · 旅行小盒",
    origin: "贵州遵义",
    discoveryHeading: "遵义物产资料里，有一条鸡蛋糕线索",
    moment: "这张卡先记下“遵义鸡蛋糕”这个地方物产名称；具体门店、制作过程和味道仍要逐项核对。",
    question: "要不要先收下这条线索？真正选购时，再核对配料、保质期和具体商家。",
    story: "这里只提供地方物产的第三方检索入口，不替具体商家背书；购买前请核对生产者、配料和保质期。",
    image: "/prototype/assets/culture/FOD-ZY-01.jpg",
    imageAlt: "遵义地方饮食与老城生活",
    fulfillment: "由第三方平台购买与配送",
    priceLabel: "价格以平台页面为准",
    verification: "人工整理入口 · 不代表商家背书"
  },
  hailongtun: {
    id: "hailongtun-future-visit",
    locationId: "hailongtun",
    kind: "ticket",
    title: "海龙屯 · 未来到访入口",
    origin: "贵州遵义",
    discoveryHeading: "给未来到访海龙屯留一个入口",
    moment: "海龙屯需要用双腿读山势。开放时间、票价与入园条件仍要到持牌平台逐日核对。",
    question: "如果以后想亲自走进这座山城，要不要先收藏入口，届时再看当天信息？",
    story: "票价、开放时间和入园条件必须以持牌平台实时页面为准；云游四方不自行承诺库存。",
    image: "/prototype/assets/hailongtun-now-wide.jpg",
    imageAlt: "海龙屯山地遗址与林间石阶",
    fulfillment: "平台预约 · 到场核销",
    priceLabel: "以平台实时日期与库存为准",
    verification: "第三方景点详情页 · 2026-08-29 核验"
  },
  chishui: {
    id: "chishui-sun-vinegar",
    locationId: "chishui",
    kind: "physical",
    title: "赤水晒醋 · 旅行小瓶",
    origin: "贵州赤水",
    discoveryHeading: "赤水物产资料里，有一条晒醋线索",
    moment: "这张卡先记下“赤水晒醋”这个地方物产名称；具体生产者、制作现场和味道仍要逐项核对。",
    question: "要不要先收下这条线索？真正选购时，再核对生产者、配料与执行标准。",
    story: "这里只提供地方物产的第三方检索入口，不替具体商家背书；购买前请核对生产者、配料和执行标准。",
    image: "/prototype/assets/culture/ENV-005.jpg",
    imageAlt: "赤水河谷与地方酿造环境",
    fulfillment: "由第三方平台购买与配送",
    priceLabel: "价格以平台页面为准",
    verification: "人工整理入口 · 不代表商家背书"
  }
};

function discoveryForLocation(locationId) {
  const discovery = DISCOVERIES[locationId];
  if (!discovery) return null;
  const offers = commerceLinks.offersByDiscoveryId?.[discovery.id] || [];
  return {
    ...discovery,
    offers: offers.map((offer) => ({ ...offer })),
    disclosure: {
      prototype: true,
      sponsored: false,
      commercial: commerceLinks.policy?.commercial === true,
      affiliateTracking: commerceLinks.policy?.affiliateTracking === true,
      transactionOwner: "platform",
      message: "非商业的第三方信息入口。支付、收货地址、订单、物流和退款均由所选平台处理；云游四方不读取支付信息。"
    }
  };
}

function cleanText(value, maxLength = 300) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function recommendationPolicy() {
  return { ...DEFAULT_RECOMMENDATION_POLICY, ...(commerceLinks.policy?.recommendation || {}) };
}

function dateIsFresh(value, now, maximumAgeDays) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = now.getTime() - timestamp;
  return ageMs >= 0 && ageMs <= maximumAgeDays * 86_400_000;
}

function validEvidenceSource(source) {
  if (!source?.title || !source?.url) return false;
  try { return new URL(source.url).protocol === "https:"; } catch { return false; }
}

function normalizedRating(evidence) {
  const rating = Number(evidence?.rating);
  const scale = Number(evidence?.ratingScale || 5);
  if (!Number.isFinite(rating) || !Number.isFinite(scale) || rating < 0 || scale <= 0) return null;
  return rating / scale * 5;
}

function offerMeetsRecommendationThreshold(offer, options = {}) {
  const policy = { ...recommendationPolicy(), ...(options.policy || {}) };
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const evidence = offer?.recommendationEvidence;
  const sources = (evidence?.sources || []).filter(validEvidenceSource);
  const independentSourceCount = Number(evidence?.independentSourceCount ?? sources.length);
  const reviewCount = Number(evidence?.reviewCount);
  const positiveRate = Number(evidence?.positiveRate);
  const rating = normalizedRating(evidence);
  const directLink = ["detail", "product"].includes(offer?.linkType);
  let httpsLink = false;
  try { httpsLink = new URL(offer?.href).protocol === "https:"; } catch { /* invalid links never qualify */ }
  return Boolean(
    directLink
    && httpsLink
    && dateIsFresh(evidence?.verifiedAt, now, policy.maximumEvidenceAgeDays)
    && independentSourceCount >= policy.minimumIndependentReviewSources
    && sources.length >= policy.minimumIndependentReviewSources
    && reviewCount >= policy.minimumReviewCount
    && rating != null && rating >= policy.minimumRatingOutOfFive
    && positiveRate >= policy.minimumPositiveRate
  );
}

function locationResearchSourceCount(context) {
  const sources = new Set();
  for (const result of context?.localResults || []) {
    if (result.sources?.length) {
      for (const source of result.sources) sources.add(source.url || source.title);
    } else if (result.title) sources.add(`knowledge:${result.title}`);
  }
  for (const result of context?.web?.results || []) sources.add(result.url || result.title);
  return sources.size;
}

function userOptedOut(question, conversationHistory, userMemory) {
  if (RECOMMENDATION_OPTOUT_PATTERN.test(cleanText(question, 800))) return true;
  const recentUserText = (conversationHistory || [])
    .filter((item) => item?.role === "user")
    .slice(-12)
    .map((item) => cleanText(item.content ?? item.text, 600))
    .join("\n");
  if (RECOMMENDATION_OPTOUT_PATTERN.test(recentUserText)) return true;
  return (userMemory?.features || []).some((feature) =>
    ["constraint", "preference"].includes(feature?.category) && RECOMMENDATION_OPTOUT_PATTERN.test(cleanText(feature.value, 240))
  );
}

function recommendationHistoryAllows(journey, discoveryId, now, policy) {
  const history = (journey?.events || []).filter((event) => event?.type === "commerce_recommended");
  if (history.some((event) => event?.data?.discoveryId === discoveryId)) return false;
  if (history.length >= policy.maximumPerJourney) return false;
  const cutoff = now.getTime() - policy.cooldownHours * 60 * 60 * 1000;
  return !history.some((event) => Date.parse(event.at || "") >= cutoff);
}

function recommendationGate(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const policy = { ...recommendationPolicy(), ...(options.policy || {}) };
  const locationId = options.context?.location?.id || options.locationId;
  const discovery = options.discovery || discoveryForLocation(locationId);
  if (!options.journey?.id) return { eligible: false, reason: "journey_required" };
  if (!discovery || discovery.locationId !== locationId) return { eligible: false, reason: "no_location_candidate" };
  if (options.journey.state?.currentLocationId && options.journey.state.currentLocationId !== locationId) return { eligible: false, reason: "location_mismatch" };
  if (!RECOMMENDATION_INTEREST_PATTERN.test(cleanText(options.question, 800))) return { eligible: false, reason: "no_user_interest" };
  if (userOptedOut(options.question, options.conversationHistory, options.userMemory)) return { eligible: false, reason: "user_opted_out" };
  const locationSourceCount = locationResearchSourceCount(options.context);
  if (locationSourceCount < policy.minimumLocationSources) return { eligible: false, reason: "insufficient_location_research" };
  const offers = (discovery.offers || []).filter((offer) => offerMeetsRecommendationThreshold(offer, { policy, now }));
  if (!offers.length) return { eligible: false, reason: "insufficient_review_evidence" };
  if (!recommendationHistoryAllows(options.journey, discovery.id, now, policy)) return { eligible: false, reason: "frequency_limited" };
  return { eligible: true, discovery, offers, locationSourceCount, policy, now };
}

function parseDecision(value) {
  const text = String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(text); } catch { return null; }
}

function evidenceSummary(offer, locationSourceCount) {
  const evidence = offer.recommendationEvidence;
  const rating = normalizedRating(evidence);
  return `${locationSourceCount} 条地点资料 · ${evidence.independentSourceCount ?? evidence.sources.length} 个独立评价来源 · ${evidence.reviewCount} 条评价 · ${rating.toFixed(1)}/5`;
}

async function recommendationForConversation(options = {}) {
  const gate = recommendationGate(options);
  if (!gate.eligible) return null;
  const replyAi = options.config?.replyAi || options.config?.ai;
  if (!replyAi?.configured) return null;
  const candidate = gate.discovery;
  const primaryOffer = gate.offers[0];
  const prompt = [
    `用户刚才说：${cleanText(options.question, 800)}`,
    `阿镜已经给出的回答：${cleanText(options.answer, 1600)}`,
    `候选地点或物产：${candidate.title}（${candidate.origin}）`,
    `资料与评价证据：${evidenceSummary(primaryOffer, gate.locationSourceCount)}`,
    `推荐入口：${primaryOffer.platformLabel}；${primaryOffer.note}`,
    "请判断现在是否真的值得额外给出这个第三方入口。"
  ].join("\n\n");
  const system = [
    "你是云游四方里负责克制推荐判断的阿镜。默认不推荐。",
    "只有用户此刻明确表现出相关兴趣，而且链接能继续解决他刚才的问题时，才返回 recommend=true。",
    "即使评价证据达到硬门槛，只要对话正在谈情绪、历史或别的话题，也应拒绝推荐。",
    "不能使用催单、稀缺、错过、必买、闭眼入等销售话术，不替商家、库存、价格和售后背书。",
    "只返回 JSON：{\"recommend\":boolean,\"reason\":\"给用户看的自然短句，不超过60字\"}。"
  ].join("\n");
  try {
    const result = await requestTextModel({
      config: { ...options.config, ai: replyAi },
      fetchImpl: options.fetchImpl || global.fetch,
      system,
      prompt,
      maxTokens: 220,
      json: true
    });
    const decision = parseDecision(result.text);
    if (decision?.recommend !== true) return null;
    const reason = cleanText(decision.reason, 100);
    if (!reason) return null;
    return {
      ...candidate,
      offers: gate.offers.map((offer) => {
        const { recommendationEvidence, ...publicOffer } = offer;
        return publicOffer;
      }),
      question: reason,
      recommendationReason: reason,
      evidenceSummary: evidenceSummary(primaryOffer, gate.locationSourceCount),
      disclosure: { ...candidate.disclosure, message: `${candidate.disclosure.message} 这次入口来自资料与评价门槛判断，不是付费广告。` }
    };
  } catch {
    return null;
  }
}

module.exports = {
  discoveryForLocation,
  recommendationForConversation,
  recommendationGate,
  offerMeetsRecommendationThreshold,
  recommendationPolicy,
  locationResearchSourceCount
};
