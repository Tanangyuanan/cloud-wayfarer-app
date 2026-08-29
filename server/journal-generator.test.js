"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generateJournalEntry, guardPackage, parseJsonObject, decodeGeneratedImage, hasUngroundedSceneDetail, ensureReaderFacingLetter } = require("./journal-generator");

function generatorConfig() {
  return {
    ai: {
      configured: true,
      provider: "deepseek",
      apiFormat: "openai",
      baseUrl: "https://api.deepseek.com",
      apiKey: "test-secret",
      model: "deepseek-v4-pro",
      temperature: 0.35,
      timeoutMs: 1000
    },
    image: {
      configured: true,
      baseUrl: "https://api.minimaxi.com",
      apiKey: "test-secret",
      model: "image-01",
      timeoutMs: 1000
    },
    weather: { enabled: false, timeoutMs: 100 }
  };
}

test("结构化手账生成会调用文本与图片模型并保留来源", async () => {
  const jpeg = Buffer.alloc(256, 0);
  jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body), headers: options.headers });
    if (String(url).endsWith("/chat/completions")) {
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          headline: "贵阳，从水边开始",
          deck: "雨停在南明河边，脚步也跟着慢下来。",
          observation: "甲秀楼与南明河构成贵阳城市阅读的一处入口。",
          cultureTitle: "水边长出的省城",
          cultureBody: "从桥、河道与街巷理解城市公共生活。",
          tasteTitle: "一碟蘸水收住十几种清脆",
          tasteBody: "丝娃娃以薄面皮包入多种配菜，再由酸辣蘸水定味。",
          letterTitle: "先寄回一条城市线索",
          letterBody: "雨停以后，河边的光亮了一层。我没有赶着往前，只想把这点缓慢留给你。",
          postcardLine: "城市从水边展开。",
          imagePrompt: "贵阳水岸与甲秀楼的旅行手账情境图"
        }) } }] })
      };
    }
    return { ok: true, json: async () => ({ data: { image_base64: [jpeg.toString("base64")] } }) };
  };
  let saved;
  const entry = await generateJournalEntry({
    journeyId: "11111111-1111-4111-8111-111111111111",
    locationId: "guiyang",
    config: generatorConfig(),
    fetchImpl,
    now: new Date("2026-08-29T08:00:00.000Z"),
    writeMedia: async (buffer, extension) => { saved = { buffer, extension }; return "image.jpg"; },
    agentDecision: {
      action: "linger",
      mood: "安静",
      clothing: ["薄外套"],
      comfort: 76,
      thought: "雨停以后，我想把这一小段寄回来。",
      contentIntent: "记录水岸与天气如何改变路线。",
      deliveryFormat: "note",
      whyForUser: "你说过想知道贵州普通的一天，所以这一页只寄给此刻的你。",
      researchStatus: "not-needed"
    },
    journeySnapshot: {
      id: "11111111-1111-4111-8111-111111111111",
      settings: { commission: "下雨时，替我留意屋檐和居住的声音。", theme: "贵州日常" },
      state: { currentLocationId: "guiyang", phase: "arrived" },
      embodiment: {
        energy: 72,
        mood: "安静",
        environment: {
          location: { id: "guiyang", name: "贵阳" },
          localTime: { iso: "2026-08-29T08:00:00.000Z", localText: "2026/08/29周六 16:00:00", period: "下午", timezone: "Asia/Shanghai" },
          observedAt: "2026-08-29T08:00:00.000Z",
          weather: {
            available: true,
            condition: "小雨",
            temperatureC: 24,
            apparentTemperatureC: 25,
            precipitationMm: 0.8,
            windKph: 9,
            relativeHumidityPercent: 88,
            observedAt: "2026-08-29T16:00",
            fetchedAt: "2026-08-29T08:00:00.000Z",
            source: { title: "Open-Meteo 实时天气", url: "https://open-meteo.com/" }
          },
          airQuality: {
            available: true,
            usAqi: 82,
            pm25: 18,
            pm10: 24,
            observedAt: "2026-08-29T16:00",
            fetchedAt: "2026-08-29T08:00:00.000Z",
            source: { title: "Open-Meteo Air Quality API", url: "https://open-meteo.com/en/docs/air-quality-api" }
          },
          publicWorldData: {
            orbital: {
              available: true,
              fetchedAt: "2026-08-29T08:00:00.000Z",
              source: { title: "CelesTrak GP Data", url: "https://celestrak.org/NORAD/documentation/gp-data-formats.php" }
            }
          },
          world: {
            observedAt: "2026-08-29T08:00:00.000Z",
            events: [{
              type: "possible_visible_iss_pass",
              title: "国际空间站可能在今晚经过，最高仰角约46°",
              evidenceMode: "calculated",
              knowledgeMode: "inference_only",
              confidence: 0.8,
              affects: ["天空注意", "停留"],
              firstPersonBoundary: "看见前不能写成目击，云和建筑可能遮挡。",
              expiresAt: "2026-08-29T14:00:00.000Z",
              attentionScore: 76
            }],
            observations: [{
              metric: "iss_passes_next_24h",
              value: { passes: [{ startAt: "2026-08-29T12:00:00.000Z", maxElevationDeg: 46, visible: true }] },
              sourceId: "celestrak_gp",
              evidenceMode: "calculated",
              confidence: 0.8
            }],
            sources: ["open_meteo_forecast", "open_meteo_air_quality", "celestrak_gp"],
            maintenance: { degradedSources: [], unconfiguredSources: ["nasa_firms"], disabledSources: [] }
          }
        }
      },
      memories: [{ id: "memory-1", kind: "shared_reply", text: "我小时候记得雨落在铁皮棚上的声音。", scope: "relationship_private" }],
      preferences: { learned: [] },
      entries: [],
      decisions: []
    }
  });
  assert.equal(entry.meta.modelUsed, true);
  assert.equal(entry.meta.imageGenerated, true);
  assert.equal(entry.image.type, "ai-generated");
  assert.equal(entry.image.url, "/api/journeys/11111111-1111-4111-8111-111111111111/media/image.jpg");
  assert.equal(entry.delivery.family, "远方来信");
  assert.equal(entry.locationName, "甲秀楼");
  assert.equal(entry.cityName, "贵阳");
  assert.equal(entry.knowledge.anchor.id, "CTY-003");
  assert.equal(entry.knowledge.related.some((item) => item.id === "IHC-GY-006"), true);
  assert.match(entry.knowledge.wander, /南明河岸|翠微巷/);
  assert.equal(entry.delivery.format, "note");
  assert.equal(entry.ticket.city, "贵阳");
  assert.equal(entry.ticket.cityEnglish, "GUIYANG");
  assert.equal(entry.ticket.issuedOn, "2026-08");
  assert.equal(entry.ticket.number, "NO.2026-001");
  assert.equal(entry.ticket.sourceImage.url, entry.image.url);
  assert.match(entry.ticket.prompt, /精致的旅行纪念票根海报/);
  assert.match(entry.ticket.prompt, /N0\.2026 GUIYANG 2026-08 NO\.2026 TRAVEL TICKET/);
  assert.match(entry.content.tasteBody, /丝娃娃/);
  assert.match(entry.content.letterBody, /^下午好。/);
  assert.match(entry.content.letterBody, /你/);
  assert.match(entry.delivery.whyForUser, /普通的一天/);
  assert.equal(entry.sources.length > 0, true);
  assert.equal(saved.extension, "jpg");
  assert.equal(calls[1].body.response_format, "base64");
  assert.equal(calls[1].body.aigc_watermark, true);
  assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");
  assert.equal(calls[0].headers.authorization, "Bearer test-secret");
  assert.deepEqual(calls[0].body.thinking, { type: "disabled" });
  assert.deepEqual(calls[0].body.response_format, { type: "json_object" });
  assert.match(calls[0].body.messages[0].content, /本地的我/);
  assert.match(calls[0].body.messages[0].content, /一个真的在过日子的人/);
  assert.match(calls[0].body.messages[0].content, /PRESENCE\.md/);
  assert.match(calls[0].body.messages[0].content, /环境→身体→动作/);
  assert.match(calls[0].body.messages[1].content, /observation 写 260—520/);
  assert.match(calls[0].body.messages[1].content, /letterBody 写 700—1200/);
  assert.match(calls[0].body.messages[0].content, /地理、历史、风土与今天的生活/);
  assert.match(calls[0].body.messages[0].content, /每个事实都要能在 sources 或地方事实中找到对应依据/);
  assert.match(calls[0].body.messages[0].content, /第一句必须先向收信人开口/);
  assert.match(calls[0].body.messages[0].content, /至少有一次自然地对‘你’说话/);
  assert.match(calls[0].body.messages[0].content, /每一页至少选择一条仍在有效期内/);
  assert.match(calls[0].body.messages[0].content, /tool_known、reported_observation、modelled_observation 和 inference_only/);
  assert.match(calls[0].body.messages[1].content, /环境画面底稿/);
  assert.match(calls[0].body.messages[1].content, /湿路、水珠、湿叶与水汽/);
  assert.match(calls[0].body.messages[1].content, /AQI 82/);
  assert.match(calls[0].body.messages[1].content, /国际空间站可能在今晚经过/);
  assert.match(calls[0].body.messages[1].content, /看见前不能写成目击/);
  assert.match(calls[0].body.messages[0].content, /身体状态要先成为“我的念头”/);
  assert.match(calls[0].body.messages[1].content, /雨落在铁皮棚上的声音/);
  assert.doesNotMatch(calls[0].body.messages[1].content, /whyForUser|contentIntent|deliveryFormat/);
  assert.equal(entry.context.airQuality.usAqi, 82);
  assert.equal(entry.context.realtime.events[0].type, "possible_visible_iss_pass");
  assert.equal(entry.sources.some((source) => source.type === "air-quality"), true);
  assert.equal(entry.sources.some((source) => source.type === "realtime-orbital"), true);
  assert.equal(JSON.stringify(entry).includes("test-secret"), false);
});

