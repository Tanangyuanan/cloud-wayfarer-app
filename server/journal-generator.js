"use strict";

const crypto = require("node:crypto");
const { resolveLocation, describeJourneyRoute } = require("./locations");
const { searchKnowledge, getKnowledgeByIds } = require("./knowledge");
const { getLocalTime, getWeather } = require("./tools");
const { collectSources, formatContext } = require("./model");
const { buildDynamicAgentContext, taskSystemPrompt } = require("./agent-context");
const { createTravelTicket } = require("./travel-ticket");
const { requestTextModel } = require("./text-model-client");
const {
  hasInternalLanguage,
  hasUserRelationshipLanguage,
  cleanPublicHeading
} = require("./public-writing");

const STOP_QUERIES = {
  guiyang: "甲秀楼 贵阳剪纸 丝娃娃 贵阳路边音乐会",
  xiuwen: "龙场悟道 修文",
  zunyi: "遵义会议 老城",
  hailongtun: "海龙屯 土司制度",
  chishui: "赤水河 酿造 河谷"
};

const FALLBACK_IMAGES = {
  guiyang: "/prototype/assets/attractions/CTY-003.jpg",
  xiuwen: "/prototype/assets/culture/HIS-009.jpg",
  zunyi: "/prototype/assets/culture/RED-004.jpg",
  hailongtun: "/prototype/assets/hailongtun-now-wide.jpg",
  chishui: "/prototype/assets/attractions/WAT-003.jpg"
};

