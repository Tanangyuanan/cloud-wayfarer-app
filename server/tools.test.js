"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getWeather, getAirQuality, searchWeb, shouldUseExternalSearch, shouldUseWeather } = require("./tools");

function toolConfig() {
  return {
    weather: { enabled: true, timeoutMs: 1000 },
    airQuality: { enabled: true, timeoutMs: 1000 },
    search: {
      enabled: true,
      provider: "tavily",
      allowPublicSearch: false,
      timeoutMs: 1000,
      tavilyKey: "test-search-key",
      braveKey: "",
      serperKey: ""
    }
  };
}

test("天气工具解析 Open-Meteo 当前天气与当日预报", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        current: {
          time: "2026-08-29T13:30",
          temperature_2m: 24.2,
          apparent_temperature: 25.1,
          precipitation: 0,
          weather_code: 2,
          wind_speed_10m: 7.4,
          is_day: 1
        },
        daily: {
          temperature_2m_min: [18],
          temperature_2m_max: [27],
          precipitation_probability_max: [30],
          sunrise: ["2026-08-29T06:25"],
          sunset: ["2026-08-29T19:15"]
        }
      })
    };
  };
  try {
    const result = await getWeather("chishui", toolConfig());
    assert.match(requestedUrl, /^https:\/\/api\.open-meteo\.com\/v1\/forecast\?/);
    assert.match(requestedUrl, /latitude=28\.5906/);
    assert.equal(result.available, true);
    assert.equal(result.condition, "局部多云");
    assert.equal(result.temperatureC, 24.2);
    assert.equal(result.today.precipitationProbability, 30);
  } finally {
    global.fetch = originalFetch;
  }
});

test("空气质量工具解析 Open-Meteo 当前污染物与 AQI", async () => {
  const originalFetch = global.fetch;
  let requestedUrl = "";
  global.fetch = async (url) => {
    requestedUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        current: {
          time: "2026-08-29T13:30",
          us_aqi: 42,
          pm2_5: 8.4,
          pm10: 15.2,
          carbon_monoxide: 166,
          nitrogen_dioxide: 5.1,
          sulphur_dioxide: 2.2,
          ozone: 74
        }
      })
    };
  };
  try {
    const result = await getAirQuality("xijiang", toolConfig());
    assert.match(requestedUrl, /^https:\/\/air-quality-api\.open-meteo\.com\/v1\/air-quality\?/);
    assert.match(requestedUrl, /current=us_aqi%2Cpm2_5%2Cpm10/);
    assert.equal(result.available, true);
    assert.equal(result.usAqi, 42);
    assert.equal(result.pm25, 8.4);
  } finally {
    global.fetch = originalFetch;
  }
});

test("受控搜索只向选定供应商发送查询并规范化结果", async () => {
  const originalFetch = global.fetch;
  let captured;
  global.fetch = async (url, options) => {
    captured = { url: String(url), body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({ results: [{ title: "景区公告", url: "https://example.com/notice", content: "今日正常开放。" }] })
    };
  };
  try {
    const result = await searchWeb("赤水 今日开放吗", toolConfig(), 3);
    assert.equal(captured.url, "https://api.tavily.com/search");
    assert.equal(captured.body.api_key, "test-search-key");
    assert.equal(captured.body.max_results, 3);
    assert.deepEqual(result.results[0], {
      title: "景区公告",
      url: "https://example.com/notice",
      snippet: "今日正常开放。",
      provider: "Tavily"
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("工具路由只在问题需要实时信息时启用对应能力", () => {
  assert.equal(shouldUseWeather("今天赤水会下雨吗？"), true);
  assert.equal(shouldUseWeather("介绍一下龙场悟道"), false);
  assert.equal(shouldUseExternalSearch("景区今天开放吗？", [{ title: "本地资料" }, { title: "备用资料" }]), true);
  assert.equal(shouldUseExternalSearch("老一辈怎么讲海龙屯的故事？", [{}, {}]), true);
  assert.equal(shouldUseExternalSearch("这里流传过什么民间传说？", [{}, {}]), true);
  assert.equal(shouldUseExternalSearch("介绍一下龙场悟道", [{}, {}]), false);
  assert.equal(shouldUseExternalSearch("你好", []), false);
  assert.equal(shouldUseExternalSearch("我今天有点烦", []), false);
});

test("搜索总开关优先于已配置的第三方密钥", async () => {
  const config = toolConfig();
  config.search.enabled = false;
  let called = false;
  const originalFetch = global.fetch;
  global.fetch = async () => { called = true; throw new Error("不应调用网络"); };
  try {
    const result = await searchWeb("今天开放吗", config, 3);
    assert.equal(result.provider, "local-only");
    assert.deepEqual(result.results, []);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});
