"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createClient,
  journeyView,
  readyEntries,
  groupEntriesByLocalDay,
  routeStops,
  travelTicketView,
  JOURNEY_ID_STORAGE_KEY
} = require("../prototype/pwa/data-client.js");

const JOURNEY_ID = "11111111-1111-4111-8111-111111111111";

function sampleJourney() {
  return {
    id: JOURNEY_ID,
    route: ["guiyang", "qingyan", "duyun"],
    state: {
      phase: "travelling",
      currentStopIndex: 1,
      currentLocationId: "qingyan",
      nextLocationRevealed: false,
      segmentProgress: 0.42,
      explorationIntent: "沿真实路线继续走。"
    },
    agent: { name: "阿镜" },
    embodiment: {
      thought: "石板路被正午晒热了。",
      environment: {
        location: { id: "qingyan", name: "青岩古镇" },
        localTime: { localText: "2026/08/29周六 12:21:31" },
        weather: { available: true, condition: "毛毛雨", temperatureC: 29.6, apparentTemperatureC: 32.1, windKph: 14.6 }
      }
    },
    entries: [
      {
        id: "entry-1",
        locationId: "guiyang",
        locationName: "贵阳",
        routeOrder: 1,
        status: "ready",
        content: { headline: "贵阳第一页", letterTitle: "从贵阳寄来" },
        context: { localTime: { iso: "2026-08-29T03:16:49.252Z", timezone: "Asia/Shanghai" } },
        meta: { generatedAt: "2026-08-29T03:16:49.252Z" }
      },
      {
        id: "entry-2",
        locationId: "qingyan",
        locationName: "青岩古镇",
        routeOrder: 2,
        status: "ready",
        content: { headline: "青岩·石城正午", letterTitle: "从青岩寄来" },
        context: { localTime: { iso: "2026-08-29T03:47:45.578Z", timezone: "Asia/Shanghai" } },
        meta: { generatedAt: "2026-08-29T03:47:45.578Z" }
      },
      { id: "entry-pending", locationId: "duyun", routeOrder: 3, status: "generating" }
    ],
    memories: [{ id: "memory-1" }],
    events: [{ id: "event-1" }],
    updatedAt: "2026-08-29T04:00:00.000Z"
  };
}

test("移动端视图只装订后端 ready 条目，并使用后端环境与状态", () => {
  const journey = sampleJourney();
  const view = journeyView(journey);
  assert.equal(readyEntries(journey).length, 2);
  assert.equal(view.location.name, "青岩古镇");
  assert.equal(view.headline, "青岩·石城正午");
  assert.equal(view.latest.id, "entry-2");
  assert.equal(view.weather.summary, "毛毛雨 · 30°");
  assert.equal(view.phaseText, "正在路上");
  assert.equal(view.progress, 0.42);
  assert.equal(view.tickets.length, 2);
  assert.equal(view.tickets[1].city, "青岩古镇");
  assert.equal(view.tickets[1].cityEnglish, "QINGYAN");
  assert.equal(view.tickets[1].issuedOn, "2026-08");
});

test("移动端与 PC 端一致按当地自然日装订，一天只生成一页", () => {
  const entries = readyEntries(sampleJourney());
  entries[0].context.localTime.localText = "2026/08/29周六 11:16:49";
  entries[1].context.localTime.localText = "2026/08/29周六 11:47:45";
  const nextDay = structuredClone(entries[1]);
  nextDay.id = "entry-3";
  nextDay.routeOrder = 3;
  nextDay.context.localTime = { iso: "2026-08-30T01:08:00.000Z", timezone: "Asia/Shanghai", localText: "2026/08/30周日 09:08:00" };
  const days = groupEntriesByLocalDay([nextDay, ...entries]);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0].entries.map((entry) => entry.id), ["entry-1", "entry-2"]);
  assert.equal(days[0].date.key, "2026-08-29");
  assert.equal(days[1].entries[0].id, "entry-3");
});

test("旧旅程条目没有票根字段时仍会补出可收藏票根", () => {
  const entry = sampleJourney().entries[0];
  const ticket = travelTicketView(entry);
  assert.equal(ticket.city, "贵阳");
  assert.equal(ticket.number, "NO.2026-001");
  assert.equal(ticket.label, "TRAVEL TICKET");
});

test("未公开下一站在移动端保持未知，不泄露后端候选地名", () => {
  const stops = routeStops(sampleJourney());
  assert.equal(stops[0].name, "贵阳");
  assert.equal(stops[1].name, "青岩古镇");
  assert.equal(stops[2].name, "下一站");
  assert.equal(stops[2].state, "future");
});

test("公开下一站时移动端使用可读地名而不是内部地点编号", () => {
  const journey = sampleJourney();
  journey.state.nextLocationRevealed = true;
  const stops = routeStops(journey);
  assert.equal(stops[2].name, "都匀");
  assert.equal(stops[2].revealed, true);
});

test("刚抵达但尚未装订时，不把上一站内容冒充当前站", () => {
  const journey = sampleJourney();
  journey.state.currentStopIndex = 2;
  journey.state.currentLocationId = "duyun";
  journey.state.phase = "arrived";
  journey.embodiment.environment.location = { id: "qingyan", name: "青岩古镇" };
  const context = {
    location: { id: "duyun", name: "都匀" },
    localTime: { localText: "2026/08/29周六 13:05:00" },
    weather: { available: true, condition: "阴", temperatureC: 27 }
  };
  const view = journeyView(journey, context);
  assert.equal(view.location.name, "都匀");
  assert.equal(view.headline, "都匀 · 刚刚抵达");
  assert.equal(view.image, null);
  assert.notEqual(view.headline, "青岩·石城正午");
});

test("移动端复用 PC 保存的旅程编号并请求同一个旅程接口", async () => {
  const calls = [];
  const storage = {
    getItem(key) { return key === JOURNEY_ID_STORAGE_KEY ? JOURNEY_ID : null; },
    setItem() {},
    removeItem() {}
  };
  const fetchImpl = async (url) => {
    calls.push(url);
    return { ok: true, status: 200, async json() { return { ok: true, journey: sampleJourney() }; } };
  };
  const client = createClient({ fetchImpl, storage, baseUrl: "http://cloud_wayfarer.test" });
  const result = await client.loadJourney(new URLSearchParams());
  assert.equal(result.status, "ready");
  assert.equal(result.journey.id, JOURNEY_ID);
  assert.deepEqual(calls, [`http://cloud_wayfarer.test/api/journeys/${JOURNEY_ID}`]);
});

test("没有旅程编号时显示真实空状态，不自动注入演示数据", async () => {
  let requested = false;
  const client = createClient({
    fetchImpl: async () => { requested = true; throw new Error("should_not_fetch"); },
    storage: { getItem() { return null; } }
  });
  const result = await client.loadJourney(new URLSearchParams());
  assert.equal(result.status, "empty");
  assert.equal(result.journey, null);
  assert.equal(requested, false);
});

test("移动端回信会携带具体来信编号和明确记忆授权", async () => {
  let requestBody = null;
  const client = createClient({
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200, async json() { return { ok: true, answer: "我记住了。" }; } };
    },
    storage: { getItem() { return JOURNEY_ID; }, setItem() {} }
  });
  await client.ask({
    question: "这场雨让我想起小时候的铁皮棚。",
    locationId: "qingyan",
    journeyId: JOURNEY_ID,
    remember: true,
    replyToEntryId: "entry-2"
  });
  assert.equal(requestBody.remember, true);
  assert.equal(requestBody.replyToEntryId, "entry-2");
});