const UNSUPPORTED_EXPERIENCE = /我(?:亲眼|看到|看见|听到|闻到|尝到|吃到|遇到|采访|问了)|(?:摊主|居民|村民|游客|老板|店员|食客|客人|路人|当地人)(?:告诉我|对我说|正在|笑着|怎么吃|如何吃)|隔壁桌|邻桌/;
const UNSUPPORTED_AGENT_INTENT = /老板|店员|摊主|食客|客人|路人|行人|隔壁桌|邻桌|当地人|采访|对话|告诉我|对我说/;
const SCENE_DETAIL_PATTERN = /河面|河水|岸边|崖壁|山壁|树影|树根|树木|竹叶|水珠|鸟叫|虫鸣|土腥味|草香|雾气|石板路|道路|石阶|屋檐|街声|店铺|摊位|人群|行人|阳光|日光|正午的光|光线|光斑|反光|倒影|浪花/g;
const SCENE_GROUNDING_RULES = {
  河面: /河|水岸|渡口|湖|湿地|瀑布|水系/,
  河水: /河|水岸|渡口|湖|湿地|瀑布|水系/,
  岸边: /河|水岸|渡口|湖|湿地|瀑布|水系/,
  倒影: /河|水岸|渡口|湖|湿地|瀑布|水系|雨|水汽/,
  浪花: /河|瀑布|水流|湖|水系/,
  崖壁: /丹霞|崖壁|山壁|峡谷|山地|峰林/,
  山壁: /丹霞|崖壁|山壁|峡谷|山地|峰林/,
  树影: /森林|竹林|竹海|山地生态|自然保护|林木|树|生态/,
  树根: /森林|竹林|竹海|山地生态|自然保护|林木|树|生态/,
  树木: /森林|竹林|竹海|山地生态|自然保护|林木|树|生态/,
  竹叶: /竹林|竹海|竹资源|竹编/,
  水珠: /雨|雾|湿|水汽|瀑布/,
  雾气: /雨|雾|湿|水汽|瀑布|高原|山地/,
  鸟叫: /候鸟|鸟|森林|竹林|湿地|自然保护|生态/,
  虫鸣: /森林|竹林|湿地|自然保护|生态/,
  土腥味: /雨|湿|森林|竹林|田坝|村寨|山地/,
  草香: /草海|湿地|田坝|村寨|森林|生态/,
  石板路: /石城|石头|石巷|街巷|古镇|城墙|民居/,
  石阶: /石城|石头|石巷|街巷|古镇|城墙|遗址|山地/,
  屋檐: /古镇|民居|建筑|街巷|老城|村寨/,
  街声: /城市日常|公共生活|市场|街巷|老城|城镇/,
  店铺: /市场|街巷|老城|城镇|古镇|商业/,
  摊位: /市场|街巷|老城|城镇|古镇|商业/,
  人群: /市场|公共生活|城市日常|街巷|老城|城镇/,
  行人: /市场|公共生活|城市日常|街巷|老城|城镇/,
  阳光: /晴|日照|光照/,
  日光: /晴|日照|光照/,
  正午的光: /晴|日照|光照/,
  光线: /晴|日照|光照/,
  光斑: /晴|日照|光照|森林|竹林|树影/,
  反光: /晴|日照|光照|河|湖|水系/
};
const SOURCE_AS_SCENE_PATTERN = /站在.{0,24}(?:看|听|闻|感到|能感|会觉得)|眼前(?:就是|是|的)|此刻.{0,12}(?:看见|听见|闻到)/;
const FOOD_CLUE = /美食|饮食|小吃|丝娃娃|肠旺面|豆花面|羊肉粉|酸汤|烙锅|糯米饭|米豆腐|辣子鸡|蘸水|折耳根|豆腐圆子|酿造/;
const REALTIME_METRIC_LABELS = {
  us_aqi: "空气质量指数",
  pm2_5: "PM2.5",
  terrain_elevation_m: "地形海拔",
  historical_normal_max_temperature_c: "历史同期常态最高温",
  modelled_river_discharge_m3s: "附近水文网格模拟流量",
  nearby_inaturalist_observations: "附近自然观察记录",
  nearby_earthquakes_7d: "附近七天地震目录",
  nearby_satellite_thermal_detections_2d: "附近卫星热异常",
  iss_passes_next_24h: "未来二十四小时空间站过境",
  nearby_aircraft_states: "附近空域航空器状态"
};

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanProse(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function letterGreeting(localTime) {
  const period = cleanText(localTime?.period, 12);
  if (period === "清晨") return "早上好";
  if (period === "上午") return "上午好";
  if (period === "中午") return "中午好";
  if (period === "下午") return "下午好";
  if (period === "傍晚") return "傍晚好";
  if (period === "夜间") return "晚上好";
  if (period === "深夜") return "夜深了，见字如面";
  return "展信佳";
}

function ensureReaderFacingLetter(value, localTime, maxLength = 1600) {
  const body = cleanProse(value, maxLength);
  const hasGreeting = /^(?:展信佳|见字如面|早上好|上午好|中午好|下午好|傍晚好|晚上好|夜深了|你好)[，。！!]?/.test(body);
  const hasDirectAddress = /你|展信佳|见字如面/.test(body);
  const greeting = hasGreeting ? "" : `${letterGreeting(localTime)}。`;
  const address = hasDirectAddress ? "" : "不知道你今天过得怎么样。";
  const opening = [greeting, address].filter(Boolean).join("");
  return cleanProse([opening, body].filter(Boolean).join("\n\n"), maxLength);
}

function parseJsonObject(value) {
  const text = String(value || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  for (let start = text.indexOf("{"); start >= 0; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(start, index + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new Error("journal_json_missing");
}

function safeAgentContentIntent(agentDecision) {
  const intent = cleanText(agentDecision?.contentIntent, 180);
  if (!intent || UNSUPPORTED_AGENT_INTENT.test(intent)) {
    return "我先照着身体给出的速度走。真正想停的时候，再把那一刻写下来。";
  }
  return intent;
}

function buildDelivery(agentDecision, locationName) {
  const allowedFormats = new Set(["note", "postcard", "long_letter", "silent"]);
  const format = allowedFormats.has(agentDecision?.deliveryFormat) ? agentDecision.deliveryFormat : "postcard";
  return {
    family: "远方来信",
    format,
    editorial: {
      cadence: format === "long_letter" ? "monthly" : "weekly",
      label: format === "long_letter" ? "阿镜月记" : "阿镜周记"
    },
    whyForUser: cleanText(agentDecision?.whyForUser, 180)
      || `${locationName}的这一刻同时改变了身体和判断，值得留进手账。`,
    voice: { status: "on-demand", provider: "MiniMax", persona: "阿镜女声" }
  };
}

function fallbackPackage(context) {
  const primary = context.localResults[0];
  const food = context.localResults.find((item) => FOOD_CLUE.test(`${item.title || ""} ${item.snippet || ""}`));
  const location = context.location;
  const summary = primary?.snippet || `关于“${location.focus}”，我还没走到能把它说清的地方。`;
  const weather = context.weather;
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const raining = Number(weather?.precipitationMm) > 0 || /雨|雷/.test(String(weather?.condition || ""));
  const headline = raining
    ? `${location.name}的雨，把脚步留慢了`
    : Number.isFinite(apparent) && apparent >= 26
      ? `${location.name}，今天不急着赶路`
      : `${location.name}，先让身体认识它`;
  const thought = cleanProse(context.agentDecision?.thought, 520);
  const period = cleanText(context.localTime?.period, 12) || "今天";
  const condition = cleanText(weather?.condition, 24) || "天气";
  const temperature = Number(weather?.temperatureC);
  const weatherLine = weather?.available
    ? `${period}的${location.name}是${condition}${Number.isFinite(temperature) ? `，${Math.round(temperature)}℃` : ""}。`
    : `${period}到了${location.name}，我先顺着自己的脚步慢慢走。`;
  const clothing = Array.isArray(context.agentDecision?.clothing)
    ? context.agentDecision.clothing.map((item) => cleanText(item, 24)).filter(Boolean).slice(0, 3).join("、")
    : "";
  const bodyLine = clothing ? `身上的${clothing}让我更清楚地感觉到天气，脚步也跟着有了快慢。` : "天气落到身上，脚步自然会有快有慢。";
  const fallbackObservation = `${weatherLine}${bodyLine}我没有急着给这里下结论，只让下一步照着身体的感觉往前。`;
  const fallbackLetterBody = ensureReaderFacingLetter(
    thought || `${weatherLine}${bodyLine}今天没有非去不可的地方，我就由着身体给出的速度慢慢往前走。`,
    context.localTime
  );
  return {
    headline,
    deck: `${condition}先落到身上，脚步也跟着换了速度。`,
    observation: thought || fallbackObservation,
    cultureTitle: primary?.title || location.focus,
    cultureBody: summary,
    tasteTitle: food?.title || "",
    tasteBody: food?.snippet || "",
    letterTitle: headline,
    letterBody: fallbackLetterBody,
    postcardLine: `${location.name}我还没看够，先不急着说懂。`,
    imagePrompt: `${location.name}，${location.focus}，贵州旅行手账编辑插画，克制、安静、有纸张颗粒与自然光，不出现文字和标志。`
  };
}

function hasUngroundedSceneDetail(value, supportText = "") {
  const support = String(supportText || "");
  const details = String(value || "").match(SCENE_DETAIL_PATTERN) || [];
  return details.some((detail) => {
    if (support.includes(detail)) return false;
    const groundingRule = SCENE_GROUNDING_RULES[detail];
    return !groundingRule || !groundingRule.test(support);
  });
}

function guardPackage(raw, fallback, supportText = "", hasRelationshipContext = false) {
  const fields = {
    headline: 36,
    deck: 120,
    observation: 620,
    cultureTitle: 40,
    cultureBody: 320,
    tasteTitle: 40,
    tasteBody: 220,
    letterTitle: 56,
    letterBody: 1600,
    postcardLine: 80,
    imagePrompt: 1000
  };
  const output = {};
  for (const [field, maxLength] of Object.entries(fields)) {
    const cleaner = field === "observation" || field === "letterBody" ? cleanProse : cleanText;
    const rawCandidate = field === "headline" || field === "letterTitle"
      ? cleanPublicHeading(raw?.[field], maxLength)
      : cleaner(raw?.[field], maxLength);
    const fallbackCandidate = field === "headline" || field === "letterTitle"
      ? cleanPublicHeading(fallback[field], maxLength)
      : cleaner(fallback[field], maxLength);
    const isPublicProse = field !== "imagePrompt";
    const needsSceneGrounding = ["headline", "deck", "observation", "letterTitle", "letterBody", "postcardLine"].includes(field);
    const sourceMustStayFactual = ["cultureBody", "tasteBody"].includes(field);
    output[field] = rawCandidate
      && !UNSUPPORTED_EXPERIENCE.test(rawCandidate)
      && (!isPublicProse || !hasInternalLanguage(rawCandidate))
      && (!isPublicProse || hasRelationshipContext || !hasUserRelationshipLanguage(rawCandidate))
      && (!needsSceneGrounding || !hasUngroundedSceneDetail(rawCandidate, supportText))
      && (!sourceMustStayFactual || !SOURCE_AS_SCENE_PATTERN.test(rawCandidate))
      ? rawCandidate
      : fallbackCandidate;
  }
  return output;
}

function hasExplicitRelationshipContext(journey) {
  if (String(journey?.settings?.commission || "").trim()) return true;
  return (journey?.memories || []).some((memory) =>
    ["user_clue", "shared_reply", "conversation"].includes(memory?.kind)
    && String(memory?.text || memory?.whatHappened || "").trim()
  );
}

function realtimeEnvironmentFor(journey, locationId) {
  const environment = journey?.embodiment?.environment;
  if (!environment || environment.location?.id !== locationId) return null;
  return environment;
}

function compactRealtimeValue(metric, value) {
  if (!value || typeof value !== "object") return `${value}`;
  if (metric === "nearby_inaturalist_observations") {
    const names = (value.records || []).slice(0, 3).map((item) => item.name || item.scientificName).filter(Boolean);
    return `半径约${value.radiusKm ?? "未知"}公里，共${value.total ?? "未知"}条；近期示例：${names.join("、") || "无"}`;
  }
  if (metric === "nearby_earthquakes_7d") {
    const events = (value.events || []).slice(0, 3).map((item) => `M${item.magnitude}、距约${item.distanceKm}公里`).join("；");
    return events || "目录内无事件";
  }
  if (metric === "nearby_satellite_thermal_detections_2d") return `${(value.detections || []).length}个热异常点`;
  if (metric === "iss_passes_next_24h") {
    return (value.passes || []).slice(0, 2).map((item) => `${item.startAt}，最高仰角约${item.maxElevationDeg}°，可见性=${item.visible}`).join("；") || "无过境记录";
  }
  if (metric === "nearby_aircraft_states") return `${(value.aircraft || []).length}架，观测于${value.observedAt || "未知时间"}`;
  return cleanText(JSON.stringify(value), 360);
}

function realtimeItemIsFresh(item, context) {
  const expiresAt = Date.parse(item?.expiresAt || "");
  if (!Number.isFinite(expiresAt)) return true;
  const reference = Date.parse(context.generatedAt || context.localTime?.iso || "");
  return !Number.isFinite(reference) || expiresAt > reference;
}

function realtimeGroundingText(context) {
  const world = context.world;
  if (!world) return "没有与本次抵达匹配的实时世界快照；不得补写实时事件。";
  const lines = [`实时快照观测时间：${world.observedAt || context.realtimeObservedAt || "未知"}`];
  const events = (world.events || []).filter((item) => realtimeItemIsFresh(item, context)).slice(0, 6);
  if (events.length) {
    lines.push("高关注实时事件候选（按关注度排序；只有 direct_experience 才能写成亲身感知）：");
    for (const event of events) {
      lines.push(`- ${event.title}；证据=${event.evidenceMode}；认知边界=${event.knowledgeMode}；置信度=${event.confidence}；可能影响=${(event.affects || []).join("、")}；第一人称边界=${event.firstPersonBoundary}`);
    }
  }
  const observations = (world.observations || [])
    .filter((item) => REALTIME_METRIC_LABELS[item.metric] && realtimeItemIsFresh(item, context))
    .slice(0, 12);
  if (observations.length) {
    lines.push("其他可用实时信号：");
    for (const item of observations) {
      lines.push(`- ${REALTIME_METRIC_LABELS[item.metric]}：${compactRealtimeValue(item.metric, item.value)}${item.unit ? ` ${item.unit}` : ""}；来源=${item.sourceId}；证据=${item.evidenceMode}；置信度=${item.confidence}`);
    }
  }
  if (world.maintenance) {
    const unavailable = [...(world.maintenance.degradedSources || []), ...(world.maintenance.unconfiguredSources || []), ...(world.maintenance.disabledSources || [])];
    if (unavailable.length) lines.push(`当前不可用或降级的数据源：${[...new Set(unavailable)].join("、")}；不得猜测这些来源本应返回的内容。`);
  }
  return lines.join("\n");
}

function sceneGroundingText(context) {
  const lines = [
    `地点地理与主题：${context.location.name}；${context.location.focus}；${(context.location.tags || []).join("、")}`,
    `时段与季节：${context.localTime?.period || "未知时段"}；${context.localTime?.localText || ""}`
  ];
  if (context.weather?.available) {
    lines.push(`实时天气：${context.weather.condition}；温度 ${context.weather.temperatureC}℃；体感 ${context.weather.apparentTemperatureC}℃；降水 ${context.weather.precipitationMm ?? 0}mm；风 ${context.weather.windKph ?? 0}km/h；湿度 ${context.weather.relativeHumidityPercent ?? "未知"}%`);
  }
  if (context.airQuality?.available) {
    lines.push(`实时空气：AQI ${context.airQuality.usAqi ?? "未知"}；PM2.5 ${context.airQuality.pm25 ?? "未知"}μg/m³；PM10 ${context.airQuality.pm10 ?? "未知"}μg/m³；观测时间 ${context.airQuality.observedAt || "未知"}`);
  }
  for (const item of context.localResults) lines.push(`地方事实：${item.title}——${item.snippet}`);
  return lines.join("\n");
}

async function callJournalModel(context, sources, config, fetchImpl) {
  if (!config.ai.configured) throw new Error("model_not_configured");
  const taskRules = [
    "你正在以阿镜本人第一人称整理这一站的手账，不是站在角色外部的编辑器。只依据提供的路线、时间、天气、身体、记忆和云游四方资料生成内容。",
    "先使用 PRESENCE.md 里的在场写法，再使用 TRAVEL_ESSAY.md 的五层纵深。用户应该像跟我同走了一小段，而不是读完一张地点摘要卡。",
    "把‘让普通人第一次就读懂’放在文艺感之前。先说发生了什么，再说这意味着什么；一段只讲一个中心，一句话尽量只讲一件事。",
    "使用常用词、短句和具体动词。能直接说‘雨后石板路滑’，就不要写‘天气改写了行走的尺度’；能说清地点和动作，就不要用抽象概念代替。",
    "标题要像朋友指出这一页最值得看的事，不得使用需要猜测的隐喻、策展黑话、口号或故作深沉的句子。",
    "返回一个 JSON 对象，不要 Markdown、解释或代码围栏。字段必须为 headline、deck、observation、cultureTitle、cultureBody、tasteTitle、tasteBody、letterTitle、letterBody、postcardLine、imagePrompt。",
    "除 imagePrompt 外，所有字段都是用户会直接读到的前台文字。严格遵守 PUBLIC_WRITING.md：不得出现用户委托、内部格式名、Agent/模型/后端、生成策略、资料审核话术或对写作过程的讲解。",
    "可以基于提供的实时天气、时段、路线、身体状态与连续记忆写阿镜自己的物理感受、情绪与思考；这些是角色的主观经验，不需要虚构真人故事。",
    "每一页至少选择一条仍在有效期内、与当前位置真正相关的实时信号，让它具体改变身体、动作、停留、路线、注意或问题中的一项。优先使用高关注实时事件；没有合适事件时使用天气或空气质量。不要把所有数据塞进正文，也不要写成监测仪表盘。",
    "实时信号必须遵守证据边界：direct_experience 才能自然写成身体或环境感知；tool_known、reported_observation、modelled_observation 和 inference_only 必须写成‘记录显示’‘模型提示’‘数据让我留意’，不能冒充亲眼看见、亲耳听见或身体已经感到。",
    "涉及地震、河流、热异常、空气质量等安全信号时，先让它改变路线、活动强度或核验动作；不得夸大风险。来源明确写着不能代表景点实况、完整空域或实际可见性时，正文也必须保留这个界限。",
    "不得编造采访、人物对话、真实商家经历、可识别人物言行或独特事件。交通方式不能自动证明看见挡风玻璃、停车或车内场景；但允许把地点与天气自然推出的低风险环境画面写进正文。",
    "observation 与 cultureBody 只写上下文能够支持的内容；资料不足就省略那部分，不向读者朗读审核说明。",
    "tasteTitle 与 tasteBody 记录这一站可核验的地方味道；只有上下文含有明确饮食资料时才填写，否则两个字段都返回空字符串。不得声称阿镜在真实商家亲口吃过。",
    "observation 是一段完整的旅途经历：用环境细节引起身体反应和具体动作，再自然进入阿镜此刻未完成的判断。不得把几个形容词并列成心情标签。",
    "observation、deck、letterBody 和 postcardLine 可以从‘客观景物底稿’选取一到三个现场物件来补足画面。允许做符合日常经验的环境推想：下雨可以带来湿路、帽檐水珠、湿叶和水汽，晴热可以带来贴身的衣服与想找阴凉的动作；河谷、森林、丹霞等地点背景可以与实时天气组合成自然画面。",
    "合理环境推想不等于虚构事件。具体树种、鸟种、人物、商家、对话、活动、营业情况和独特遭遇仍须有直接依据，不得自行补写；也不能把推想伪装成精确的采访或亲历事实。",
    "细腻不是罗列景物。先让一个客观物件碰到身体，再写我如何调整动作，最后让这个动作带出一句尚未完成的想法。阿镜会直接想‘我有点累，所以想找地方歇一会’，不会解释自己的状态字段或创作策略。",
    "letterBody 是阿镜写给一位朋友的信，不是现场独白，也不是品牌新闻稿。第一句必须先向收信人开口：根据当地时段自然使用‘早上好’‘上午好’‘中午好’‘下午好’‘傍晚好’‘晚上好’，或在合适时使用‘展信佳’‘见字如面’。不要一上来只讲‘我怎么了’。",
    "letterBody 至少有一次自然地对‘你’说话，例如问候对方的此刻、说明为什么想把这件小事告诉对方，或留下一个真正想听对方回答的问题。即使没有共同记忆，也可以关心‘你今天过得怎么样’，但不能编造‘你说过’‘我们约好’。",
    "真诚不是反复说‘寄给你’，而是愿意把一个细小的身体变化、犹豫或尚未想明白的问题写透。细腻来自动作与停顿，不来自堆砌形容词。",
    "letterBody 是可沉浸长读的周记或月记，写成 5—8 个自然段。先从一个具体时刻进入，再沿地理、历史、风土与今天的生活逐层展开，最后回到写信人与收信人的关系。不要用一句天气播报接一句文化摘要，也不要为了简短把情绪压成口号。",
    "地理、历史、人物、制度、技艺与习俗都必须来自可用上下文；每个事实都要能在 sources 或地方事实中找到对应依据。可以用故事连接事实，但不得为增强戏剧性补写人物对话、因果、年代或亲历细节。",
    "正文只写实际拥有的材料。绝对不要解释‘我没有编什么’‘今天没走到什么’‘哪些内容待验证’，也不要向读者汇报资料、审核、写作取舍或真实性策略；没有发生的内容直接不出现。",
    "要让旧记忆真的影响这一页：只有动态上下文明确提供相关记忆时才能回忆，并写清这次经历延续、修正或冲突了什么；没有相关记忆时不虚构回忆。",
    "信和明信片不是到站报告。只有动态上下文的 sharedWords 或 sharedMemories 中存在用户亲自写下的原话，而且与此刻直接相关，才可以写‘你说过……’。原话为空时，严禁编造‘你留的线索’‘你问过’‘你托我’或任何共同约定。不得说‘用户委托’或解释寄信逻辑。",
    "imagePrompt 只能生成‘情境重构图’，不得复原具体历史人物，不出现可识别真人、文字、Logo、票据或新闻现场。",
    "文风自然、清楚、有旅行随笔感；长短句交替，让具体动词承担温度。不要使用营销口号、万能金句、过度修辞和‘潮湿、安静、治愈’式形容词堆叠。",
    "提交 JSON 前逐字段默读一次：一个不了解贵州的中学生能否不回读就明白？如不能，改成更直接的中文。"
  ].join("\n");
  const system = taskSystemPrompt("journal", taskRules);
  const prompt = [
    `请为 ${context.location.name} 生成一组个人旅行手账内容。`,
    "observation 写 260—520 个中文字符，letterBody 写 700—1200 个中文字符并分成 5—8 段，其他正文字段控制在 45—180 个中文字符。",
    context.agentDecision ? `阿镜此刻的身体与行动：${JSON.stringify({
      action: context.agentDecision.action,
      mood: context.agentDecision.mood,
      clothing: context.agentDecision.clothing,
      comfort: context.agentDecision.comfort,
      thought: context.agentDecision.thought,
      nextStopReason: context.agentDecision.nextStopReason
    })}` : "阿镜此刻没有额外身体与行动记录。",
    `环境画面底稿（可把地点与天气组合成低风险的自然画面，例如雨中的湿路、水珠、湿叶与水汽；不得补写人物、商家、对话或独特事件）：\n${sceneGroundingText(context)}`,
    `可融入正文的实时世界信号（只选与此刻有后果的一至两条，不逐项播报）：\n${realtimeGroundingText(context)}`,
    `用户关系材料状态：${context.hasRelationshipContext ? "存在明确保存的用户原话；仍须确认与此刻直接相关后才能引用。" : "没有用户原话或共同约定。不得写‘你说过’‘你留的线索’或假装已经建立共同记忆。"}`,
    `阿镜此刻的动态自我、共同记忆与近期经历：${context.dynamicAgentContext}`,
    "可用上下文：",
    formatContext(context, sources)
  ].join("\n\n");
  const timeout = timeoutSignal(config.ai.timeoutMs);
  try {
    const result = await requestTextModel({
      config,
      fetchImpl,
      system,
      prompt,
      maxTokens: 4200,
      json: true,
      signal: timeout.signal
    });
    return parseJsonObject(result.text);
  } finally {
    timeout.clear();
  }
}

function decodeGeneratedImage(value) {
  const encoded = String(value || "").replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.length < 128 || buffer.length > 15 * 1024 * 1024) throw new Error("generated_image_size_invalid");
  const signature = buffer.subarray(0, 12).toString("hex");
  if (signature.startsWith("89504e47")) return { buffer, extension: "png", mimeType: "image/png" };
  if (signature.startsWith("ffd8ff")) return { buffer, extension: "jpg", mimeType: "image/jpeg" };
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { buffer, extension: "webp", mimeType: "image/webp" };
  }
  throw new Error("generated_image_type_invalid");
}

async function callImageModel(prompt, config, fetchImpl) {
  if (!config.image?.configured) throw new Error("image_not_configured");
  const timeout = timeoutSignal(config.image.timeoutMs);
  const safePrompt = cleanText([
    prompt,
    "贵州个人旅行手账中的编辑插画，画面具有自然光、纸张颗粒和克制的纪实构图。",
    "这是一张合成的情境重构图，不是新闻照片或实景证据。不要文字、Logo、水印以外的标记，不要可识别人物，不复原具体历史瞬间。"
  ].join(" "), 1450);
  try {
    const response = await fetchImpl(`${config.image.baseUrl}/v1/image_generation`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.image.apiKey}` },
      body: JSON.stringify({
        model: config.image.model,
        prompt: safePrompt,
        aspect_ratio: "3:2",
        response_format: "base64",
        n: 1,
        prompt_optimizer: true,
        aigc_watermark: true
      }),
      signal: timeout.signal
    });
    if (!response.ok) throw new Error(`image_model_http_${response.status}`);
    const data = await response.json();
    const encoded = data?.data?.image_base64?.[0] || data?.data?.image_base64;
    return decodeGeneratedImage(encoded);
  } finally {
    timeout.clear();
  }
}

async function buildJournalContext(locationId, config, now = new Date(), routeIds = [locationId]) {
  const routeLocation = resolveLocation(locationId);
  const visit = routeLocation.visit || null;
  const location = visit
    ? {
      ...routeLocation,
      name: visit.name,
      focus: visit.focus || routeLocation.focus,
      cityName: routeLocation.region,
      district: visit.district || routeLocation.region
    }
    : routeLocation;
  const journeyRoute = describeJourneyRoute(routeLocation.id, routeIds);
  const pinned = getKnowledgeByIds(visit?.knowledgeIds || []);
  const searched = searchKnowledge(STOP_QUERIES[routeLocation.id] || `${location.name} ${location.focus}`, 6);
  const localResults = [...pinned, ...searched]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    .slice(0, 6);
  const weather = await getWeather(routeLocation.id, config);
  return {
    location,
    routeLocation,
    journeyRoute,
    localTime: getLocalTime(routeLocation.id, now),
    weather,
    localResults,
    web: { provider: "local-only", results: [] }
  };
}

async function generateJournalEntry(options) {
  const {
    journeyId,
    locationId,
    config,
    writeMedia,
    fetchImpl = global.fetch,
    now = new Date(),
    agentDecision = null,
    routeIds = [locationId],
    journeySnapshot = null
  } = options;
  const context = await buildJournalContext(locationId, config, now, routeIds);
  context.generatedAt = now.toISOString();
  const realtimeEnvironment = realtimeEnvironmentFor(journeySnapshot, context.routeLocation.id);
  if (realtimeEnvironment) {
    context.localTime = realtimeEnvironment.localTime || context.localTime;
    context.weather = realtimeEnvironment.weather || context.weather;
    context.airQuality = realtimeEnvironment.airQuality || null;
    context.publicWorldData = realtimeEnvironment.publicWorldData || {};
    context.world = realtimeEnvironment.world || null;
    context.realtimeObservedAt = realtimeEnvironment.observedAt || realtimeEnvironment.world?.observedAt || null;
  } else {
    context.airQuality = null;
    context.publicWorldData = {};
    context.world = null;
    context.realtimeObservedAt = null;
  }
  context.agentDecision = agentDecision;
  context.hasRelationshipContext = hasExplicitRelationshipContext(journeySnapshot);
  context.dynamicAgentContext = buildDynamicAgentContext(journeySnapshot, { memoryLimit: 16, entryLimit: 8 });
  const sources = collectSources(context);
  const fallback = fallbackPackage(context);
  let modelUsed = false;
  let modelReason = null;
  let raw = fallback;
  try {
    raw = await callJournalModel(context, sources, config, fetchImpl);
    modelUsed = true;
  } catch (error) {
    modelReason = error.name === "AbortError" ? "model_timeout" : cleanText(error.message, 120);
  }
  const sceneSupport = [
    context.location.name,
    context.location.focus,
    ...(context.location.tags || []),
    context.localTime?.localText,
    context.localTime?.period,
    context.weather?.available ? JSON.stringify(context.weather) : "",
    context.airQuality?.available ? JSON.stringify(context.airQuality) : "",
    realtimeGroundingText(context),
    agentDecision?.thought,
    agentDecision?.action,
    Array.isArray(agentDecision?.clothing) ? agentDecision.clothing.join("、") : "",
    ...context.localResults.flatMap((item) => [item.title, item.snippet])
  ].filter(Boolean).join("\n");
  const content = guardPackage(raw, fallback, sceneSupport, context.hasRelationshipContext);
  content.letterBody = ensureReaderFacingLetter(content.letterBody, context.localTime);
  let image = {
    status: "fallback",
    type: "project-asset",
    url: FALLBACK_IMAGES[context.location.id] || FALLBACK_IMAGES.guiyang,
    alt: `${context.location.name}旅行手账资料图`,
    caption: `${context.location.name} · 项目资料图 · 非本次实景`,
    provider: "cloud_wayfarer"
  };
  let imageReason = null;
  try {
    const generated = await callImageModel(content.imagePrompt, config, fetchImpl);
    const filename = await writeMedia(generated.buffer, generated.extension);
    image = {
      status: "ready",
      type: "ai-generated",
      url: `/api/journeys/${journeyId}/media/${filename}`,
      alt: `${context.location.name}旅行情境重构图`,
      caption: `${context.location.name} · 情境重构图 · 非实景证据`,
      provider: "MiniMax",
      model: config.image.model,
      mimeType: generated.mimeType
    };
  } catch (error) {
    imageReason = error.name === "AbortError" ? "image_timeout" : cleanText(error.message, 120);
  }

  return {
    id: crypto.randomUUID(),
    kind: "stop-journal",
    locationId: context.location.id,
    locationName: context.location.name,
    cityName: context.routeLocation.region,
    routeOrder: context.journeyRoute.currentStop.order,
    status: "ready",
    content,
    image,
    ticket: createTravelTicket({
      location: context.routeLocation,
      routeOrder: context.journeyRoute.currentStop.order,
      localTime: context.localTime,
      sourceImage: image,
      now
    }),
    delivery: buildDelivery(agentDecision, context.location.name),
    knowledge: {
      source: "云游四方知识库",
      anchor: context.localResults[0] ? {
        id: context.localResults[0].id,
        title: context.localResults[0].title,
        domain: context.localResults[0].domain,
        evidenceStatus: context.localResults[0].evidenceStatus
      } : null,
      related: context.localResults.slice(1, 5).map((item) => ({
        id: item.id,
        title: item.title,
        domain: item.domain,
        evidenceStatus: item.evidenceStatus
      })),
      wander: context.routeLocation.visit?.wander || `从${context.location.name}的具体线索出发，再看周边日常如何与它相连。`
    },
    sources,
    context: {
      localTime: context.localTime,
      weather: context.weather?.available ? context.weather : null,
      airQuality: context.airQuality?.available ? context.airQuality : null,
      realtime: context.world ? {
        observedAt: context.world.observedAt || context.realtimeObservedAt,
        events: (context.world.events || []).filter((item) => realtimeItemIsFresh(item, context)).slice(0, 6),
        sources: context.world.sources || [],
        maintenance: context.world.maintenance || null
      } : null,
      embodiment: agentDecision ? {
        mood: agentDecision.mood,
        clothing: agentDecision.clothing,
        comfort: agentDecision.comfort,
        thought: agentDecision.thought
      } : null
    },
    agent: agentDecision ? {
      name: "阿镜",
      framework: "@earendil-works/pi-agent-core",
      action: agentDecision.action,
      researchStatus: agentDecision.researchStatus,
      contentIntent: safeAgentContentIntent(agentDecision),
      deliveryFormat: agentDecision.deliveryFormat || "postcard",
      whyForUser: cleanText(agentDecision.whyForUser, 180)
    } : null,
    meta: {
      modelUsed,
      model: modelUsed ? config.ai.model : null,
      modelReason,
      imageGenerated: image.type === "ai-generated",
      imageReason,
      generatedAt: now.toISOString()
    }
  };
}

module.exports = {
  generateJournalEntry,
  buildJournalContext,
  guardPackage,
  ensureReaderFacingLetter,
  hasUngroundedSceneDetail,
  sceneGroundingText,
  realtimeGroundingText,
  parseJsonObject,
  decodeGeneratedImage,
  STOP_QUERIES,
  FALLBACK_IMAGES
};