test("模型或图片不可用时仍返回可阅读的降级手账", async () => {
  const config = generatorConfig();
  config.ai.configured = false;
  config.image.configured = false;
  const entry = await generateJournalEntry({
    journeyId: "11111111-1111-4111-8111-111111111111",
    locationId: "xiuwen",
    config,
    fetchImpl: async () => { throw new Error("不应访问网络"); },
    now: new Date("2026-08-29T08:00:00.000Z"),
    writeMedia: async () => { throw new Error("不应写图片"); },
    agentDecision: {
      thought: "雨后的空气让衣服有些黏。\n\n我先把脚步放慢，不急着给这里下结论。",
      contentIntent: "记录隔壁桌怎么吃，再写老板笑着端面过来。"
    }
  });
  assert.equal(entry.meta.modelUsed, false);
  assert.equal(entry.meta.imageGenerated, false);
  assert.equal(entry.image.type, "project-asset");
  assert.equal(entry.ticket.sourceImage.type, "project-asset");
  assert.match(entry.content.cultureBody, /王阳明|龙场/);
  assert.match(entry.content.observation, /\n\n/);
  assert.doesNotMatch(entry.content.letterBody, /隔壁桌|老板/);
  assert.match(entry.content.letterBody, /^下午好。不知道你今天过得怎么样。/);
  assert.match(entry.content.letterBody, /雨后的空气让衣服有些黏/);
  assert.notEqual(entry.content.letterBody, entry.content.observation);
  assert.doesNotMatch(entry.content.letterBody, /没有依据的人和事|内容意图|检索与核实边界|用户委托/);
});

