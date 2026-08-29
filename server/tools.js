"use strict";

const { resolveLocation, describeJourneyRoute } = require("./locations");
const { searchKnowledge } = require("./knowledge");
const { describeSearchProvider } = require("./config");

const WEATHER_LABELS = {
  0: "晴朗", 1: "大体晴朗", 2: "局部多云", 3: "阴天",
  45: "有雾", 48: "雾凇", 51: "轻微毛毛雨", 53: "毛毛雨", 55: "较强毛毛雨",
  56: "轻微冻毛毛雨", 57: "较强冻毛毛雨", 61: "小雨", 63: "中雨", 65: "大雨",
  66: "轻微冻雨", 67: "较强冻雨", 71: "小雪", 73: "中雪", 75: "大雪", 77: "米雪",
  80: "小阵雨", 81: "中阵雨", 82: "强阵雨", 85: "小阵雪", 86: "强阵雪",
  95: "雷暴", 96: "雷暴伴小冰雹", 99: "雷暴伴强冰雹"
};
const weatherCache = new Map();
const airQualityCache = new Map();
const searchCache = new Map();
const WEATHER_CACHE_MS = 10 * 60 * 1000;
const AIR_QUALITY_CACHE_MS = 30 * 60 * 1000;
const SEARCH_CACHE_MS = 5 * 60 * 1000;

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchJson(url, options = {}, timeoutMs = 8000) {
  const timeout = withTimeout(timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: timeout.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    timeout.clear();
  }
}

function getLocalTime(locationId, now = new Date()) {
  const location = resolveLocation(locationId);
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone: location.timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  });
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: location.timezone, hour: "2-digit", hourCycle: "h23" }).format(now));
  const period = hour < 6 ? "深夜" : hour < 9 ? "清晨" : hour < 12 ? "上午" : hour < 14 ? "中午" : hour < 18 ? "下午" : hour < 21 ? "傍晚" : "夜间";
  return {
    tool: "local_time",
    location: location.name,
    timezone: location.timezone,
    iso: now.toISOString(),
    localText: formatter.format(now),
    period,
    source: "云游四方服务器时钟"
  };
}

async function getWeather(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config.weather.enabled) return { tool: "weather", available: false, reason: "disabled", location: location.name };
  const cached = weatherCache.get(location.id);
  if (cached && Date.now() - cached.storedAt < WEATHER_CACHE_MS) return { ...cached.value, cache: "hit" };
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,surface_pressure,is_day",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    forecast_days: "2"
  });
  try {
    const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`, {}, config.weather.timeoutMs);
    const current = data.current || {};
    const daily = data.daily || {};
    const result = {
      tool: "weather",
      available: true,
      location: location.name,
      observedAt: current.time || null,
      fetchedAt: new Date().toISOString(),
      condition: WEATHER_LABELS[current.weather_code] || "天气状况待确认",
      temperatureC: current.temperature_2m,
      apparentTemperatureC: current.apparent_temperature,
      relativeHumidityPercent: current.relative_humidity_2m,
      precipitationMm: current.precipitation,
      windKph: current.wind_speed_10m,
      windDirectionDeg: current.wind_direction_10m,
      windGustKph: current.wind_gusts_10m,
      cloudCoverPercent: current.cloud_cover,
      visibilityM: current.visibility,
      surfacePressureHpa: current.surface_pressure,
      isDay: Boolean(current.is_day),
      modelElevationM: data.elevation,
      today: {
        minTemperatureC: daily.temperature_2m_min?.[0],
        maxTemperatureC: daily.temperature_2m_max?.[0],
        precipitationProbability: daily.precipitation_probability_max?.[0],
        sunrise: daily.sunrise?.[0],
        sunset: daily.sunset?.[0]
      },
      source: { title: "Open-Meteo 实时天气", url: "https://open-meteo.com/" }
    };
    weatherCache.set(location.id, { storedAt: Date.now(), value: result });
    return result;
  } catch (error) {
    return {
      tool: "weather",
      available: false,
      location: location.name,
      reason: error.name === "AbortError" ? "timeout" : "upstream_error",
      fetchedAt: new Date().toISOString()
    };
  }
}

async function getAirQuality(locationId, config) {
  const location = resolveLocation(locationId);
  if (!config?.airQuality?.enabled) return { tool: "air_quality", available: false, reason: "disabled", location: location.name };
  const cached = airQualityCache.get(location.id);
  if (cached && Date.now() - cached.storedAt < AIR_QUALITY_CACHE_MS) return { ...cached.value, cache: "hit" };
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    timezone: location.timezone,
    current: "us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone"
  });
  try {
    const data = await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`, {}, config.airQuality.timeoutMs);
    const current = data.current || {};
    const result = {
      tool: "air_quality",
      available: true,
      location: location.name,
      observedAt: current.time || null,
      fetchedAt: new Date().toISOString(),
      usAqi: current.us_aqi,
      pm25: current.pm2_5,
      pm10: current.pm10,
      carbonMonoxide: current.carbon_monoxide,
      nitrogenDioxide: current.nitrogen_dioxide,
      sulphurDioxide: current.sulphur_dioxide,
      ozone: current.ozone,
      source: { title: "Open-Meteo Air Quality API", url: "https://open-meteo.com/en/docs/air-quality-api" }
    };
    airQualityCache.set(location.id, { storedAt: Date.now(), value: result });
    return result;
  } catch (error) {
    return {
      tool: "air_quality",
      available: false,
      location: location.name,
      reason: error.name === "AbortError" ? "timeout" : "upstream_error",
      fetchedAt: new Date().toISOString()
    };
  }
}

