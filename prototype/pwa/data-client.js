((root, factory) => {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CloudWayfarerMobileData = api;
})(typeof globalThis !== "undefined" ? globalThis : this, (root) => {
  const JOURNEY_ID_STORAGE_KEY = "cloud_wayfarer-personal-journey-id";
  const JOURNEY_LOCATION_NAMES = {
    guiyang: "甲秀楼",
    qingyan: "青岩古镇",
    xiuwen: "修文龙场",
    anshun: "安顺老城",
    huangguoshu: "黄果树",
    zhijin: "织金洞",
    bijie: "毕节",
    weining: "威宁草海",
    liupanshui: "六盘水",
    xingyi: "兴义万峰林",
    libo: "荔波",
    duyun: "都匀",
    kaili: "凯里",
    xijiang: "西江千户苗寨",
    zhenyuan: "镇远古城",
    tongren: "铜仁",
    fanjingshan: "梵净山",
    zunyi: "遵义老城",
    hailongtun: "海龙屯",
    maotai: "茅台镇",
    chishui: "赤水河谷"
  };

  class ApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "ApiError";
      this.status = options.status || 0;
      this.code = options.code || "request_failed";
    }
  }

  function cleanText(value, fallback = "") {
    const text = String(value ?? "").trim();
    return text || fallback;
  }

  function phaseLabel(phase) {
    return {
      draft: "等待出发",
      travelling: "正在路上",
      arrived: "刚刚抵达",
      waiting_decision: "在这一站停留",
      paused: "旅程已暂停",
      completed: "这一程已完成",
      failed: "旅程暂时中断"
    }[phase] || "正在同步";
  }

  function readyEntries(journey) {
    return [...(journey?.entries || [])]
      .filter((entry) => entry?.status === "ready")
      .sort((a, b) => Number(a.routeOrder || 0) - Number(b.routeOrder || 0));
  }

  function entryTimestamp(entry) {
    return Date.parse(entry?.context?.localTime?.iso || entry?.meta?.generatedAt || "") || 0;
  }

  function localDay(entry) {
    const localText = cleanText(entry?.context?.localTime?.localText);
    const localMatch = localText.match(/(\d{4})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
    const weekday = localText.match(/周[一二三四五六日天]/)?.[0] || "";
    if (localMatch) {
      const [, year, rawMonth, rawDay] = localMatch;
      const month = String(rawMonth).padStart(2, "0");
      const day = String(rawDay).padStart(2, "0");
      return { key: `${year}-${month}-${day}`, year, month, day, weekday };
    }
    const timestamp = entry?.context?.localTime?.iso || entry?.meta?.generatedAt;
    const parsed = timestamp ? new Date(timestamp) : new Date();
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: entry?.context?.localTime?.timezone || "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).formatToParts(parsed);
    const value = (type) => parts.find((part) => part.type === type)?.value || "";
    const year = value("year");
    const month = value("month");
    const day = value("day");
    return { key: `${year}-${month}-${day}`, year, month, day, weekday: value("weekday") };
  }

  function groupEntriesByLocalDay(entries) {
    const groups = new Map();
    for (const entry of [...(entries || [])].sort((a, b) => entryTimestamp(a) - entryTimestamp(b) || Number(a.routeOrder || 0) - Number(b.routeOrder || 0))) {
      const date = localDay(entry);
      if (!groups.has(date.key)) groups.set(date.key, { date, entries: [] });
      groups.get(date.key).entries.push(entry);
    }
    return [...groups.values()];
  }

  function latestEntry(journey) {
    return readyEntries(journey).sort((a, b) => entryTimestamp(b) - entryTimestamp(a))[0] || null;
  }

  function currentEntry(journey) {
    const currentId = journey?.state?.currentLocationId;
    return readyEntries(journey).findLast((entry) => entry.locationId === currentId) || null;
  }

  function localClock(value) {
    const explicit = cleanText(value?.context?.localTime?.localText || value?.localTime?.localText);
    const match = explicit.match(/\d{2}:\d{2}/);
    if (match) return match[0];
    const timestamp = value?.meta?.generatedAt || value?.updatedAt || value?.at;
    if (!timestamp) return "--:--";
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date(timestamp));
  }

  function shortDate(entry) {
    const timestamp = entryTimestamp(entry);
    if (!timestamp) return { date: "--.--", time: "--:--", month: "--", day: "--" };
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: entry?.context?.localTime?.timezone || "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(new Date(timestamp));
    const value = (type) => parts.find((part) => part.type === type)?.value || "--";
    return { month: value("month"), day: value("day"), date: `${value("month")}.${value("day")}`, time: `${value("hour")}:${value("minute")}` };
  }

  const CITY_ENGLISH = {
    guiyang: "GUIYANG", qingyan: "QINGYAN", xiuwen: "XIUWEN", anshun: "ANSHUN",
    huangguoshu: "HUANGGUOSHU", zhijin: "ZHIJIN", bijie: "BIJIE", weining: "WEINING",
    liupanshui: "LIUPANSHUI", xingyi: "XINGYI", libo: "LIBO", duyun: "DUYUN",
    kaili: "KAILI", xijiang: "XIJIANG", zhenyuan: "ZHENYUAN", tongren: "TONGREN",
    fanjingshan: "FANJINGSHAN", zunyi: "ZUNYI", hailongtun: "HAILONGTUN", maotai: "MAOTAI", chishui: "CHISHUI"
  };

  function travelTicketView(entry) {
    const stored = entry?.ticket || {};
    const timestamp = entryTimestamp(entry);
    const issuedOn = stored.issuedOn || (timestamp
      ? new Intl.DateTimeFormat("en-CA", {
        timeZone: entry?.context?.localTime?.timezone || "Asia/Shanghai",
        year: "numeric",
        month: "2-digit"
      }).format(new Date(timestamp))
      : "---- --");
    return {
      city: cleanText(stored.city, entry?.locationName || "旅程一站"),
      cityEnglish: cleanText(stored.cityEnglish, CITY_ENGLISH[entry?.locationId] || String(entry?.locationId || "JOURNEY").toUpperCase()),
      issuedOn,
      number: cleanText(stored.number, `NO.2026-${String(Math.max(1, Number(entry?.routeOrder) || 1)).padStart(3, "0")}`),
      label: cleanText(stored.label, "TRAVEL TICKET"),
      image: stored.sourceImage || entry?.image || null
    };
  }

  function weatherView(weather) {
    if (!weather?.available) return { available: false, summary: "天气尚未取得", detail: "等待下一次环境同步" };
    const temperature = Number(weather.temperatureC);
    const apparent = Number(weather.apparentTemperatureC);
    const wind = Number(weather.windKph);
    return {
      available: true,
      summary: [cleanText(weather.condition, "天气已同步"), Number.isFinite(temperature) ? `${Math.round(temperature)}°` : ""].filter(Boolean).join(" · "),
      detail: [Number.isFinite(apparent) ? `体感 ${Math.round(apparent)}°` : "", Number.isFinite(wind) ? `风 ${Math.round(wind)}km/h` : ""].filter(Boolean).join(" · "),
      source: weather.source || null,
      observedAt: cleanText(weather.observedAt)
    };
  }

  function currentLocation(journey, context) {
    const environmentLocation = journey?.embodiment?.environment?.location;
    const entry = currentEntry(journey);
    return context?.location || environmentLocation || {
      id: journey?.state?.currentLocationId || "",
      name: entry?.locationName || "当前位置待同步"
    };
  }

  function routeStops(journey) {
    const entries = readyEntries(journey);
    const names = new Map(entries.map((entry) => [entry.locationId, entry.locationName]));
    const environment = journey?.embodiment?.environment?.location;
    if (environment?.id && environment?.name) names.set(environment.id, environment.name);
    const currentIndex = Number(journey?.state?.currentStopIndex || 0);
    return (journey?.route || []).map((id, index) => ({
      id,
      name: index > currentIndex && !journey?.state?.nextLocationRevealed ? "下一站" : (names.get(id) || JOURNEY_LOCATION_NAMES[id] || id),
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "future",
      revealed: index <= currentIndex || Boolean(journey?.state?.nextLocationRevealed)
    }));
  }

  function journeyView(journey, context = null) {
    const entries = readyEntries(journey);
    const latest = latestEntry(journey);
    const current = currentEntry(journey);
    const location = currentLocation(journey, context);
    const environment = context || journey?.embodiment?.environment || {};
    const weather = weatherView(environment.weather || current?.context?.weather);
    const clock = localClock(environment.localTime ? environment : current || journey);
    const embodimentMatchesCurrent = journey?.embodiment?.environment?.location?.id === location.id;
    const thought = cleanText(
      current?.content?.observation,
      embodimentMatchesCurrent ? cleanText(journey?.embodiment?.thought, journey?.state?.explorationIntent) : cleanText(journey?.state?.explorationIntent, "这一站还在慢慢写进手帐。")
    );
    return {
      id: journey?.id || "",
      phase: journey?.state?.phase || "unknown",
      phaseText: phaseLabel(journey?.state?.phase),
      location,
      weather,
      clock,
      headline: cleanText(current?.content?.headline, `${location.name} · ${phaseLabel(journey?.state?.phase)}`),
      thought,
      image: current?.image || null,
      latest,
      entries,
      tickets: entries.map((entry) => ({ entryId: entry.id, ...travelTicketView(entry) })),
      route: routeStops(journey),
      progress: Math.max(0, Math.min(1, Number(journey?.state?.segmentProgress || 0))),
      memories: journey?.memories || [],
      events: journey?.events || [],
      updatedAt: journey?.updatedAt || journey?.state?.lastSyncedAt || "",
      agentName: cleanText(journey?.agent?.name, "阿镜")
    };
  }

  function createClient(options = {}) {
    const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
    const storage = options.storage || root.localStorage;
    const baseUrl = cleanText(options.baseUrl).replace(/\/$/, "");
    if (!fetchImpl) throw new Error("fetch_unavailable");

    async function request(path, requestOptions = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestOptions.timeoutMs || 150000);
      try {
        const response = await fetchImpl(`${baseUrl}${path}`, {
          ...requestOptions,
          headers: requestOptions.body ? { "content-type": "application/json", ...(requestOptions.headers || {}) } : requestOptions.headers,
          signal: controller.signal
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          throw new ApiError(data.error?.message || `请求失败（${response.status}）`, {
            status: response.status,
            code: data.error?.code
          });
        }
        return data;
      } catch (error) {
        if (error.name === "AbortError") throw new ApiError("这次等得有点久，请稍后重试。", { code: "request_timeout" });
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    }

    function getJourneyId(params = new URLSearchParams(root.location?.search || "")) {
      const fromUrl = cleanText(params.get("journey"));
      if (fromUrl) return fromUrl;
      try { return cleanText(storage?.getItem(JOURNEY_ID_STORAGE_KEY)); } catch { return ""; }
    }

    function rememberJourneyId(id) {
      try { storage?.setItem(JOURNEY_ID_STORAGE_KEY, id); } catch { /* 本次会话仍可使用返回的旅程。 */ }
    }

    function forgetJourneyId() {
      try { storage?.removeItem(JOURNEY_ID_STORAGE_KEY); } catch { /* noop */ }
    }

    async function loadJourney(params) {
      const id = getJourneyId(params);
      if (!id) return { status: "empty", journey: null };
      try {
        const data = await request(`/api/journeys/${encodeURIComponent(id)}`, { timeoutMs: 150000 });
        rememberJourneyId(data.journey.id);
        return { status: "ready", journey: data.journey };
      } catch (error) {
        if (error.status === 404 || error.code === "journey_not_found" || error.code === "invalid_journey_id") forgetJourneyId();
        throw error;
      }
    }

    async function createJourney(settings = {}) {
      const created = await request("/api/journeys", {
        method: "POST",
        body: JSON.stringify(settings),
        timeoutMs: 15000
      });
      rememberJourneyId(created.journey.id);
      return created.journey;
    }

    async function startJourney(id) {
      const data = await request(`/api/journeys/${encodeURIComponent(id)}/start`, { method: "POST", body: "{}" });
      rememberJourneyId(data.journey.id);
      return data.journey;
    }

    async function loadContext(locationId) {
      if (!locationId) return null;
      const data = await request(`/api/ai/context?location=${encodeURIComponent(locationId)}`, { timeoutMs: 15000 });
      return { location: data.location, localTime: data.localTime, weather: data.weather };
    }

    async function ask({ question, locationId, journeyId, remember = false, replyToEntryId = null }) {
      const data = await request("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question, locationId, journeyId, remember, replyToEntryId }),
        timeoutMs: 150000
      });
      return data;
    }

    return { request, getJourneyId, rememberJourneyId, forgetJourneyId, loadJourney, createJourney, startJourney, loadContext, ask };
  }

  return {
    JOURNEY_ID_STORAGE_KEY,
    ApiError,
    createClient,
    readyEntries,
    latestEntry,
    currentEntry,
    entryTimestamp,
    localDay,
    groupEntriesByLocalDay,
    shortDate,
    travelTicketView,
    localClock,
    weatherView,
    routeStops,
    journeyView,
    phaseLabel
  };
});