test("JSON 与图片解析、第一人称伪亲历守卫有效", () => {
  assert.deepEqual(parseJsonObject("```json\n{\"headline\":\"测试\"}\n```"), { headline: "测试" });
  assert.deepEqual(parseJsonObject('{"headline":"第一份"}{"headline":"重复输出"}'), { headline: "第一份" });
  const fallback = { headline: "可靠标题", deck: "可靠", observation: "可靠", cultureTitle: "可靠", cultureBody: "可靠", tasteTitle: "可靠", tasteBody: "可靠", letterTitle: "可靠", letterBody: "可靠", postcardLine: "可靠", imagePrompt: "可靠" };
  assert.equal(guardPackage({ ...fallback, observation: "第一段。\n\n第二段。" }, fallback).observation, "第一段。\n\n第二段。");
  assert.equal(guardPackage({ ...fallback, observation: "我亲眼看见摊主告诉我一个故事" }, fallback).observation, "可靠");
  assert.equal(guardPackage({ ...fallback, letterBody: "我想记录隔壁桌怎么吃" }, fallback).letterBody, "可靠");
  assert.equal(guardPackage({ ...fallback, tasteBody: "我吃到老板端来的羊肉粉" }, fallback).tasteBody, "可靠");
  assert.equal(guardPackage({ ...fallback, letterTitle: "# 河谷里的一封短信", letterBody: "用户的委托是看真实日常。" }, fallback).letterTitle, "河谷里的一封短信");
  assert.equal(guardPackage({ ...fallback, letterBody: "用户的委托是看真实日常。" }, fallback).letterBody, "可靠");
  assert.equal(guardPackage({ ...fallback, letterBody: "阿镜写在渡口边：我没有编酒坊故事，今天没走到。" }, fallback).letterBody, "可靠");
  assert.equal(guardPackage({ ...fallback, letterBody: "你留的那条线索今天落地了。" }, fallback, "", false).letterBody, "可靠");
  assert.equal(guardPackage({ ...fallback, letterBody: "你留的那条线索今天落地了。" }, fallback, "", true).letterBody, "你留的那条线索今天落地了。");
  assert.equal(hasUngroundedSceneDetail("河面有碎光，树影落在岸边。", "薄外套贴在胳膊上。"), true);
  assert.equal(hasUngroundedSceneDetail("雨珠挂在竹叶上，远处露出红色崖壁。", "小雨；赤水丹霞；连片竹林覆盖赤水山地。"), false);
  assert.equal(hasUngroundedSceneDetail("正午的光把崖壁照得发白。", "中午；赤水丹霞；天气未知。"), true);
  assert.equal(hasUngroundedSceneDetail("正午的光把崖壁照得发白。", "中午；晴；日照；赤水丹霞。"), false);
  assert.equal(guardPackage({ ...fallback, letterBody: "我站在树影里看河面。" }, fallback, "薄外套贴在胳膊上。").letterBody, "可靠");
  assert.equal(guardPackage({ ...fallback, letterBody: "我站在树影里看河面。" }, fallback, "我站在树影里看河面。").letterBody, "我站在树影里看河面。");
  assert.equal(guardPackage({ ...fallback, cultureBody: "盐运与酿造都沿河发展，站在岸边能感到时间叠在一起。" }, fallback).cultureBody, "可靠");
  const jpeg = Buffer.alloc(256, 0); jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
  assert.equal(decodeGeneratedImage(jpeg.toString("base64")).extension, "jpg");
});

test("来信正文会补上时段问候和收信人意识，但不重复已有问候", () => {
  assert.equal(
    ensureReaderFacingLetter("我刚沿着河边走了一段。", { period: "中午" }),
    "中午好。不知道你今天过得怎么样。\n\n我刚沿着河边走了一段。"
  );
  assert.equal(
    ensureReaderFacingLetter("展信佳。\n\n今天的风让我想起你。", { period: "下午" }),
    "展信佳。\n\n今天的风让我想起你。"
  );
});