async function tavilySearch(query, config, limit) {
  const data = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: config.search.tavilyKey, query, max_results: limit, search_depth: "basic", include_answer: false })
  }, config.search.timeoutMs);
  return (data.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.content, provider: "Tavily" }));
}

async function braveSearch(query, config, limit) {
  const params = new URLSearchParams({ q: query, count: String(limit), country: "cn", search_lang: "zh-hans" });
  const data = await fetchJson(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: { accept: "application/json", "x-subscription-token": config.search.braveKey }
  }, config.search.timeoutMs);
  return (data.web?.results || []).map((item) => ({ title: item.title, url: item.url, snippet: item.description, provider: "Brave Search" }));
}

async function serperSearch(query, config, limit) {
  const data = await fetchJson("https://google.serper.dev/search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.search.serperKey },
    body: JSON.stringify({ q: query, gl: "cn", hl: "zh-cn", num: limit })
  }, config.search.timeoutMs);
  return (data.organic || []).map((item) => ({ title: item.title, url: item.link, snippet: item.snippet, provider: "Serper" }));
}

async function wikipediaSearch(query, config, limit) {
  const params = new URLSearchParams({ action: "query", list: "search", format: "json", origin: "*", utf8: "1", srlimit: String(limit), srsearch: query });
  const data = await fetchJson(`https://zh.wikipedia.org/w/api.php?${params}`, {
    headers: { "user-agent": "CloudWayfarerCloudJourney/1.0 (local prototype)" }
  }, config.search.timeoutMs);
  return (data.query?.search || []).map((item) => ({
    title: item.title,
    url: `https://zh.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, "_"))}`,
    snippet: String(item.snippet || "").replace(/<[^>]+>/g, ""),
    provider: "Wikipedia"
  }));
}

async function searchWeb(query, config, limit = 4) {
  const provider = describeSearchProvider(config);
  const cacheKey = `${provider}:${limit}:${String(query).trim().toLowerCase()}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.storedAt < SEARCH_CACHE_MS) return { ...cached.value, cache: "hit" };
  try {
    let value;
    if (provider === "tavily") value = { provider, results: await tavilySearch(query, config, limit) };
    else if (provider === "brave") value = { provider, results: await braveSearch(query, config, limit) };
    else if (provider === "serper") value = { provider, results: await serperSearch(query, config, limit) };
    else if (provider === "wikipedia") value = { provider, results: await wikipediaSearch(query, config, limit) };
    else value = { provider: "local-only", results: [] };
    searchCache.set(cacheKey, { storedAt: Date.now(), value });
    return value;
  } catch (error) {
    return { provider, results: [], error: error.name === "AbortError" ? "timeout" : "upstream_error" };
  }
}

function shouldUseExternalSearch(question, localResults) {
  const text = String(question || "");
  return /开放|闭馆|票价|预约|活动|新闻|交通|公告|搜索|查一下|查查|老一辈|老人讲|祖辈|口述|访谈|民间传说|地方传说|流传过/.test(text);
}

function shouldUseWeather(question) {
  return /天气|温度|下雨|降水|冷不冷|热不热|穿什么|雨|雾|风|晴/.test(String(question || ""));
}

async function gatherContext({ question, locationId, config, forceWeather = false, forceSearch = false }) {
  const location = resolveLocation(locationId);
  const journeyRoute = describeJourneyRoute(location.id);
  const localTime = getLocalTime(location.id);
  const localResults = searchKnowledge(question, 5);
  const weatherPromise = forceWeather || shouldUseWeather(question)
    ? getWeather(location.id, config)
    : Promise.resolve(null);
  const webPromise = forceSearch || shouldUseExternalSearch(question, localResults)
    ? searchWeb(`${location.name} ${question}`, config, 4)
    : Promise.resolve({ provider: describeSearchProvider(config), results: [] });
  const [weather, web] = await Promise.all([weatherPromise, webPromise]);
  return { location, journeyRoute, localTime, weather, localResults, web };
}

module.exports = {
  getLocalTime,
  getWeather,
  getAirQuality,
  searchWeb,
  gatherContext,
  shouldUseWeather,
  shouldUseExternalSearch
};
