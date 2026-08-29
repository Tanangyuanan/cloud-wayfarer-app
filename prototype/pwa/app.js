(() => {
  const Data = window.CloudWayfarerMobileData;
  if (!Data) throw new Error("mobile_data_client_missing");
  const LetterArchive = window.CloudWayfarerLetterArchive;

  const INTRO_KEY = "cloud_wayfarer-pwa-recognized-v1";
  const FOOTPRINT_FAVORITES_KEY = "cloud_wayfarer-footprint-favorites-v1";
  const FAVORITE_LOCATIONS = {
    guiyang: { lat: 26.647, lng: 106.6302 }, qingyan: { lat: 26.3311, lng: 106.6868 }, xiuwen: { lat: 26.8389, lng: 106.594 },
    anshun: { lat: 26.2537, lng: 105.9476 }, huangguoshu: { lat: 25.9907, lng: 105.6664 }, zhijin: { lat: 26.748, lng: 105.87 },
    bijie: { lat: 27.2985, lng: 105.305 }, weining: { lat: 26.8562, lng: 104.2782 }, liupanshui: { lat: 26.5927, lng: 104.8304 },
    xingyi: { lat: 25.0881, lng: 104.958 }, libo: { lat: 25.411, lng: 107.8877 }, duyun: { lat: 26.2594, lng: 107.5187 },
    kaili: { lat: 26.5669, lng: 107.981 }, xijiang: { lat: 26.5025, lng: 108.1747 }, zhenyuan: { lat: 27.0493, lng: 108.4297 },
    tongren: { lat: 27.7315, lng: 109.1896 }, fanjingshan: { lat: 27.8959, lng: 108.6969 }, zunyi: { lat: 27.7257, lng: 106.9272 },
    hailongtun: { lat: 27.8148, lng: 106.8227 }, maotai: { lat: 27.8547, lng: 106.3717 }, chishui: { lat: 28.5906, lng: 105.6975 }
  };
  const params = new URLSearchParams(window.location.search);
  const api = Data.createClient();
  const intro = document.querySelector("#intro");
  const shell = document.querySelector("#app-shell");
  const screens = [...document.querySelectorAll("[data-screen]")];
  const navButtons = [...document.querySelectorAll(".bottom-nav [data-screen-target]")];
  const toast = document.querySelector("#toast");
  let journey = null;
  let journeyContext = null;
  let journeyView = null;
  let activeLetterId = null;
  let editorialLetterIssues = [];
  let replyingToEntryId = null;
  let hydratePromise = null;
  let pollTimer = null;
  let toastTimer = null;
  let installPrompt = null;
  let photoObjectUrl = null;
  let renderedEntriesSignature = "__unrendered__";
  let renderedOnsiteLocationId = "";
  let mobileJournalPage = 0;
  let mobileJournalTurning = false;
  let mobileJournalTurnTimer = null;
  let mobileJournalPointer = null;
  let letterAudio = null;
  let letterAudioObjectUrl = "";
  let letterAudioMode = "idle";
  let letterEstimatedDuration = 0;
  const letterAudioCache = new Map();
  let footprintFavorites = loadFootprintFavorites();
  const routeExpansionState = new Map();
  let userCoordinates = null;
  let onboardingStep = 0;
  let onboardingStarting = false;
  const ONBOARDING_LAST_STEP = 5;
  const onboardingSelections = {
    destination: "贵州",
    theme: "第一次认识贵州",
    mode: "自驾",
    pace: "沉浸节奏"
  };
  const ONBOARDING_STEP_LABELS = ["先认识一下", "01 / 05", "02 / 05", "03 / 05", "04 / 05", "确认出发"];
  const ONBOARDING_NEXT_LABELS = ["认识了，继续", "选好了，下一页", "就看这些", "这样走", "用这个节奏", "和阿镜一起出发"];
  const DEFAULT_SCENE_IMAGE = "/app/assets/guizhou-road.jpg";
  const failedSceneUrls = new Set();
  const ONSITE_LAYER_COPY = {
    now: {
      title: "先从这道石墙看起",
      copy: "别只看一段旧墙。把山势、关隘和石砌遗存放在一起，才会发现这里曾是一座要用双腿走进去的山城。"
    },
    past: {
      title: "从前，这里是一座山城",
      copy: "在播州杨氏长期经营的时期，海龙屯不是供人凭吊的遗址，而是与军政、道路和山地防御相连的生活空间。能确认的是格局与遗存；具体屋面和人物活动只能有限重构。"
    },
    change: {
      title: "1599 年以后，秩序改变了",
      copy: "播州之役结束后，原有政治秩序与山城功能发生根本变化。废弃、自然侵蚀、植被覆盖和后来的考古工作，一层层把它变成今天的遗址。"
    },
    echo: {
      title: "过去仍留在上山的方式里",
      copy: "再回头看眼前：陡坡、关口与视野并不是背景，它们本来就是防御的一部分。今天用双腿感到的艰难，仍在帮助我们读懂这座山城为什么出现在这里。"
    }
  };
  const ONSITE_GUEST_COPY = {
    local: {
      label: "地方记录中的观看方式",
      copy: "当地记录常从上山的路讲起：先感受山有多陡，再看关隘和城墙为什么会顺着坡度长成这样。"
    },
    traveller: {
      label: "已授权旅行记录中的感受",
      copy: "照片很难留下坡度。真正走到关前，腿往往先感到山势，随后才看懂城墙与道路怎样彼此咬合。"
    },
    historical: {
      label: "空间情境重构 · 并非人物原话",
      copy: "从关隘向山下看，来路与每一个转弯都会进入视野。这个角度只帮助理解防御空间，事实仍以遗址与史料为准。"
    }
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(String(value || ""), window.location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch {
      return "";
    }
  }

  function splitLetterParagraphs(value) {
    const text = String(value || "").replace(/\r\n?/g, "\n").trim();
    if (!text) return [];
    const explicit = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    if (explicit.length > 1) return explicit;
    const sentences = text.match(/[^。！？!?]+[。！？!?]?/g)?.map((part) => part.trim()).filter(Boolean) || [text];
    const paragraphs = [];
    let paragraph = "";
    sentences.forEach((sentence) => {
      if (paragraph && paragraph.length + sentence.length > 150) {
        paragraphs.push(paragraph);
        paragraph = sentence;
      } else paragraph += sentence;
    });
    if (paragraph) paragraphs.push(paragraph);
    return paragraphs;
  }

  function letterNarrationText(entry) {
    return [
      entry?.content?.letterTitle || entry?.content?.headline,
      entry?.content?.letterBody || entry?.content?.observation,
      entry?.content?.cultureBody
    ].filter(Boolean).join("\n\n");
  }

  function shanghaiDateParts(entry) {
    const date = new Date(Data.entryTimestamp(entry));
    const values = Object.fromEntries(new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date).map((part) => [part.type, part.value]));
    return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
  }

  function editorialPeriodKey(entry, cadence) {
    const parts = shanghaiDateParts(entry);
    if (cadence === "monthly") return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    return date.toISOString().slice(0, 10);
  }

  function uniqueIssueLocations(entries) {
    return [...new Set(entries.map((entry) => entry.locationName).filter(Boolean))];
  }

  function composeEditorialBody(entries, limit) {
    const chronological = [...entries].sort((a, b) => Data.entryTimestamp(a) - Data.entryTimestamp(b));
    const latest = chronological.at(-1);
    const paragraphs = splitLetterParagraphs(latest?.content?.letterBody || latest?.content?.observation || "");
    [...chronological].reverse().slice(1).forEach((entry) => {
      const observation = String(entry.content?.observation || "").trim();
      if (observation && !paragraphs.some((paragraph) => paragraph.includes(observation) || observation.includes(paragraph))) {
        paragraphs.push(observation);
      }
    });
    let body = "";
    for (const paragraph of paragraphs) {
      if (body.length + paragraph.length + 2 > limit) break;
      body += `${body ? "\n\n" : ""}${paragraph}`;
    }
    return body || latest?.content?.letterBody || latest?.content?.observation || "这封信还在路上。";
  }

  function buildEditorialIssue(entries, cadence, periodKey) {
    const chronological = [...entries].sort((a, b) => Data.entryTimestamp(a) - Data.entryTimestamp(b));
    const anchor = chronological.at(-1);
    const locations = uniqueIssueLocations(chronological);
    const placeLine = locations.length > 1 ? `${locations[0]}到${locations.at(-1)}` : (locations[0] || "贵州路上");
    const cultureNotes = [...new Set(chronological.map((entry) => entry.content?.cultureBody).filter(Boolean))];
    const sources = [];
    const sourceKeys = new Set();
    chronological.flatMap((entry) => entry.sources || []).forEach((source) => {
      const key = `${source.title || ""}|${source.url || ""}`;
      if (sourceKeys.has(key)) return;
      sourceKeys.add(key);
      sources.push(source);
    });
    const monthly = cadence === "monthly";
    return {
      ...anchor,
      id: `editorial-${cadence}-${periodKey}`,
      kind: "editorial-letter",
      editorialType: cadence,
      sourceEntryIds: chronological.map((entry) => entry.id),
      replyEntryId: anchor.id,
      locationName: locations.length > 2 ? "贵州路上" : placeLine,
      content: {
        ...anchor.content,
        letterTitle: monthly
          ? `${shanghaiDateParts(anchor).month}月，阿镜从贵州寄来的长信`
          : anchor.content?.letterTitle || anchor.content?.headline || "这一周，从贵州路上寄来",
        deck: monthly
          ? `这个月，我从${placeLine}慢慢走过，把地理、历史与今天的生活装订在一起。`
          : `这一周，我从${placeLine}走过。这里的风土与来路，想慢慢讲给你听。`,
        letterBody: composeEditorialBody(chronological, monthly ? 2600 : 1700),
        cultureBody: cultureNotes.slice(0, monthly ? 5 : 3).join("\n\n")
      },
      sources,
      delivery: {
        ...anchor.delivery,
        editorial: { cadence, label: monthly ? "阿镜月记" : "阿镜周记" },
        voice: { status: "on-demand", provider: "MiniMax", persona: "阿镜" }
      }
    };
  }

  function buildEditorialLetterIssues(entries) {
    const weeklyGroups = new Map();
    const monthlyGroups = new Map();
    entries.forEach((entry) => {
      const weeklyKey = editorialPeriodKey(entry, "weekly");
      const monthlyKey = editorialPeriodKey(entry, "monthly");
      if (!weeklyGroups.has(weeklyKey)) weeklyGroups.set(weeklyKey, []);
      if (!monthlyGroups.has(monthlyKey)) monthlyGroups.set(monthlyKey, []);
      weeklyGroups.get(weeklyKey).push(entry);
      monthlyGroups.get(monthlyKey).push(entry);
    });
    const issues = [...weeklyGroups].map(([key, group]) => buildEditorialIssue(group, "weekly", key));
    [...monthlyGroups].forEach(([key, group]) => {
      if (group.length >= 4) issues.push(buildEditorialIssue(group, "monthly", key));
    });
    return issues.sort((a, b) => {
      const timeDifference = Data.entryTimestamp(b) - Data.entryTimestamp(a);
      if (timeDifference) return timeDifference;
      return a.editorialType === "weekly" ? -1 : 1;
    });
  }

  function formatAudioTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function setLetterAudioUi(state, status) {
    const note = document.querySelector("#letter-audio");
    const button = document.querySelector("#play-letter");
    if (!note || !button) return;
    note.classList.toggle("is-playing", state === "playing");
    note.classList.toggle("is-loading", state === "loading");
    button.disabled = state === "loading";
    button.setAttribute("aria-pressed", String(state === "playing"));
    button.setAttribute("aria-label", state === "playing" ? "暂停声音来信" : "播放声音来信");
    const statusNode = document.querySelector("#letter-audio-status");
    if (statusNode && status) statusNode.textContent = status;
  }

  function updateLetterAudioClock(current, duration = letterEstimatedDuration) {
    document.querySelector("#letter-audio-elapsed").textContent = formatAudioTime(current);
    const minutes = Math.max(1, Math.round((Number(duration) || 60) / 60));
    document.querySelector("#letter-reading-time").textContent = `约 ${minutes} 分钟`;
  }

  function stopLetterAudio({ reset = true } = {}) {
    if (letterAudio) {
      letterAudio.pause();
      letterAudio.currentTime = 0;
      letterAudio = null;
    }
    letterAudioMode = "idle";
    if (reset) updateLetterAudioClock(0);
    setLetterAudioUi("idle", "阿镜 · 点击收听");
  }

  function playAudioUrl(url) {
    letterAudio = new Audio(url);
    letterAudioMode = "audio";
    letterAudio.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(letterAudio.duration)) letterEstimatedDuration = letterAudio.duration;
      updateLetterAudioClock(letterAudio.currentTime, letterAudio.duration);
    });
    letterAudio.addEventListener("timeupdate", () => updateLetterAudioClock(letterAudio.currentTime, letterAudio.duration));
    letterAudio.addEventListener("ended", () => {
      setLetterAudioUi("idle", "阿镜 · 已听完");
      updateLetterAudioClock(0, letterAudio.duration);
      letterAudioMode = "idle";
    });
    letterAudio.play().then(() => setLetterAudioUi("playing", "阿镜 · 正在讲给你听")).catch(() => {
      setLetterAudioUi("idle", "点击后开始播放");
      letterAudioMode = "idle";
    });
  }

  async function toggleLetterAudio() {
    const entry = editorialLetterIssues.find((candidate) => candidate.id === activeLetterId);
    if (!entry) return;
    if (letterAudioMode === "audio" && letterAudio && !letterAudio.paused) {
      letterAudio.pause();
      setLetterAudioUi("idle", "阿镜 · 已暂停");
      return;
    }
    if (letterAudioMode === "audio" && letterAudio?.paused) {
      await letterAudio.play();
      setLetterAudioUi("playing", "阿镜 · 正在讲给你听");
      return;
    }
    const cached = letterAudioCache.get(entry.id);
    if (cached) {
      playAudioUrl(cached);
      return;
    }
    const text = letterNarrationText(entry);
    setLetterAudioUi("loading", "阿镜正在准备声音…");
    try {
      const response = await fetch("/api/speech/letter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message || "这次声音没有生成成功，请稍后再试。");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("empty_audio");
      letterAudioObjectUrl = URL.createObjectURL(blob);
      letterAudioCache.set(entry.id, letterAudioObjectUrl);
      playAudioUrl(letterAudioObjectUrl);
    } catch (error) {
      letterAudioMode = "idle";
      const message = error?.message || "这次声音没有生成成功，请稍后再试。";
      setLetterAudioUi("idle", message);
      showToast(message);
    }
  }

  function loadFootprintFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(FOOTPRINT_FAVORITES_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter((item) => item?.id && item?.locationId) : [];
    } catch {
      return [];
    }
  }

  function saveFootprintFavorites() {
    try { localStorage.setItem(FOOTPRINT_FAVORITES_KEY, JSON.stringify(footprintFavorites)); } catch { /* private mode */ }
  }

  function mobileFavoriteFromEntry(entry) {
    return {
      id: String(entry.id || entry.locationId),
      journeyId: journey?.id || null,
      entryId: entry.id || null,
      locationId: entry.locationId,
      locationName: entry.locationName || "旅程一站",
      routeOrder: Number(entry.routeOrder) || 0,
      title: entry.content?.headline || entry.content?.letterTitle || entry.locationName,
      excerpt: entry.content?.postcardLine || entry.content?.observation || entry.content?.deck || "想亲自去看看这里。",
      imageUrl: safeUrl(entry.image?.url) || DEFAULT_SCENE_IMAGE,
      savedAt: new Date().toISOString()
    };
  }

  function isMobileFavorite(entry) {
    const id = String(entry?.id || entry?.locationId || "");
    return Boolean(id && footprintFavorites.some((item) => item.id === id));
  }

  function toggleMobileFavorite(entry) {
    const id = String(entry?.id || entry?.locationId || "");
    const index = footprintFavorites.findIndex((item) => item.id === id);
    if (index >= 0) {
      footprintFavorites.splice(index, 1);
      showToast(`已从我的收藏取下：${entry.locationName}`);
    } else {
      footprintFavorites.unshift(mobileFavoriteFromEntry(entry));
      showToast(`已收藏：${entry.locationName}`);
    }
    saveFootprintFavorites();
    document.querySelector("#mobile-route-plan").hidden = true;
    renderRoute(journeyView);
  }

  function renderMobileFavorites() {
    const list = document.querySelector("#mobile-favorite-list");
    const count = document.querySelector("#mobile-favorite-count");
    const plan = document.querySelector("#mobile-plan-favorites");
    if (!list || !count || !plan) return;
    list.replaceChildren();
    count.textContent = `${footprintFavorites.length} 项`;
    plan.disabled = footprintFavorites.length === 0;
    if (!footprintFavorites.length) {
      list.append(element("p", "mobile-favorite-empty", "点亮路线上的小星星，把想亲自去看的地方收在这里。"));
      return;
    }
    footprintFavorites.forEach((favorite, index) => {
      const item = element("article", "mobile-favorite-item");
      const copy = element("div");
      copy.append(element("small", "", `${String(index + 1).padStart(2, "0")} · 想亲自去看`), element("b", "", favorite.locationName), element("p", "", favorite.title));
      const remove = element("button", "", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", `移除收藏：${favorite.locationName}`);
      remove.addEventListener("click", () => {
        footprintFavorites = footprintFavorites.filter((item) => item.id !== favorite.id);
        saveFootprintFavorites();
        document.querySelector("#mobile-route-plan").hidden = true;
        renderRoute(journeyView);
      });
      item.append(element("span", "mobile-favorite-star", "★"), copy, remove);
      list.append(item);
    });
  }

  function directDistance(a, b) {
    const rad = (value) => value * Math.PI / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const latA = rad(a.lat);
    const latB = rad(b.lat);
    const value = Math.sin(dLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(dLng / 2) ** 2;
    return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
  }

  function mobileOrderedFavorites(origin) {
    const remaining = footprintFavorites.map((favorite) => ({ favorite, location: FAVORITE_LOCATIONS[favorite.locationId] })).filter((item) => item.location);
    const ordered = [];
    let cursor = origin;
    while (remaining.length) {
      let closestIndex = 0;
      let closestDistance = Infinity;
      remaining.forEach((item, index) => {
        const distance = directDistance(cursor, item.location);
        if (distance < closestDistance) {
          closestIndex = index;
          closestDistance = distance;
        }
      });
      const [next] = remaining.splice(closestIndex, 1);
      ordered.push({ ...next, distance: closestDistance });
      cursor = next.location;
    }
    return ordered;
  }

  function mobileNavigationUrl(origin, first, second = null) {
    const query = new URLSearchParams({
      from: `${origin.lng},${origin.lat},我的位置`,
      to: `${first.location.lng},${first.location.lat},${first.favorite.locationName}`,
      mode: "car", policy: "1", src: "yunyou-sifang", coordinate: "wgs84", callnative: "1"
    });
    if (second) query.set("via", `${second.location.lng},${second.location.lat},${second.favorite.locationName}`);
    return `https://uri.amap.com/navigation?${query}`;
  }

  function renderMobileRoutePlan(ordered, origin = null) {
    const panel = document.querySelector("#mobile-route-plan");
    const note = document.querySelector("#mobile-route-plan-note");
    const list = document.querySelector("#mobile-route-plan-list");
    const navigation = document.querySelector("#mobile-route-navigation");
    list.replaceChildren();
    ordered.forEach((item, index) => {
      const row = document.createElement("li");
      row.append(element("i", "", String(index + 1).padStart(2, "0")), element("b", "", item.favorite.locationName), element("small", "", origin ? `直线约 ${item.distance < 1000 ? `${Math.round(item.distance)}m` : `${(item.distance / 1000).toFixed(1)}km`}` : "按收藏顺序"));
      list.append(row);
    });
    note.textContent = origin ? "已按离你由近到远整理" : "未读取位置，先按收藏顺序整理";
    if (origin && ordered.length) {
      navigation.href = mobileNavigationUrl(origin, ordered[0], ordered[1]);
      navigation.hidden = false;
    } else navigation.hidden = true;
    panel.hidden = false;
    panel.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function locateUser() {
    if (userCoordinates) return Promise.resolve(userCoordinates);
    if (!navigator.geolocation) return Promise.reject(new Error("geolocation_unavailable"));
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition((position) => {
        userCoordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
        resolve(userCoordinates);
      }, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }

  async function planMobileFavorites() {
    const available = footprintFavorites.map((favorite) => ({ favorite, location: FAVORITE_LOCATIONS[favorite.locationId] })).filter((item) => item.location);
    if (!available.length) {
      showToast("这些收藏暂时没有可规划的地点坐标");
      return;
    }
    const button = document.querySelector("#mobile-plan-favorites");
    button.disabled = true;
    button.querySelector("b").textContent = "正在确认你的位置…";
    try {
      const origin = await locateUser();
      renderMobileRoutePlan(mobileOrderedFavorites(origin), origin);
    } catch {
      renderMobileRoutePlan(available.sort((a, b) => Number(a.favorite.routeOrder || 0) - Number(b.favorite.routeOrder || 0)), null);
      showToast("没有读取你的位置，已先按收藏顺序整理");
    } finally {
      button.disabled = false;
      button.querySelector("b").textContent = "重新规划收藏路线";
    }
  }

  function renderSceneImage(image, preferredUrl, alt) {
    const candidates = [...new Set([preferredUrl, DEFAULT_SCENE_IMAGE].filter(Boolean))]
      .filter((url) => !failedSceneUrls.has(url));
    let candidateIndex = 0;
    image.classList.remove("is-unavailable");
    image.alt = alt;
    if (!candidates.length) {
      image.removeAttribute("src");
      image.alt = "";
      image.classList.add("is-unavailable");
      return;
    }
    image.onerror = () => {
      failedSceneUrls.add(candidates[candidateIndex]);
      candidateIndex += 1;
      if (candidateIndex < candidates.length) {
        image.src = candidates[candidateIndex];
        return;
      }
      image.onerror = null;
      image.removeAttribute("src");
      image.alt = "";
      image.classList.add("is-unavailable");
    };
    image.src = candidates[0];
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3000);
  }

  function onboardingChoiceLabel(name) {
    const selected = document.querySelector(`[data-onboarding-select="${name}"].is-selected`);
    return selected?.querySelector("b")?.textContent?.trim() || selected?.dataset.value || onboardingSelections[name];
  }

  function syncOnboardingSummary() {
    const fields = {
      destination: onboardingSelections.destination,
      theme: onboardingChoiceLabel("theme"),
      mode: onboardingChoiceLabel("mode"),
      pace: onboardingChoiceLabel("pace")
    };
    Object.entries(fields).forEach(([name, value]) => {
      const output = document.querySelector(`#onboarding-summary-${name}`);
      if (output) output.textContent = value;
    });
  }

  function updateOnboardingJourneyState() {
    const exit = document.querySelector("#onboarding-exit");
    if (exit) exit.hidden = !journey?.id;
    const nextLabel = document.querySelector("#enter-app span");
    if (nextLabel && onboardingStep === ONBOARDING_LAST_STEP && journey?.id) nextLabel.textContent = "回到正在走的路";
  }

  function showOnboardingStep(nextStep, options = {}) {
    onboardingStep = Math.max(0, Math.min(Number(nextStep) || 0, ONBOARDING_LAST_STEP));
    intro.dataset.onboardingStep = String(onboardingStep);
    document.querySelectorAll("[data-onboarding-page]").forEach((page) => {
      const active = Number(page.dataset.onboardingPage) === onboardingStep;
      page.classList.toggle("is-active", active);
      page.setAttribute("aria-hidden", String(!active));
      page.inert = !active;
      if (active) page.scrollTop = 0;
    });
    const stepLabel = document.querySelector("#onboarding-step-label");
    if (stepLabel) stepLabel.textContent = ONBOARDING_STEP_LABELS[onboardingStep];
    const progress = document.querySelector("#onboarding-progress-bar");
    if (progress) progress.style.transform = `scaleX(${onboardingStep / ONBOARDING_LAST_STEP})`;
    const back = document.querySelector("#onboarding-back");
    if (back) back.hidden = onboardingStep === 0;
    const next = document.querySelector("#enter-app");
    const nextLabel = next?.querySelector("span");
    if (nextLabel) nextLabel.textContent = ONBOARDING_NEXT_LABELS[onboardingStep];
    const status = document.querySelector("#onboarding-status");
    if (status) status.textContent = "";
    if (onboardingStep === ONBOARDING_LAST_STEP) syncOnboardingSummary();
    updateOnboardingJourneyState();
    if (options.focus !== false) {
      window.setTimeout(() => {
        const page = document.querySelector(`[data-onboarding-page="${onboardingStep}"]`);
        const heading = page?.querySelector("h1, h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260);
    }
  }

  async function finishOnboarding() {
    if (onboardingStarting) return;
    const next = document.querySelector("#enter-app");
    const nextLabel = next?.querySelector("span");
    const status = document.querySelector("#onboarding-status");
    onboardingStarting = true;
    if (next) {
      next.disabled = true;
      next.setAttribute("aria-busy", "true");
    }
    if (nextLabel) nextLabel.textContent = journey?.id ? "正在回到旅程…" : "正在落下第一枚坐标…";
    if (status) status.textContent = journey?.id ? "正在接回已经开始的旅程" : "阿镜正在准备出发，请稍候";
    try {
      if (!journey?.id) await hydrateJourney({ silent: true });
      if (!journey?.id) {
        const created = await api.createJourney({
          mode: onboardingSelections.mode,
          pace: onboardingSelections.pace,
          theme: onboardingSelections.theme,
          commission: document.querySelector("#onboarding-commission")?.value || ""
        });
        const started = await api.startJourney(created.id);
        const context = await api.loadContext(started.state?.currentLocationId).catch(() => null);
        renderJourney(started, context);
        startPolling();
      }
      showApp(true);
      showToast("旅程已经开始，阿镜会从第一处抵达慢慢写回来");
    } catch (error) {
      if (status) status.textContent = error?.message ? `还没能出发：${error.message}` : "还没能出发，请再试一次";
      if (nextLabel) nextLabel.textContent = "再试一次";
    } finally {
      onboardingStarting = false;
      if (next) {
        next.disabled = false;
        next.removeAttribute("aria-busy");
      }
    }
  }

  function advanceOnboarding() {
    if (onboardingStep < ONBOARDING_LAST_STEP) {
      showOnboardingStep(onboardingStep + 1);
      return;
    }
    finishOnboarding();
  }

  function hasRecognized() {
    if (params.get("intro") === "1") return false;
    try { return localStorage.getItem(INTRO_KEY) === "true"; } catch { return false; }
  }

  function showApp(remember = false) {
    if (remember) {
      try { localStorage.setItem(INTRO_KEY, "true"); } catch { /* private mode */ }
    }
    intro.hidden = true;
    shell.hidden = false;
    document.body.classList.add("has-entered");
    window.scrollTo({ top: 0, behavior: "instant" });
    hydrateJourney({ silent: true });
  }

  function showIntro() {
    closeAllOverlays();
    shell.hidden = true;
    intro.hidden = false;
    document.body.classList.remove("has-entered");
    window.scrollTo({ top: 0, behavior: "instant" });
    showOnboardingStep(0, { focus: false });
    updateOnboardingJourneyState();
  }

  function switchScreen(name) {
    showApp(false);
    screens.forEach((screen) => screen.classList.toggle("is-active", screen.dataset.screen === name));
    navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.screenTarget === name));
    window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  function openOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    overlay.scrollTop = 0;
    requestAnimationFrame(() => overlay.querySelector("button, [href], input")?.focus({ preventScroll: true }));
  }

  function closeOverlay(id) {
    const overlay = document.getElementById(id);
    if (!overlay) return;
    if (id === "letter-reader") stopLetterAudio();
    overlay.hidden = true;
    if (![...document.querySelectorAll(".overlay")].some((item) => !item.hidden)) document.body.style.overflow = "";
  }

  function closeAllOverlays() {
    stopLetterAudio();
    document.querySelectorAll(".overlay").forEach((overlay) => { overlay.hidden = true; });
    document.body.style.overflow = "";
  }

  function showJourneyState(kind, message) {
    const state = document.querySelector("#journey-data-state");
    const create = document.querySelector("#create-real-journey");
    const retry = document.querySelector("#retry-journey");
    state.hidden = kind === "ready";
    document.querySelector("#journey-data-message").textContent = message || "";
    create.hidden = kind !== "empty";
    retry.hidden = kind !== "error";
  }

  function renderLoading() {
    document.querySelector("#topbar-live-status").textContent = "正在把路接回来…";
    document.querySelector("#now-title").textContent = "正在接回你的路。";
    document.querySelector("#now-thought").textContent = "位置、天气和一路留下的记录，马上就好。";
    showJourneyState("ready");
  }

  function renderEmpty(message = "这台设备还没有关联旅程。你可以在这里创建，或先在 PC 端开始一段旅行。") {
    journey = null;
    journeyView = null;
    updateOnboardingJourneyState();
    document.querySelector("#topbar-live-status").textContent = "还没有开始旅程";
    document.querySelector("#now-location").firstChild.textContent = "未开始旅程";
    document.querySelector("#now-weather").textContent = "暂无实时环境数据";
    document.querySelector("#now-kicker").textContent = "LIVE JOURNEY / NOT STARTED";
    document.querySelector("#now-title").textContent = "这里还没有一段路。";
    document.querySelector("#now-thought").textContent = "从这里出发，手机和电脑就能接着读同一段旅程。";
    document.querySelector("#arrival-card").hidden = true;
    renderedEntriesSignature = "__empty__";
    renderedOnsiteLocationId = "";
    showJourneyState("empty", message);
    renderLetters([]);
    renderJournal(null, []);
    renderRoute(null);
    renderOnsitePrompts(null);
  }

  function renderError(error) {
    document.querySelector("#topbar-live-status").textContent = "旅程暂时没有连上";
    document.querySelector("#now-title").textContent = "路暂时没有接回来。";
    document.querySelector("#now-thought").textContent = error?.message || "别急，已经走过的路还在。稍后再试一次。";
    document.querySelector("#arrival-card").hidden = true;
    showJourneyState("error", error?.message || "这段旅程暂时没有连上，请稍后再试。");
  }

  function replaceLocationNote(locationName, weather) {
    const location = document.querySelector("#now-location");
    const weatherNode = document.querySelector("#now-weather");
    location.firstChild.textContent = locationName;
    weatherNode.textContent = [weather.summary, weather.detail].filter(Boolean).join(" · ");
  }

  function renderNow(view) {
    const phase = `${view.agentName}·${view.phaseText}`;
    document.querySelector("#topbar-live-status").textContent = `${phase} · ${view.clock} 更新`;
    document.querySelector("#now-kicker").textContent = `LIVE·${view.phase.toUpperCase()} / ${view.clock}`;
    document.querySelector("#now-title").textContent = view.headline;
    document.querySelector("#now-thought").textContent = view.thought;
    replaceLocationNote(view.location.name, view.weather);

    const image = document.querySelector("#now-scene-image");
    const imageUrl = safeUrl(view.image?.url);
    renderSceneImage(image, imageUrl, view.image?.alt || `${view.location.name}行旅场景`);

    const arrival = document.querySelector("#arrival-card");
    arrival.hidden = !view.latest;
    if (view.latest) {
      const date = Data.shortDate(view.latest);
      document.querySelector("#latest-letter-time").textContent = `${date.date} ${date.time} · ${view.latest.locationName}`;
      document.querySelector("#latest-letter-title").textContent = view.latest.content?.letterTitle || view.latest.content?.headline || "新内容已经装订";
    }
    showJourneyState("ready");
  }

  function renderLetters(entries) {
    const list = document.querySelector("#letter-list");
    list.replaceChildren();
    const prepared = entries.length > 0 && entries.every((entry) => entry.kind === "editorial-letter");
    const journeyIssues = prepared ? [...entries] : buildEditorialLetterIssues(entries);
    const issues = prepared ? journeyIssues : [...journeyIssues, ...(LetterArchive?.list?.() || [])];
    if (!prepared) editorialLetterIssues = issues;
    const ordered = issues.sort((a, b) => Data.entryTimestamp(b) - Data.entryTimestamp(a));
    const voiced = ordered.filter((entry) => entry.delivery?.voice?.status !== "unavailable");
    document.querySelector("#all-letter-count").textContent = `全部 ${ordered.length}`;
    document.querySelector("#voice-letter-count").textContent = `可以听 ${voiced.length}`;
    const badge = document.querySelector("#letter-nav-count");
    badge.textContent = String(ordered.length);
    badge.hidden = ordered.length === 0;
    if (!ordered.length) {
      list.append(element("li", "list-state", journey ? "路已经开始了，只是还没有一封信抵达。" : "还没有开始一段旅程。"));
      return;
    }
    ordered.forEach((entry) => {
      const date = Data.shortDate(entry);
      const ticket = Data.travelTicketView(entry);
      const item = element("li");
      const button = element("button");
      button.type = "button";
      button.dataset.entryId = entry.id;

      const ticketNode = element("span", "letter-ticket");
      const scene = element("span", "letter-ticket-scene");
      const imageUrl = safeUrl(ticket.image?.url);
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = `${ticket.city}旅行票根风景`;
        image.loading = "lazy";
        scene.append(image);
      }
      scene.append(element("span", "letter-ticket-city", ticket.city));
      const stub = element("span", "letter-ticket-stub");
      stub.append(
        element("small", "letter-ticket-number", ticket.number),
        element("b", "letter-ticket-city-en", ticket.cityEnglish),
        element("time", "letter-ticket-month", ticket.issuedOn),
        element("small", "letter-ticket-label", ticket.label),
        element("span", "letter-ticket-barcode")
      );
      ticketNode.append(scene, stub);

      const copy = element("span", "letter-copy");
      const time = element("time", "letter-time", date.date);
      time.append(element("small", "", date.time));
      copy.append(
        time,
        element("em", "", `${entry.delivery?.editorial?.label || "阿镜周记"} · 从${entry.locationName || "贵州"}寄来`),
        element("b", "", entry.content?.letterTitle || entry.content?.headline || "路上写下的一页"),
        element("p", "", entry.locationName || "位置待同步")
      );
      button.append(ticketNode, copy, element("i", "", "↗"));
      item.append(button);
      list.append(item);
    });
  }

  function journalPageNumber(value) {
    return String(value).padStart(2, "0");
  }

  function journalCover(view, dayCount, entryCount) {
    const cover = element("article", "journal-page user-journal-cover");
    cover.dataset.journalLabel = "封面";
    const inner = element("div", "user-journal-cover-inner");
    inner.append(element("small", "", `YUNYOU SIFANG · ${view?.id ? view.id.slice(0, 8).toUpperCase() : "MY JOURNAL"}`));

    const notes = element("div", "user-journal-cover-notes");
    notes.append(element("span", "user-journal-cover-seal", "黔"));
    const steps = document.createElement("ol");
    [
      ["01 · 路上", "沿真实路线抵达", "地点、时间与天气一起改变每一页"],
      ["02 · 阿镜", "把沿途见闻写回来", "我把看见的、感到的和慢慢读懂的收进手帐"],
      ["03 · 我们", "各自的生活在这里相遇", "你的回应会留进记忆，也改变我后来留心什么"]
    ].forEach(([number, title, copy]) => {
      const item = document.createElement("li");
      item.append(element("small", "", number), element("strong", "", title), element("span", "", copy));
      steps.append(item);
    });
    notes.append(steps);

    const title = element("div", "user-journal-cover-title");
    title.append(element("span", "", "A PERSONAL JOURNEY, BOUND DAY BY DAY"));
    const heading = element("h2");
    heading.append("我的", document.createElement("br"), "旅行手账");
    title.append(heading, element("p", "", "我沿真实的路继续生活，\n把能核实的见闻和自己的感受写进手帐。"));
    const footer = document.createElement("footer");
    footer.append(
      element("span", "", entryCount ? `${dayCount} 天 · ${entryCount} 站` : "等待第一页长出来"),
      element("b", "", view ? view.phaseText : "等待出发")
    );
    inner.append(notes, title, footer);
    cover.append(inner);
    return cover;
  }

  function journalTaste(entry) {
    const title = String(entry?.content?.tasteTitle || "").trim();
    const body = String(entry?.content?.tasteBody || "").trim();
    if (title && body) return { title, body };
    const text = [entry?.content?.observation, entry?.content?.cultureBody].filter(Boolean).join("。");
    const foodPattern = /丝娃娃|肠旺面|豆花面|羊肉粉|酸汤|烙锅|糯米饭|米豆腐|辣子鸡|蘸水|折耳根|豆腐圆子/;
    const sentence = text.split(/[。！？]/).map((item) => item.trim()).find((item) => foodPattern.test(item));
    return sentence ? { title: "今天记住的味道", body: `${sentence}。` } : null;
  }

  function dailyJournalProvenance(entries) {
    const generatedCount = entries.filter((entry) => entry?.meta?.modelUsed === true).length;
    if (generatedCount === entries.length) return { kind: "ai", label: "阿镜手记", detail: "沿路线、时间、天气与地方资料写成" };
    if (generatedCount > 0) return { kind: "mixed", label: "阿镜手记", detail: "部分内容沿已保存的旅程记录补全" };
    return { kind: "fallback", label: "旅途底稿", detail: "沿已确认的路线与地方资料写成" };
  }

  function appendJournalSources(parent, entries) {
    const sources = new Map();
    entries.forEach((entry) => (entry.sources || []).forEach((source) => {
      const key = source?.url || source?.title;
      if (key && !sources.has(key)) sources.set(key, source);
    }));
    if (!sources.size) return;
    const details = element("details", "daily-journal-sources");
    details.append(element("summary", "", `这一页从哪里来 · ${sources.size} 条可核对来源`));
    const list = element("div", "daily-journal-source-list");
    let index = 0;
    sources.forEach((source) => {
      index += 1;
      const url = safeUrl(source.url);
      const item = url ? document.createElement("a") : document.createElement("span");
      if (url) {
        item.href = url;
        item.target = "_blank";
        item.rel = "noreferrer noopener";
      }
      item.textContent = `[${index}] ${source.title || "未命名来源"}`;
      list.append(item);
    });
    details.append(list);
    parent.append(details);
  }

  function dailyJournalPage(day, pageNumber, dayNumber) {
    const entries = day.entries;
    const first = entries[0];
    const last = entries.at(-1);
    const routeNames = entries.map((entry) => entry.locationName).filter((name, index, all) => name && name !== all[index - 1]);
    const weatherLabels = [...new Set(entries.map((entry) => {
      const weather = entry.context?.weather;
      return weather?.condition && Number.isFinite(Number(weather.temperatureC)) ? `${weather.condition} ${Math.round(Number(weather.temperatureC))}℃` : weather?.condition || "";
    }).filter(Boolean))];
    const page = element("article", `journal-page daily-journal-page${entries.length > 2 ? " is-dense" : ""}`);
    page.dataset.journalLabel = `第 ${dayNumber} 天 · ${day.date.month}/${day.date.day} · ${routeNames.join(" → ")}`;
    page.dataset.journalDay = day.date.key;

    const masthead = element("header", "daily-journal-masthead");
    const dayMark = element("div", "daily-journal-daymark");
    dayMark.append(
      element("small", "", `DAY ${journalPageNumber(dayNumber)}`),
      element("b", "", day.date.day),
      element("span", "", `${day.date.month}月 · ${day.date.weekday || "旅行日"}`)
    );
    const heading = element("div", "daily-journal-heading");
    const provenanceData = dailyJournalProvenance(entries);
    const provenance = element("div", "daily-journal-provenance");
    provenance.dataset.kind = provenanceData.kind;
    provenance.title = provenanceData.detail;
    provenance.append(element("b", "", provenanceData.label), element("span", "", provenanceData.detail));
    heading.append(
      element("p", "daily-journal-kicker", `${day.date.year} · 阿镜的一日行旅`),
      element("h2", "", entries.length === 1 ? first.content?.headline || first.locationName : `从${first.locationName}走到${last.locationName}`),
      provenance
    );
    const pageMark = element("div", "daily-journal-page-no");
    pageMark.append(element("small", "", "JOURNAL"), element("b", "", journalPageNumber(pageNumber)));
    masthead.append(dayMark, heading, pageMark);

    const scroller = element("div", "daily-journal-scroll");
    const hero = element("section", "daily-journal-hero");
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    image.src = safeUrl(first.image?.url) || "/prototype/assets/cloud-wayfarer-world-v1.png";
    image.alt = first.image?.alt || `${first.locationName}旅行手账情境图`;
    image.loading = "lazy";
    const caption = document.createElement("figcaption");
    caption.append(
      element("span", "", first.image?.type === "ai-generated" ? "情境重构图 · 非实景" : "项目资料图"),
      document.createTextNode(first.image?.caption || `${first.locationName} · 非本次实景`)
    );
    figure.append(image, caption);
    const voice = element("blockquote", "daily-journal-voice");
    voice.append(
      element("small", "", "阿镜在路上说"),
      element("p", "", last.content?.postcardLine || first.content?.deck || first.content?.observation || "这一页正在慢慢写成。"),
      element("footer", "", weatherLabels.join(" · ") || `${entries.length} 个时间节点`)
    );
    hero.append(figure, voice);

    const route = element("div", "daily-journal-route");
    route.append(element("span", "", "TODAY'S TRACE"));
    routeNames.forEach((name, index) => {
      if (index) route.append(element("i", "", "→"));
      route.append(element("b", "", name));
    });

    const timeline = document.createElement("ol");
    timeline.className = "daily-journal-timeline";
    entries.forEach((entry, index) => {
      const moment = element("li", "daily-journal-moment");
      moment.append(element("time", "", Data.localClock(entry) || "刚刚整理"));
      const content = element("div", "daily-journal-moment-copy");
      content.append(
        element("small", "", `${entry.context?.localTime?.period || "此刻"} · ${entry.locationName}`),
        element("h3", "", entry.content?.headline || entry.locationName),
        element("p", "", entry.content?.observation || entry.content?.deck || "这一站正在整理。")
      );
      const notes = element("div", "daily-journal-notes");
      if (entry.content?.cultureTitle || entry.content?.cultureBody) {
        const culture = element("aside", "daily-journal-culture");
        culture.append(
          element("small", "", "文化夹页 · 阿镜讲给你听"),
          element("h4", "", entry.content?.cultureTitle || "这一地的来处"),
          element("p", "", entry.content?.cultureBody || "相关地方资料正在整理。")
        );
        notes.append(culture);
      }
      const taste = journalTaste(entry);
      if (taste) {
        const food = element("aside", "daily-journal-taste");
        food.append(element("small", "", "味觉记忆"), element("h4", "", taste.title), element("p", "", taste.body));
        notes.append(food);
      }
      if (notes.childElementCount) content.append(notes);
      if (index > 0 && entry.image?.url) {
        const snapshot = element("figure", "daily-journal-snapshot");
        const snapshotImage = document.createElement("img");
        snapshotImage.src = safeUrl(entry.image.url);
        snapshotImage.alt = entry.image.alt || `${entry.locationName}旅行手账情境图`;
        snapshotImage.loading = "lazy";
        snapshot.append(snapshotImage, element("figcaption", "", entry.locationName));
        content.append(snapshot);
      }
      moment.append(content);
      timeline.append(moment);
    });

    const letter = element("aside", "daily-journal-letter");
    letter.append(
      element("small", "", "写给屏幕另一边的你"),
      element("h3", "", last.content?.letterTitle || "今天写给你的话"),
      element("p", "", last.content?.letterBody || last.content?.postcardLine || "这一页，等我们下次接着写。")
    );
    scroller.append(hero, route, timeline, letter);
    appendJournalSources(scroller, entries);
    page.append(masthead, scroller);
    return page;
  }

  function journalGenerationPage(locationName, failed = false) {
    const page = element("article", `journal-page journal-generation-page${failed ? " is-failed" : ""}`);
    page.dataset.journalLabel = failed ? "这一页待续" : "这一页还在写";
    const sheet = element("div", "journal-generation-sheet");
    sheet.append(
      element("i", "journal-generation-pulse"),
      element("h2", "", failed ? `${locationName}这一页还没写成。` : `正在把${locationName}写进手账。`),
      element("p", "", failed ? "已经写下的页面都还在。等一会儿，我再把这一页接着写完。" : "这一站还没有写完。等我把路上的感受理顺，再把这一页递给你。")
    );
    page.append(sheet);
    return page;
  }

  function updateMobileJournalControls() {
    const pages = [...document.querySelectorAll("#journal-stack > .journal-page")];
    const maxPage = Math.max(0, pages.length - 1);
    mobileJournalPage = Math.max(0, Math.min(mobileJournalPage, maxPage));
    const previous = document.querySelector("#mobile-journal-prev");
    const next = document.querySelector("#mobile-journal-next");
    if (previous) previous.disabled = mobileJournalTurning || mobileJournalPage === 0;
    if (next) next.disabled = mobileJournalTurning || mobileJournalPage >= maxPage;
    const currentLabel = pages[mobileJournalPage]?.dataset.journalLabel || "封面";
    const stack = document.querySelector("#journal-stack");
    if (stack) stack.setAttribute("aria-label", `我的旅行手账，当前${currentLabel}，第 ${mobileJournalPage + 1} 页，共 ${pages.length || 1} 页`);
    document.querySelector("#mobile-journal-book")?.setAttribute("data-page", String(mobileJournalPage));
  }

  function finishMobileJournalTurn() {
    if (mobileJournalTurnTimer) window.clearTimeout(mobileJournalTurnTimer);
    mobileJournalTurnTimer = null;
    document.querySelectorAll("#journal-stack > .journal-page").forEach((page, index) => {
      const current = index === mobileJournalPage;
      page.classList.toggle("is-current", current);
      page.classList.remove("is-turning-forward", "is-turning-backward", "is-turn-under");
      page.setAttribute("aria-hidden", String(!current));
    });
    mobileJournalTurning = false;
    updateMobileJournalControls();
  }

  function showMobileJournalPage(nextPage) {
    const pages = [...document.querySelectorAll("#journal-stack > .journal-page")];
    if (!pages.length) return;
    const target = Math.max(0, Math.min(Number(nextPage) || 0, pages.length - 1));
    if (mobileJournalTurning || target === mobileJournalPage) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const currentPage = pages[mobileJournalPage];
    const targetPage = pages[target];
    const forward = target > mobileJournalPage;
    mobileJournalPage = target;
    if (reduceMotion) {
      finishMobileJournalTurn();
      return;
    }
    mobileJournalTurning = true;
    pages.forEach((page) => page.setAttribute("aria-hidden", "true"));
    targetPage.classList.add("is-current", forward ? "is-turn-under" : "is-turning-backward");
    targetPage.setAttribute("aria-hidden", "false");
    if (forward) currentPage.classList.add("is-turning-forward");
    else currentPage.classList.add("is-turn-under");
    updateMobileJournalControls();
    mobileJournalTurnTimer = window.setTimeout(finishMobileJournalTurn, 560);
  }

  function renderJournal(view, entries, sourceJourney = null) {
    const stack = document.querySelector("#journal-stack");
    const days = Data.groupEntriesByLocalDay(entries);
    const pages = [journalCover(view, days.length, entries.length)];
    days.forEach((day, index) => pages.push(dailyJournalPage(day, index + 1, index + 1)));
    const pendingGeneration = Object.entries(sourceJourney?.generation || {}).find(([, state]) => ["generating", "failed"].includes(state?.status));
    if (pendingGeneration) {
      const [locationId, state] = pendingGeneration;
      const locationName = view?.route?.find((stop) => stop.id === locationId)?.name || locationId;
      pages.push(journalGenerationPage(locationName, state.status === "failed"));
    }
    stack.replaceChildren(...pages);
    mobileJournalPage = Math.min(mobileJournalPage, pages.length - 1);
    pages.forEach((page, index) => {
      page.classList.toggle("is-current", index === mobileJournalPage);
      page.setAttribute("aria-hidden", String(index !== mobileJournalPage));
    });
    updateMobileJournalControls();
  }

  function renderRoute(view) {
    const list = document.querySelector("#live-route-stops");
    list.replaceChildren();
    if (!view) {
      const item = element("li");
      item.append(element("b", "", "尚未连接"), element("small", "", "没有路线数据"));
      list.append(item);
      document.querySelector("#route-phase").textContent = "等待旅程";
      document.querySelector("#journey-updated-at").textContent = "未同步";
      renderMobileFavorites();
      return;
    }
    view.route.forEach((stop, index) => {
      let name = stop.name;
      if (stop.id === view.location.id && (name === stop.id || !name)) name = view.location.name;
      const entry = view.entries.find((candidate) => candidate.locationId === stop.id);
      const date = entry
        ? Data.shortDate(entry).date
        : stop.state === "current"
          ? (index === 0 ? "旅程起点 · 此刻" : "此刻")
          : stop.revealed ? "下一站" : "未公开";
      const item = element("li", `route-stop-card ${stop.state}${entry ? " has-entry" : ""}`);
      const stopHead = element("div", "route-stop-head");
      const sequence = element("span", "route-stop-sequence", String(index + 1).padStart(2, "0"));
      stopHead.append(sequence);

      if (entry) {
        const entryId = String(entry.id || entry.locationId || index);
        const expanded = routeExpansionState.has(entryId)
          ? routeExpansionState.get(entryId)
          : stop.state === "current";
        item.classList.toggle("is-expanded", expanded);

        const detailId = `mobile-route-detail-${entryId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const toggle = element("button", "route-stop-toggle");
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.setAttribute("aria-controls", detailId);
        const title = element("span", "route-stop-title");
        title.append(
          element("small", "", `${date} · ${stop.state === "current" ? "此刻停留" : "已经去过"}`),
          element("b", "", name),
          element("em", "", entry.content?.headline || entry.content?.postcardLine || "翻开这张沿途手帐")
        );
        const cue = element("span", "route-stop-cue");
        cue.append(element("small", "", expanded ? "收起" : "翻开"), element("i", "", expanded ? "−" : "+"));
        toggle.append(title, cue);

        const favorite = element("button", "route-favorite", isMobileFavorite(entry) ? "★" : "☆");
        favorite.type = "button";
        favorite.setAttribute("aria-label", `${isMobileFavorite(entry) ? "取消收藏" : "收藏"}${entry.locationName}足迹`);
        favorite.setAttribute("aria-pressed", String(isMobileFavorite(entry)));
        favorite.addEventListener("click", () => toggleMobileFavorite(entry));
        stopHead.append(toggle, favorite);

        const detail = element("div", "route-stop-detail");
        detail.id = detailId;
        detail.setAttribute("aria-hidden", String(!expanded));
        detail.inert = !expanded;
        const detailInner = element("div", "route-stop-detail-inner");
        const page = element("article", "route-journal-page");
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = safeUrl(entry.image?.url) || DEFAULT_SCENE_IMAGE;
        image.alt = entry.image?.alt || `${entry.locationName || name}途中所见`;
        image.loading = "lazy";
        figure.append(image, element("figcaption", "", entry.image?.caption || `${entry.locationName || name} · 沿途资料图`));

        const writing = element("div", "route-journal-writing");
        writing.append(
          element("small", "", `抵达手记 · PAGE ${String(index + 1).padStart(2, "0")}`),
          element("h3", "", entry.content?.headline || `抵达${entry.locationName || name}`),
          element("p", "", entry.content?.observation || entry.content?.deck || "这一站已经抵达，我正把看到和想到的慢慢装订起来。")
        );
        const quote = document.createElement("blockquote");
        quote.append(
          element("span", "", "阿镜沿途写下"),
          document.createTextNode(`“${entry.content?.postcardLine || entry.content?.letterBody || entry.content?.headline || "这一站的文字正在装订。"}”`)
        );
        writing.append(quote);
        const pageFooter = element("footer");
        const fullDate = Data.shortDate(entry);
        pageFooter.append(
          element("span", "", `${fullDate.date} · ${fullDate.time}`),
          element("b", "", entry.sources?.length ? `${entry.sources.length} 条资料线索` : "阿镜手记")
        );
        writing.append(pageFooter);
        page.append(figure, writing);
        detailInner.append(page);
        detail.append(detailInner);

        const setExpanded = (nextExpanded) => {
          routeExpansionState.set(entryId, nextExpanded);
          item.classList.toggle("is-expanded", nextExpanded);
          toggle.setAttribute("aria-expanded", String(nextExpanded));
          detail.setAttribute("aria-hidden", String(!nextExpanded));
          detail.inert = !nextExpanded;
          cue.querySelector("small").textContent = nextExpanded ? "收起" : "翻开";
          cue.querySelector("i").textContent = nextExpanded ? "−" : "+";
          if (nextExpanded) {
            const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
            window.setTimeout(() => item.scrollIntoView({ block: "nearest", behavior }), 40);
          }
        };
        toggle.addEventListener("click", () => setExpanded(toggle.getAttribute("aria-expanded") !== "true"));
        item.append(stopHead, detail);
      } else {
        const quietStop = element("div", "route-stop-quiet");
        quietStop.append(element("b", "", name), element("small", "", date));
        stopHead.append(quietStop);
        item.append(stopHead);
      }
      list.append(item);
    });
    document.querySelector("#route-phase").textContent = `${view.phaseText} · ${Math.round(view.progress * 100)}%`;
    document.querySelector("#journey-updated-at").textContent = `${view.clock} 更新`;
    document.querySelector("#route-letter-count").textContent = `来信·${view.entries.length}`;
    document.querySelector("#route-memory-count").textContent = `记忆·${view.memories.length}`;
    document.querySelector("#route-event-count").textContent = `事件·${view.events.length}`;
    const origin = view.route[0]?.name;
    const next = view.route.find((stop) => stop.state === "future" && stop.revealed)?.name;
    document.querySelector("#route-note").textContent = origin
      ? next
        ? `这一程从${origin}出发，下一站是${next}。地图会继续沿真实道路长出来。`
        : `这一程从${origin}出发。下一站确定后，会和选择理由一起写在这里。`
      : "起点与已经发生的路线会留在这里。";
    renderMobileFavorites();
  }

  function renderOnsitePrompts(view) {
    const prompts = document.querySelector("#onsite-prompts");
    prompts.replaceChildren(element("p", "", photoObjectUrl ? "围绕这张照片，你可以先问：" : "不拍也可以，直接问我："));
    const questions = photoObjectUrl ? [
      "先帮我看看，这可能是什么？",
      "它过去是什么样，为什么会变成今天这样？"
    ] : [
      "我眼前这个东西是什么？",
      "过去这里是什么样的？"
    ];
    questions.forEach((question) => {
      const button = element("button", "", question);
      button.type = "button";
      button.dataset.prompt = question;
      prompts.append(button);
    });
    document.querySelector("#agent-live-place").textContent = view?.location?.name ? `${view.location.name} · ${view.clock || "在路上"}` : "尚未关联远方旅程";
  }

  function renderJourney(nextJourney, context = null) {
    journey = nextJourney;
    updateOnboardingJourneyState();
    journeyContext = context;
    journeyView = Data.journeyView(journey, journeyContext);
    renderNow(journeyView);
    const generationSignature = Object.entries(journey?.generation || {}).map(([id, state]) => `${id}:${state?.status || ""}`).join("|");
    const entriesSignature = `${journeyView.entries.map((entry) => `${entry.id}:${entry.meta?.generatedAt || ""}`).join("|")}::${journeyView.phase}::${generationSignature}`;
    if (entriesSignature !== renderedEntriesSignature) {
      renderLetters(journeyView.entries);
      renderJournal(journeyView, journeyView.entries, journey);
      renderedEntriesSignature = entriesSignature;
    }
    renderRoute(journeyView);
    if (journeyView.location.id !== renderedOnsiteLocationId) {
      renderOnsitePrompts(journeyView);
      renderedOnsiteLocationId = journeyView.location.id;
    }
  }

  async function hydrateJourney(options = {}) {
    if (hydratePromise) return hydratePromise;
    if (!options.silent) renderLoading();
    hydratePromise = (async () => {
      const result = await api.loadJourney(params);
      if (result.status === "empty") {
        renderEmpty();
        return null;
      }
      const currentId = result.journey?.state?.currentLocationId;
      const context = await api.loadContext(currentId).catch(() => null);
      renderJourney(result.journey, context);
      startPolling();
      return result.journey;
    })().catch((error) => {
      renderError(error);
      return null;
    }).finally(() => { hydratePromise = null; });
    return hydratePromise;
  }

  function startPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(() => {
      if (!document.hidden && journey?.id) hydrateJourney({ silent: true });
    }, 10000);
  }

  async function createRealJourney() {
    const button = document.querySelector("#create-real-journey");
    button.disabled = true;
    button.textContent = "正在创建并启动…";
    document.querySelector("#topbar-live-status").textContent = "第一站正在写进手帐";
    try {
      const created = await api.createJourney({
        mode: "自驾",
        pace: "沉浸节奏",
        theme: "第一次认识贵州",
        commission: ""
      });
      const started = await api.startJourney(created.id);
      const context = await api.loadContext(started.state?.currentLocationId).catch(() => null);
      renderJourney(started, context);
      startPolling();
      showToast("真实旅程已经创建，并与 PC 端共用同一编号");
    } catch (error) {
      renderError(error);
    } finally {
      button.disabled = false;
      button.textContent = "开始一段真实旅程";
    }
  }

  function openLetter(entryId) {
    const entry = editorialLetterIssues.find((candidate) => candidate.id === entryId || candidate.sourceEntryIds?.includes(entryId));
    if (!entry) return;
    activeLetterId = entry.id;
    stopLetterAudio();
    const index = editorialLetterIssues.findIndex((candidate) => candidate.id === entry.id) + 1;
    const date = Data.shortDate(entry);
    document.querySelector("#letter-reader-index").textContent = `远方来信 · 第 ${index} 封`;
    document.querySelector("#letter-written-time").textContent = `写于 ${date.date} ${date.time}`;
    document.querySelector("#letter-location").textContent = entry.locationName;
    document.querySelector("#letter-format").textContent = `从${entry.locationName || "贵州"}寄来`;
    document.querySelector("#letter-title").textContent = entry.content?.letterTitle || entry.content?.headline || "旅程来信";
    const issueLabel = entry.delivery?.editorial?.label || "阿镜周记";
    document.querySelector("#letter-issue").textContent = `${issueLabel} · VOL. ${String(index).padStart(2, "0")}`;
    document.querySelector("#letter-deck").textContent = entry.content?.deck || entry.content?.cultureTitle || "从一个真实的地方出发，把它的来路慢慢讲给你听。";
    const body = document.querySelector("#letter-body");
    const paragraphs = splitLetterParagraphs(entry.content?.letterBody || entry.content?.observation || "这封信还在路上。");
    const nodes = paragraphs.map((paragraph) => element("p", "", paragraph));
    if (entry.content?.cultureBody) {
      const factNote = element("p", "letter-fact-note", entry.content.cultureBody);
      nodes.splice(Math.min(2, nodes.length), 0, factNote);
    }
    const signature = element("p", "signature", journeyView?.agentName || "阿镜");
    signature.append(element("small", "", `${entry.locationName} · ${date.date}`));
    body.replaceChildren(...nodes, signature);
    const narration = letterNarrationText(entry);
    letterEstimatedDuration = Math.max(45, Math.ceil(narration.length / 4.1));
    updateLetterAudioClock(0, letterEstimatedDuration);
    setLetterAudioUi("idle", "阿镜 · 点击收听");
    const sources = document.querySelector("#letter-sources");
    sources.replaceChildren();
    const weather = entry.context?.weather;
    if (weather?.available) {
      const row = element("div");
      row.append(element("dt", "", "实时环境"), element("dd", "", `${weather.location || entry.locationName} · ${weather.condition} · ${Math.round(weather.temperatureC)}℃ · ${weather.observedAt || ""}`));
      sources.append(row);
    }
    (entry.sources || []).forEach((source) => {
      const row = element("div");
      const description = safeUrl(source.url) ? `${source.title} · ${source.url}` : source.title;
      row.append(element("dt", "", source.kind || "资料来源"), element("dd", "", description));
      sources.append(row);
    });
    if (!sources.children.length) {
      const row = element("div");
      row.append(element("dt", "", "这一页"), element("dd", "", "没有另附资料，只保留当时写下的旅程内容。"));
      sources.append(row);
    }
    openOverlay("letter-reader");
  }

  async function sendOnsiteMessage() {
    const input = document.querySelector("#onsite-input");
    const value = input.value.trim();
    if (!value) {
      showToast("先写下你想问的事");
      input.focus();
      return;
    }
    const prompts = document.querySelector("#onsite-prompts");
    const conversation = document.querySelector("#onsite-conversation");
    prompts.hidden = true;
    const userMessage = element("div", "onsite-message");
    userMessage.append(element("small", "", "你 · 刚刚"), element("p", "", value));
    const reply = element("div", "ajing-reply is-loading");
    reply.append(element("small", "", "阿镜 · 正在想"), element("p", "", photoObjectUrl ? "这张照片现在还留在你的手机里，我不会装作已经看见。先从你写下的问题聊起；若要发送照片，我会再把用途说清楚。" : "我先想想你真正想问什么，再从一路记下的东西里找答案…"));
    conversation.append(userMessage, reply);
    input.value = "";
    input.disabled = true;
    try {
      const response = await api.ask({
        question: value,
        locationId: journeyView?.location?.id || "guiyang",
        journeyId: journey?.id || null,
        remember: Boolean(replyingToEntryId),
        replyToEntryId: replyingToEntryId
      });
      reply.classList.remove("is-loading");
      reply.replaceChildren(
        element("small", "", "阿镜 · 回应"),
        element("p", "", response.answer || "这次没能把话寄回来，请稍后再问我。")
      );
      if (response.sources?.length) reply.append(element("p", "answer-sources", `来源：${response.sources.map((source) => source.title).join("、")}`));
      if (response.recommendation) appendConversationRecommendation(reply, response.recommendation);
      if (replyingToEntryId) {
        replyingToEntryId = null;
        input.placeholder = "问我眼前的事…";
        await hydrateJourney({ silent: true });
      }
    } catch (error) {
      reply.classList.remove("is-loading");
      reply.replaceChildren(element("small", "", "暂时失联"), element("p", "", error.message || "这句话刚才没有送到，稍后再试一次。"));
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function appendConversationRecommendation(reply, recommendation) {
    const offers = (recommendation?.offers || []).filter((offer) => safeUrl(offer.href));
    if (!offers.length) return;
    const card = element("aside", "conversation-recommendation");
    card.append(
      element("small", "", "资料与评价都达到门槛后，阿镜才提起"),
      element("strong", "", recommendation.title || "一条当地线索"),
      element("p", "", recommendation.recommendationReason || recommendation.question || "这条入口与你刚才问的事直接相关。")
    );
    if (recommendation.evidenceSummary) card.append(element("p", "recommendation-evidence", recommendation.evidenceSummary));
    const links = element("div", "recommendation-links");
    for (const offer of offers) {
      const link = element("a", "", offer.actionLabel || `去${offer.platformLabel || "第三方平台"}看看`);
      link.href = safeUrl(offer.href);
      link.target = "_blank";
      link.rel = "noreferrer noopener";
      links.append(link);
    }
    card.append(links);
    if (recommendation.disclosure?.message) card.append(element("p", "recommendation-disclosure", recommendation.disclosure.message));
    reply.append(card);
  }

  function requestUserLocation() {
    const target = document.querySelector("#user-live-place");
    const label = target?.querySelector("b");
    if (!navigator.geolocation) {
      if (label) label.textContent = "浏览器不支持定位";
      return;
    }
    target.disabled = true;
    if (label) label.textContent = "正在取得位置…";
    locateUser().then((position) => {
      const lat = position.lat.toFixed(4);
      const lng = position.lng.toFixed(4);
      if (label) label.textContent = `已授权本次 · ${lat}, ${lng}`;
      target.disabled = false;
    }).catch(() => {
      if (label) label.textContent = "位置未授权 · 仍可只看照片";
      target.disabled = false;
    });
  }

  document.querySelector("#enter-app")?.addEventListener("click", advanceOnboarding);
  document.querySelector("#onboarding-back")?.addEventListener("click", () => showOnboardingStep(onboardingStep - 1));
  document.querySelector("#onboarding-exit")?.addEventListener("click", () => showApp(true));
  document.querySelectorAll("[data-onboarding-select]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.onboardingSelect;
      onboardingSelections[name] = button.dataset.value;
      document.querySelectorAll(`[data-onboarding-select="${name}"]`).forEach((candidate) => {
        const selected = candidate === button;
        candidate.classList.toggle("is-selected", selected);
        candidate.setAttribute("aria-checked", String(selected));
      });
      syncOnboardingSummary();
    });
  });
  document.querySelector("#create-real-journey")?.addEventListener("click", () => createRealJourney());
  document.querySelector("#retry-journey")?.addEventListener("click", () => hydrateJourney());
  document.querySelector("#user-live-place")?.addEventListener("click", requestUserLocation);
  document.querySelector("#mobile-plan-favorites")?.addEventListener("click", planMobileFavorites);

  document.addEventListener("click", (event) => {
    const screenTarget = event.target.closest("[data-screen-target]");
    if (screenTarget) switchScreen(screenTarget.dataset.screenTarget);
    const opener = event.target.closest("[data-open]");
    if (opener) openOverlay(opener.dataset.open);
    const closer = event.target.closest("[data-close]");
    if (closer) closeOverlay(closer.dataset.close);
    const letter = event.target.closest("[data-entry-id]");
    if (letter) openLetter(letter.dataset.entryId);
    const prompt = event.target.closest("[data-prompt]");
    if (prompt) {
      const input = document.querySelector("#onsite-input");
      input.value = prompt.dataset.prompt;
      input.focus();
    }
  });

  document.querySelector("#open-latest-letter")?.addEventListener("click", () => {
    if (journeyView?.latest) openLetter(journeyView.latest.id);
  });
  document.querySelector("#play-letter")?.addEventListener("click", toggleLetterAudio);

  document.querySelectorAll(".source-toggle").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const panel = toggle.nextElementSibling;
      if (!panel?.classList.contains("source-panel")) return;
      const open = panel.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector("i").textContent = open ? "−" : "+";
    });
  });

  document.querySelector("#reply-letter")?.addEventListener("click", () => {
    const entry = editorialLetterIssues.find((candidate) => candidate.id === activeLetterId);
    replyingToEntryId = entry?.replyEntryId || null;
    closeOverlay("letter-reader");
    switchScreen("onsite");
    const input = document.querySelector("#onsite-input");
    input.placeholder = entry ? `回复“${entry.content?.letterTitle || entry.locationName}”…` : "回复这封信…";
    window.setTimeout(() => input.focus(), 220);
  });

  document.querySelector("#leave-word")?.addEventListener("click", () => {
    switchScreen("onsite");
    const input = document.querySelector("#onsite-input");
    input.placeholder = "给远方留句话…";
    window.setTimeout(() => input.focus(), 220);
  });

  const photoInput = document.querySelector("#onsite-photo");
  const albumInput = document.querySelector("#onsite-album");

  function previewOnsitePhoto(file) {
    if (!file) return;
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = URL.createObjectURL(file);
    document.querySelector("#photo-preview").src = photoObjectUrl;
    document.querySelector("#capture-panel").hidden = true;
    document.querySelector("#photo-result").hidden = false;
    document.querySelector("#interpretation-path").hidden = false;
    document.querySelector("#onsite-story-demo").hidden = true;
    document.querySelector("#onsite-prompts").hidden = false;
    renderOnsitePrompts(journeyView);
    showToast("照片只在本机预览；没有上传，也没有伪造识别结果");
  }

  function removeOnsitePhoto() {
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = null;
    if (photoInput) photoInput.value = "";
    if (albumInput) albumInput.value = "";
    document.querySelector("#photo-preview")?.removeAttribute("src");
    document.querySelector("#photo-result").hidden = true;
    document.querySelector("#interpretation-path").hidden = true;
    document.querySelector("#onsite-story-demo").hidden = true;
    document.querySelector("#capture-panel").hidden = false;
    document.querySelector("#onsite-prompts").hidden = false;
    renderOnsitePrompts(journeyView);
  }

  photoInput?.addEventListener("change", () => previewOnsitePhoto(photoInput.files?.[0]));
  albumInput?.addEventListener("change", () => previewOnsitePhoto(albumInput.files?.[0]));
  document.querySelector("#remove-onsite-photo")?.addEventListener("click", removeOnsitePhoto);
  document.querySelector("#composer-photo")?.addEventListener("click", () => photoInput?.click());
  document.querySelector("#show-onsite-demo")?.addEventListener("click", () => {
    const demo = document.querySelector("#onsite-story-demo");
    demo.hidden = false;
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
    window.setTimeout(() => demo.scrollIntoView({ behavior, block: "start" }), 30);
  });

  document.querySelectorAll("[data-onsite-layer]").forEach((button) => {
    button.addEventListener("click", () => {
      const content = ONSITE_LAYER_COPY[button.dataset.onsiteLayer] || ONSITE_LAYER_COPY.now;
      document.querySelectorAll("[data-onsite-layer]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-selected", String(active));
      });
      document.querySelector("#onsite-demo-title").textContent = content.title;
      document.querySelector("#onsite-layer-copy").textContent = content.copy;
    });
  });

  document.querySelectorAll("[data-guest-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const content = ONSITE_GUEST_COPY[button.dataset.guestView] || ONSITE_GUEST_COPY.local;
      document.querySelectorAll("[data-guest-view]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
      const blockquote = document.querySelector("#guest-view-copy");
      blockquote.querySelector("small").textContent = content.label;
      blockquote.querySelector("p").textContent = content.copy;
    });
  });

  document.querySelector("#send-onsite")?.addEventListener("click", sendOnsiteMessage);
  document.querySelector("#onsite-input")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) sendOnsiteMessage();
  });

  document.querySelector("#clear-reading")?.addEventListener("change", (event) => {
    document.body.classList.toggle("clear-reading", event.currentTarget.checked);
    showToast(event.currentTarget.checked ? "已开启清晰阅读" : "已恢复纸本阅读");
  });

  document.querySelector("#mobile-journal-prev")?.addEventListener("click", () => showMobileJournalPage(mobileJournalPage - 1));
  document.querySelector("#mobile-journal-next")?.addEventListener("click", () => showMobileJournalPage(mobileJournalPage + 1));
  const mobileJournalStack = document.querySelector("#journal-stack");
  mobileJournalStack?.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    mobileJournalPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  mobileJournalStack?.addEventListener("pointerup", (event) => {
    if (!mobileJournalPointer || mobileJournalPointer.id !== event.pointerId) return;
    const deltaX = event.clientX - mobileJournalPointer.x;
    const deltaY = event.clientY - mobileJournalPointer.y;
    mobileJournalPointer = null;
    const threshold = Math.max(44, mobileJournalStack.clientWidth * 0.13);
    if (Math.abs(deltaX) < threshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    showMobileJournalPage(mobileJournalPage + (deltaX < 0 ? 1 : -1));
  });
  mobileJournalStack?.addEventListener("pointercancel", () => { mobileJournalPointer = null; });
  mobileJournalStack?.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "PageUp", "PageDown"].includes(event.key)) return;
    event.preventDefault();
    showMobileJournalPage(mobileJournalPage + (["ArrowRight", "PageDown"].includes(event.key) ? 1 : -1));
  });

  document.querySelectorAll(".segmented button, .letter-filter button, .era-scale button").forEach((button) => {
    button.addEventListener("click", () => {
      [...button.parentElement.children].forEach((item) => item.classList.toggle("is-active", item === button));
      if (button.closest(".segmented")) showToast(`已设为“${button.textContent.trim()}”`);
      if (button.id === "voice-letter-count") {
        const voiced = editorialLetterIssues.filter((entry) => entry.delivery?.voice?.status !== "unavailable");
        renderLetters(voiced);
        button.classList.add("is-active");
      } else if (button.id === "all-letter-count") renderLetters(journeyView?.entries || []);
    });
  });

  document.querySelectorAll(".setting-link").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.textContent.includes("重看")) {
        closeOverlay("settings");
        showIntro();
      } else showToast(journey ? `这段旅程已经留下 ${journeyView.memories.length} 条记忆` : "还没有开始一段旅程");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const activeOverlay = [...document.querySelectorAll(".overlay")].reverse().find((item) => !item.hidden);
    if (activeOverlay) closeOverlay(activeOverlay.id);
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    document.querySelector("#install-app").hidden = false;
  });

  window.addEventListener("pagehide", () => {
    stopLetterAudio();
    letterAudioCache.forEach((url) => URL.revokeObjectURL(url));
    letterAudioCache.clear();
    letterAudioObjectUrl = "";
  });

  document.querySelector("#install-app")?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    document.querySelector("#install-app").hidden = true;
  });

  if ("serviceWorker" in navigator) {
    let refreshingForNewWorker = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshingForNewWorker) return;
      refreshingForNewWorker = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/app/sw.js?v=19", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => {});
    });
  }

  if (hasRecognized()) showApp(false);
  if (params.get("screen")) switchScreen(params.get("screen"));
  hydrateJourney({ silent: true });
})();
