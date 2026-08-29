const body = document.body;
const pageParams = new URLSearchParams(window.location.search);
const FIRST_VISIT_STORAGE_KEY = "cloud_wayfarer-workspace-entered";
const AI_JOURNEY_STORAGE_KEY = "cloud_wayfarer-ai-journey-started";
const PERSONAL_JOURNEY_ID_STORAGE_KEY = "cloud_wayfarer-personal-journey-id";
const CITY_JOURNAL_STORAGE_KEY = "cloud_wayfarer-selected-city-journal";
const LEAF_INTERACTIONS_STORAGE_KEY = "cloud_wayfarer-leaf-interactions";
const COMMERCE_ACTIONS_STORAGE_KEY = "cloud_wayfarer-commerce-actions-v1";
const COMMERCE_SAVED_STORAGE_KEY = "cloud_wayfarer-commerce-saved-v1";
const ROUTE_SEGMENT_CACHE_STORAGE_KEY = "cloud_wayfarer-route-segments-v1";
const TRAVEL_PACE_PROFILES = Object.freeze({
  "实时同行": { fallbackMinutes: 40, multiplier: 1, summary: "按真实道路时间" },
  "沉浸节奏": { fallbackMinutes: 30, multiplier: 10, summary: "约 10× 加速" },
  "快速云游": { fallbackMinutes: 8, multiplier: 40, summary: "约 40× 加速" }
});
const EDITION = "unified";
const REQUESTED_VIEW = pageParams.get("view") === "journal" ? "journal" : body.dataset.view;
const travelHome = document.querySelector("#travel-home");
const journalApp = document.querySelector("#main-content");
const firstVisitHome = document.querySelector("#first-visit-home");
const journeyArrival = document.querySelector(".journey-arrival");
const journeyBriefPanel = document.querySelector(".journey-brief");
const travelMapStage = document.querySelector("#travel-map");
const realTravelMap = document.querySelector("#real-travel-map");
const realTravelMapPreview = document.querySelector("#workspace-mini-map");
const travelMapPreviewShell = document.querySelector(".module-map-preview");
const agentMapPreviewButton = document.querySelector("#agent-map-preview");
const workspaceModuleRail = document.querySelector(".workspace-module-rail");
const workspaceModuleButtons = [...document.querySelectorAll("[data-workspace-module-target]")];
const expandTravelMapButton = document.querySelector("#expand-travel-map");
const collapseTravelMapButton = document.querySelector("#collapse-travel-map");
const followTravelAgentButton = document.querySelector("#follow-travel-agent");
const travelSettings = document.querySelector("#travel-settings");
const travelToast = document.querySelector("#travel-toast");
const book = document.querySelector("#book");
const cover = document.querySelector("#book-cover");
const spread = document.querySelector("#book-spread");
const turningLeaf = document.querySelector("#turning-leaf");
const chapterIndexSpread = document.querySelector("#chapter-index-spread");
const placeTabs = document.querySelector("#place-tabs");
const photoPocket = document.querySelector("#photo-pocket");
const sourceSlip = document.querySelector("#source-slip");
const audioRibbon = document.querySelector("#audio-ribbon");
const onsiteCompanion = document.querySelector("#onsite-companion");
const onsitePhotoInput = document.querySelector("#onsite-photo-input");
const onsitePhotoPreview = document.querySelector("#onsite-photo-preview");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const mobileQuery = window.matchMedia("(max-width: 899px)");

let nodes = [];
let nodeById = new Map();
let detailRecords = {};
let sourceCatalog = {};
let catalogEntries = [];
let currentNode = null;
let trail = [];
let trailIndex = -1;
let chapterIndexGroup = null;
let toastTimer;
let pageTimer;
let swipeStart = null;
let travelToastTimer;
let travelAnimationFrame;
let travelLastFrame = null;
const TRAVEL_PROGRESS_START = 0.055;
let travelProgressSegmentStart = TRAVEL_PROGRESS_START;
let travelProgressCap = 0.16;
let travelProgressValue = TRAVEL_PROGRESS_START;
let travelSegmentDurationMinutes = 30;
let travelMode = "自驾";
let travelPaused = false;
let travelMap = null;
let travelMapPreview = null;
let travelMapPreviewInitialization = null;
let travelMapSignature = "";
let travelMapPendingSignature = "";
let travelMapBuildToken = 0;
let travelMapExpanded = false;
let travelMapFollowing = true;
let travelAgentLatLng = null;
let travelFollowLastUpdate = 0;
let travelPreviewFollowLastUpdate = 0;
let travelMapLastRenderAt = 0;
let travelRouteLatLngs = [];
let travelRouteDistances = [];
let travelRouteDistance = 0;
let travelRouteSegments = [];
let travelRouteStopDistances = [0];
let travelActiveSegmentMeta = null;
let travelActiveRouteAvailable = true;
let travelRouteSegmentCache = null;
let userJournalPage = 0;
let userJournalSwipeStart = null;
let userJournalIsTurning = false;
let userJournalTurnTimer = null;
let userJournalTurnTarget = null;
let userJournalTurnOverlay = null;
let userJournalOpen = false;
let userJournalStatusText = "等待出发";
let workspaceModuleBeforeMap = body.dataset.workspaceModule || "journal";
let personalJourney = null;
let personalJourneyHydration = null;
let journeyPollTimer = null;
let activeHistoryFootprintId = "live";
let liveFootprintSnapshot = null;
let renderedJourneyEntryCount = 0;
const journalGenerationInFlight = new Set();
let journalArrivalTriggered = false;
let selectedCityId = pageParams.get("city") || localStorage.getItem(CITY_JOURNAL_STORAGE_KEY) || "guiyang";
let activeLeafInteractionCleanup = null;
let leafAudioContext = null;
let onsitePhotoUrl = null;
let onsiteStorySources = [];
let activeCommerceDiscovery = null;
let commerceDiscoveryLocationId = null;
const completedLeafInteractions = new Set(loadCompletedLeafInteractions());

const ONSITE_STORIES = {
  past: {
    type: "史实脉络",
    title: "从山上的城，到林中的遗址",
    copy: "海龙屯长期是播州杨氏土司的山地防御据点。1599 年播州之役后，原有建筑与政治秩序改变；后来的废弃、植被生长与考古工作，共同造成你今天看到的样子。",
    source: ["已确认事实", "云游四方知识库"]
  },
  elders: {
    type: "老一辈的讲法",
    title: "我曾读到过这样一种说法……",
    copy: "附近社区对海龙屯的记忆，常会绕着关隘、山路、战事和地名展开。不同村寨、不同受访者的版本可能不同。阿镜会先去网上寻找地方志、访谈、文博机构与当地媒体记录，再把其中能互相印证的部分像听来的故事一样慢慢讲给你。",
    source: ["正在搜寻网络记录", "多源核对后转述"]
  },
  legend: {
    type: "地方故事",
    title: "一座山城，会留下不止一个版本",
    copy: "海龙屯的民间讲述常会把真实关隘、战争记忆与后世想象叠在一起。我可以像朋友讲故事一样讲给你，但会告诉你这个版本来自哪里，哪些能与史料相印，哪些仍然只是流传的讲法。",
    source: ["正在搜寻故事版本", "传说与史实分层"]
  },
  culture: {
    type: "地理 × 制度",
    title: "山势不是背景，它就是城防",
    copy: "选在山顶，是因为陡峭山势、狭窄通道和层层关隘能一起构成防御。但这也映出土司制度下地方权力的组织方式：建筑、地形、军事与管理被放在同一套空间里。你沿山路一层层往上走，其实正在用身体读一段历史制度。",
    source: ["已确认事实", "地形与遗址关系"]
  }
};

function loadCompletedLeafInteractions() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LEAF_INTERACTIONS_STORAGE_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveCompletedLeafInteraction(nodeId) {
  completedLeafInteractions.add(nodeId);
  try {
    window.localStorage.setItem(LEAF_INTERACTIONS_STORAGE_KEY, JSON.stringify([...completedLeafInteractions]));
  } catch {
    // 本地存储不可用时，不影响当前书页互动。
  }
}

function hasStartedCloudJourney() {
  try {
    return window.localStorage.getItem(FIRST_VISIT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function hasStartedAiJourney() {
  try {
    return window.localStorage.getItem(AI_JOURNEY_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function initializeAiJourneyState() {
  const forceIdle = pageParams.get("idle") === "1";
  const forceActive = pageParams.get("active") === "1";
  const isActive = forceActive || (!forceIdle && hasStartedAiJourney());
  body.classList.toggle("is-ai-travelling", isActive);
  const clockState = document.querySelector(".travel-running-mark small");
  if (clockState) clockState.textContent = isActive ? "旅程进行中" : "阿镜正在准备";
  const clock = document.querySelector("#travel-clock");
  if (clock && !isActive) clock.textContent = "静候启程";
  setUserJournalStatus(isActive ? "阿镜正在贵州探索" : "等待出发");
  const mapCompactStatus = document.querySelector("#map-compact-status");
  if (mapCompactStatus) mapCompactStatus.textContent = isActive ? "实时位置 · 镜头跟随中" : "贵州 · 探索地图";
  renderUserJournalPage(0);
  if (isActive) window.setTimeout(() => hydratePersonalJourney(), 0);
}

function initializeFirstVisitState() {
  const forceIntroduction = pageParams.get("intro") === "1";
  const forceJourney = pageParams.get("journey") === "1";
  const isFirstVisit = forceIntroduction || (!forceJourney && !hasStartedCloudJourney());
  body.classList.toggle("is-first-visit", isFirstVisit);
  updateFirstVisitAccessibility(isFirstVisit);
}

function updateFirstVisitAccessibility(isFirstVisit) {
  firstVisitHome?.setAttribute("aria-hidden", String(!isFirstVisit));
  if (firstVisitHome) firstVisitHome.inert = !isFirstVisit;
  [journeyArrival, travelMapStage, journeyBriefPanel].forEach((element) => {
    element?.setAttribute("aria-hidden", String(isFirstVisit));
    if (element) element.inert = isFirstVisit;
  });
  const provinceJournalButton = document.querySelector("#open-province-journal");
  if (provinceJournalButton) provinceJournalButton.disabled = isFirstVisit;
}

function enterCloudJourney(remember = false) {
  if (remember) {
    try {
      window.localStorage.setItem(FIRST_VISIT_STORAGE_KEY, "true");
    } catch {
      // 无持久化权限时仍允许用户进入本次旅程。
    }
  }
  body.classList.remove("is-first-visit");
  updateFirstVisitAccessibility(false);
  window.setTimeout(() => {
    travelMap?.resize();
    travelMapPreview?.resize?.();
    if (travelMapPreview && travelAgentLatLng) {
      travelMapPreview.setView(travelAgentLatLng, travelPreviewTrackingZoom(), false);
    }
    const nextFocus = body.classList.contains("is-ai-travelling")
      ? document.querySelector("#user-journal-next")
      : document.querySelector("#plan-ai-journey");
    nextFocus?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 430);
}

function showCloudJourneyHome() {
  setProductView("travel");
  if (travelMapExpanded) setTravelMapExpanded(false);
  closeTravelSettings();
  closeOnsiteCompanion();
  body.classList.add("is-first-visit");
  updateFirstVisitAccessibility(true);
  window.setTimeout(() => {
    document.querySelector("#start-cloud-journey")?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 430);
}

initializeFirstVisitState();
initializeAiJourneyState();

const EXPLORATION_LOCATIONS = {
  guiyang: { name: "甲秀楼", region: "贵阳 · 南明区", detail: "南明河水岸、浮玉桥与城市日常", lat: 26.571358, lng: 106.719721 },
  qingyan: { name: "青岩古镇", detail: "石城街巷与古镇生活", lat: 26.3311, lng: 106.6868 },
  xiuwen: { name: "修文龙场", detail: "困境中的知与行", lat: 26.8389, lng: 106.594 },
  anshun: { name: "安顺老城", detail: "屯堡与黔中生活", lat: 26.2537, lng: 105.9476 },
  huangguoshu: { name: "黄果树", detail: "瀑布群与喀斯特河流", lat: 25.9907, lng: 105.6664 },
  zhijin: { name: "织金洞", detail: "地下喀斯特与地质时间", lat: 26.748, lng: 105.87 },
  bijie: { name: "毕节", detail: "乌蒙山地与城市生活", lat: 27.2985, lng: 105.305 },
  weining: { name: "威宁草海", detail: "高原湿地与湖畔生活", lat: 26.8562, lng: 104.2782 },
  liupanshui: { name: "六盘水", detail: "高原气候与工业城市", lat: 26.5927, lng: 104.8304 },
  xingyi: { name: "兴义万峰林", detail: "峰林田坝与布依村寨", lat: 25.0881, lng: 104.958 },
  libo: { name: "荔波", detail: "喀斯特森林与水系", lat: 25.411, lng: 107.8877 },
  duyun: { name: "都匀", detail: "剑江、毛尖与城市日常", lat: 26.2594, lng: 107.5187 },
  kaili: { name: "凯里", detail: "区域市场与酸食文化", lat: 26.5669, lng: 107.981 },
  xijiang: { name: "西江千户苗寨", detail: "苗寨聚落与当代生活", lat: 26.5025, lng: 108.1747 },
  zhenyuan: { name: "镇远古城", detail: "㵲阳河与山地城镇", lat: 27.0493, lng: 108.4297 },
  tongren: { name: "铜仁", detail: "锦江与黔东城市生活", lat: 27.7315, lng: 109.1896 },
  fanjingshan: { name: "梵净山", detail: "山地生态与自然保护", lat: 27.8959, lng: 108.6969 },
  zunyi: { name: "遵义老城", detail: "老城街巷与历史转折", lat: 27.7257, lng: 106.9272 },
  hailongtun: { name: "海龙屯", detail: "土司遗址与山地权力", lat: 27.8148, lng: 106.8227 },
  maotai: { name: "茅台镇", detail: "酿造产业与河谷城镇", lat: 27.8547, lng: 106.3717 },
  chishui: { name: "赤水河谷", detail: "丹霞、渡口与河谷生活", lat: 28.5906, lng: 105.6975 }
};

// 路线实景与感官线索用于原型表达，不冒充实时摄像头或客流监测。
// 实时天气、人流与声音只由服务端或现场数据覆盖；没有数据时不作具体断言。
const TOURIST_MOMENTS = {
  guiyang: {
    image: "assets/attractions/CTY-001.jpg",
    imageAlt: "贵阳城市街巷与公共生活",
    microLocation: "甲秀楼 · 南明河岸",
    monologue: "南明河把城里的路分到两岸。我沿河走了一段，腿有点沉，想先在桥边停一会儿。",
    prose: "南明河从城里穿过去，桥把两岸的路接在一起。甲秀楼留在河道之间，水路、桥梁和街道到了这里，忽然有了一个可以慢慢看的交点。\n\n我沿河走了一段，腿开始发沉，就不再催自己。先停一会儿，看看这座城怎样贴着河生长；贵阳的第一印象还不用急着定下来，我愿意把答案留给后面的路。",
    visual: "南明河穿城而过，桥梁把两岸街道接在一起。",
    audio: "真正抵达以前，先把声音留给那一刻。",
    worth: "顺着河道和桥梁看，贵阳的城市日常有了可以落脚的线索。",
    crowd: "人流以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "先在河边停一会儿",
    lingerDetail: "让腿脚松下来，再继续走",
    nextLabel: "沿着河与桥继续看",
    nextDetail: "不赶路，先认识城市的水路",
    discoveryLabel: "跟她从河道和桥认识贵阳",
    commerceAvailable: false
  },
  qingyan: {
    image: "assets/attractions/CTY-002.png",
    imageAlt: "青岩古镇石巷与河桥",
    microLocation: "青岩古镇 · 北门石巷",
    monologue: "石巷顺着山势往前，我走久了，脚底开始发酸，想先在转角停一会儿。",
    prose: "青岩的路很少一味平直。石巷顺着山势转折，城墙、坡道、屋檐和排水都挤在不大的尺度里，像是镇子在很早以前就学会了怎样安放日子。\n\n我沿着石板走了一阵，脚底有些发酸，便在转角慢下来。先别只顾着找热闹；看看路往哪里低，水从哪里走，古镇长久的生活也许就藏在这些不显眼的地方。",
    visual: "石巷顺着山势转折，屋檐、坡道与城墙彼此靠近。",
    audio: "脚步落在石板上；别的声音，等抵达时再听。",
    worth: "城墙、坡道、排水和居民生活，共同留下了一座山地古镇的尺度。",
    crowd: "人流以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "在石巷转角停一会儿",
    lingerDetail: "歇歇脚，也看看路怎样顺着山走",
    nextLabel: "沿城墙与坡道继续走",
    nextDetail: "慢一点，留意古镇的生活尺度",
    discoveryLabel: "跟她看看石巷怎样安放日子",
    commerceAvailable: false
  },
  xiuwen: {
    image: "assets/culture/PER-001.png",
    imageAlt: "修文龙场的山地与历史空间",
    microLocation: "修文龙场 · 石阶外",
    monologue: "山地的坡度一点点落到腿上。我有些喘，想先停下来，再往阳明洞旧址走。",
    prose: "到了龙场，先碰到人的不是一句“悟道”，而是山地的起伏。路往上收，腿脚就得跟着用力；我走了一阵，呼吸有些乱，索性先停下来。\n\n王阳明来到这里时，面对的也是一段陌生而具体的生活。后来写进思想史的变化，并不是悬在日子外面的结论。想到这里，我不再为自己的停顿着急：有些理解，本来就要等身体和生活一点点跟上。",
    visual: "修文龙场的山地与阳明洞旧址，把一段思想史放回具体空间。",
    audio: "这一刻先听自己的呼吸；现场的声音，等抵达时再补上。",
    worth: "这里值得停留，不只因为一个结论，而是能看见人在困境中如何重新理解行动。",
    crowd: "人流以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "先停下来，把呼吸放平",
    lingerDetail: "身体松一点，再读这段旧事",
    nextLabel: "往阳明洞旧址继续走",
    nextDetail: "把思想放回那段山地生活里看"
  },
  zunyi: {
    image: "assets/culture/RED-004.jpg",
    imageAlt: "遵义老城的历史建筑与街巷",
    microLocation: "遵义老城 · 红军街口",
    monologue: "会址就在老城街巷里。我背着包走了一段，肩膀有点酸，想先慢下来看看它和今天的城市怎样挨在一起。",
    prose: "遵义会议会址没有离开城市另造一座纪念碑，它仍在老城的街巷之间。1935 年那场发生在行军途中的会议，和今天仍有人经过的道路，隔着时间落在同一片空间里。\n\n我背着包走了一段，肩膀开始发酸，就先把脚步放慢。等身体松一点，再走进那段历史。也许只有先看清会址怎样留在老城里，才会明白“转折”并不是一个悬空的词。",
    visual: "遵义会议会址留在老城街巷之间，历史空间与今天的城市相邻。",
    audio: "现场声音要以抵达时为准。",
    worth: "把会址放回老城与当时的行军处境，历史转折才有具体的空间。",
    crowd: "现场通行情况以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "先在老城里慢一点",
    lingerDetail: "让肩膀松下来，再走进会址",
    nextLabel: "沿会址周围的街巷看看",
    nextDetail: "把历史重新放回城市空间",
    discoveryLabel: "跟她从老城走进 1935 年",
    commerceAvailable: false
  },
  hailongtun: {
    image: "assets/hailongtun-now-wide.jpg",
    imageAlt: "海龙屯山地遗址与林间石阶",
    microLocation: "海龙屯 · 飞虎关山路",
    monologue: "山势比照片里更费腿。我先在关隘前缓一缓，等呼吸平下来，再看旧墙和坡度怎样咬在一起。",
    prose: "照片能留下旧墙，却很难把山势的力气拍出来。真正沿坡度往上走，腿先明白关隘为什么设在这里；视野、石墙和道路，一层层顺着山收紧。\n\n我在关隘前停下来，一半是想把这些关系看清，一半是真的有点累。海龙屯不能只用眼睛读。先让呼吸慢下来，身体会把这座山城的防御讲得比概念更具体。",
    visual: "关隘、石墙、道路与坡度顺着山势层层展开。",
    audio: "脚步和呼吸属于这一段上坡；别的声音，等抵达时再听。",
    worth: "这里需要用身体理解：坡度、关隘和视野共同构成了山城的防御。",
    crowd: "通行情况以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "在关隘前缓一缓",
    lingerDetail: "等呼吸平下来，也看清山势",
    nextLabel: "继续走上层石阶",
    nextDetail: "量着体力走，不和坡度较劲",
    discoveryLabel: "跟她用腿脚读一座山城",
    commerceAvailable: false
  },
  chishui: {
    image: "assets/culture/ENV-005.jpg",
    imageAlt: "赤水河谷的河流与山地景观",
    microLocation: "赤水河谷 · 老渡口",
    monologue: "赤水河从丹霞山地之间穿过去。我沿着渡口的线索走了一段，有点累，想先停下来看看河把哪些日子带到了岸边。",
    prose: "赤水河从丹霞山地之间穿过去，亚热带森林和竹林沿着河谷铺开。渡口、盐运和酿造并不是三段分开的故事，它们都曾借这条水路移动，最后留进沿岸城镇的日常。\n\n我沿着河走了一段，腿有些累，就先停下来。眼前不必急着塞满故事；看清河流怎样贴着山地往前，已经能明白许多生活为什么会在这里聚起来。剩下的，我愿意再跟它多走一程。",
    visual: "赤水河穿过丹霞山地，亚热带森林与竹林沿河谷展开。",
    audio: "河谷真正的声音，等抵达时再听。",
    worth: "一条河把渡口、盐运、酿造和今天的城镇生活连在一起。",
    crowd: "岸边人流以抵达时所见为准",
    crowdLevel: "unknown",
    weatherFallback: "天气还在路上",
    lingerLabel: "在河边多停一会儿",
    lingerDetail: "歇歇腿，也把水路关系看清",
    nextLabel: "沿河继续往前",
    nextDetail: "沿渡口、盐运与酿造的关系慢慢看",
    discoveryLabel: "跟她顺着一条河认识沿岸生活",
    commerceAvailable: false
  },
  fanjingshan: {
    image: "assets/attractions/PEK-002.jpg",
    imageAlt: "梵净山的山峰与自然景观",
    microLocation: "梵净山 · 入山口",
    monologue: "岩峰和山路把视线带向高处。我先不催自己上山，想把体力、天气和保护边界都看清再走。",
    prose: "梵净山的岩峰把视线带向高处，山路却提醒人一步一步来。这里既有长期朝山留下的文化路径，也有需要克制进入的山地生态；走得慢，不只是为了省力。\n\n我先不催自己往高处赶。身体有多少力气，当天的天气允许走到哪里，都应该成为这一程的一部分。看一座山，不一定非要争到最高处；愿意在边界前停一下，也是在认真认识它。",
    visual: "岩峰、山路与自然保护地共同构成梵净山的进入方式。",
    audio: "山里的声音，要等天气与路线都确认以后再听。",
    worth: "山地生态的脆弱与壮阔同时存在，入园节奏本身也是理解保护的一部分。",
    crowd: "入园与人流以当天信息为准",
    crowdLevel: "unknown",
    weatherFallback: "山里天气仍待同步",
    lingerLabel: "先确认天气与路线",
    lingerDetail: "先看清当天边界，再决定走多远",
    nextLabel: "改走山脚观察线",
    nextDetail: "不赶高处，先沿山脚认识生态",
    discoveryLabel: "跟她看看一座山该怎样进入",
    commerceAvailable: false
  }
};

const TOURIST_STORY_LAYERS = {
  guiyang: {
    gallery: [
      ["assets/attractions/CTY-001.jpg", "贵阳城市街巷与公共生活", "眼前", "步道沿着南明河展开"],
      ["assets/attractions/CTY-003.jpg", "贵阳甲秀楼与南明河城市景观", "刚经过", "城市贴着河生长"],
      ["assets/culture/FOD-002.jpg", "贵州地方饮食与日常相聚", "沿途资料", "地方饮食也是城市日常的一部分"]
    ],
    history: {
      era: "明代以来",
      title: "南明河上的甲秀楼，为什么留在水路之间",
      summary: "沿着南明河走到甲秀楼，贵阳老城怎样借河道与桥梁展开，也就有了具体的样子。",
      image: "assets/attractions/CTY-003.jpg",
      imageAlt: "贵阳甲秀楼与南明河城市景观",
      imageNote: "历史建筑现状 · 不是古代复原图",
      kicker: "从河道与桥梁看贵阳",
      copy: "几百年前，这里先要解决的是怎样过河、怎样借水路通行与防护。后来城市沿河岸继续生长，道路越铺越开，甲秀楼仍留在河与桥相接的地方。"
    }
  },
  qingyan: {
    gallery: [
      ["assets/attractions/CTY-002.png", "青岩古镇石巷与河桥", "眼前", "石板路顺着山势转折"],
      ["assets/attractions/VIL-001.jpg", "贵州山地聚落与街巷", "拐角", "屋檐、坡道与街巷彼此靠近"],
      ["assets/culture/FOD-035.png", "贵州地方食物与手作", "沿途资料", "古镇物产还要逐项核对"]
    ],
    history: {
      era: "明代卫所时期",
      title: "这座古镇，一开始并不是为了游览而建",
      summary: "城墙顺着山势起伏，坡道与石巷留住了山地军事聚落逐渐长成生活城镇的过程。",
      image: "assets/attractions/CTY-002.png",
      imageAlt: "青岩古镇石巷与城镇景观",
      imageNote: "古镇现状 · 历史信息来自地方资料",
      kicker: "从屯堡防御到市井生活",
      copy: "走在青岩，脚下的路很少一味平直。城墙跟着山走，坡道和石巷把生活安放在高高低低的空间里。这里先为防御而建，后来才慢慢长出市场、宅院与日常。"
    }
  },
  xiuwen: {
    gallery: [
      ["assets/culture/PER-001.png", "修文龙场的山地与历史空间", "眼前", "山地与石阶彼此相接"],
      ["assets/culture/HIS-009.jpg", "修文阳明洞历史遗址", "刚经过", "洞口留下旧地名"],
      ["assets/culture/PER-012.jpg", "贵州山地人物与地方生活", "让我停下", "人怎样在困境里生活"]
    ],
    history: {
      era: "1508 年以后",
      title: "到了龙场，王阳明怎样重新理解知与行",
      summary: "这里的意义不只是一句“悟道”，还在一个人怎样面对陌生环境、设法生活，并在其中改变自己。",
      image: "assets/culture/HIS-009.jpg",
      imageAlt: "修文阳明洞历史遗址",
      imageNote: "遗址资料 · 具体叙事需结合来源阅读",
      kicker: "先把学问放回日子里",
      copy: "王阳明到龙场时，语言、环境与生存条件都很陌生。后来被概括为“龙场悟道”的思想变化，起初并不是一句悬空的结论，而是在一段具体又艰难的生活里慢慢发生。"
    }
  },
  zunyi: {
    gallery: [
      ["assets/culture/RED-004.jpg", "遵义老城的历史建筑与街巷", "眼前", "会址仍在老城街巷之间"],
      ["assets/culture/FOD-ZY-01.jpg", "遵义地方饮食与老城生活", "沿途资料", "地方食物也留着老城的日常"],
      ["assets/culture/RED-007.jpg", "遵义河谷城镇与历史空间", "回头看", "城市仍沿河铺开"]
    ],
    history: {
      era: "1935 年",
      title: "1935 年，这座老城里开了一次重要会议",
      summary: "遵义会议发生在行军途中。把会址放回当时紧迫的军事处境，才看得清它为何成为转折。",
      image: "assets/culture/RED-004.jpg",
      imageAlt: "遵义老城历史建筑",
      imageNote: "历史建筑现状 · 史实来自公开文博资料",
      kicker: "从老城走进 1935 年",
      copy: "会址今天仍在遵义老城里。1935 年，那场会议发生在紧迫的行军途中，讨论关系着接下来的路。沿街巷走到这座院落，“转折”便不再只是课本里的两个字。"
    }
  },
  hailongtun: {
    gallery: [
      ["assets/hailongtun-now-wide.jpg", "海龙屯山地遗址与林间石阶", "眼前", "石阶贴着山势向上"],
      ["assets/hailongtun-now-web.jpg", "海龙屯现存关隘与旧墙", "刚经过", "旧墙顺着山地展开"],
      ["assets/hailongtun-1599-web.jpg", "海龙屯历史空间复原示意", "脑海里", "关隘曾经层层设防"]
    ],
    history: {
      era: "1599 年以前",
      title: "站在残墙前，怎样读懂一座山城的防御",
      summary: "石墙、关隘、坡度和视野仍彼此咬合。把它们放在一起看，海龙屯当年的防御才有了形状。",
      image: "assets/hailongtun-1599-ai-reconstruction.png",
      imageAlt: "海龙屯山地关隘情境重构示意",
      imageNote: "情境重构示意 · 与现存遗址明确区分",
      kicker: "顺着石墙与山势往上看",
      copy: "四百多年前，这里有道路、关隘、居住空间与军事秩序，是一座真正运转着的山城。今天先看留下来的石墙怎样顺着坡度层层设防；复原图可以帮助想象，答案仍要回到遗址本身。"
    }
  },
  chishui: {
    gallery: [
      ["assets/culture/ENV-005.jpg", "赤水河谷的河流与山地景观", "眼前", "河道从丹霞山地之间穿过"],
      ["assets/culture/RED-007.jpg", "赤水河畔渡口与城镇空间", "刚经过", "旧渡口还连着城镇"],
      ["assets/attractions/WAT-002-longmen-waterfall.jpg", "赤水丹霞与瀑布景观", "想再去看", "瀑布从丹霞崖壁落下"]
    ],
    history: {
      era: "明清以来",
      title: "赤水河怎样把渡口、盐运和酿造连在一起",
      summary: "老渡口属于一整条水路。物产、人员与消息沿河移动，沿岸城镇也因此彼此相连。",
      image: "assets/culture/RED-007.jpg",
      imageAlt: "赤水河畔渡口与城镇空间",
      imageNote: "现状资料 · 历史脉络待结合地方志展开",
      kicker: "从老渡口看一整条水路",
      copy: "几百年前，赤水河不只是眼前的风景，也是物资、人员与消息移动的道路。渡口接住来往，盐运与酿造借河流展开；今天沿岸的城镇和地方味道，仍留着这套水路关系的痕迹。"
    }
  },
  fanjingshan: {
    gallery: [
      ["assets/attractions/PEK-002.jpg", "梵净山山峰与自然景观", "眼前", "山路沿坡面向上"],
      ["assets/attractions/PEK-003.jpg", "梵净山高山景观与步道", "抬头看", "岩峰把视线带向高处"],
      ["assets/culture/ENV-001.jpg", "贵州自然生态与山地环境", "让我慢下", "先确认山里的天气"]
    ],
    history: {
      era: "古代至今",
      title: "梵净山为什么既是保护地，也是一座文化名山",
      summary: "山地生态、寺庙活动与长期朝山传统，在不同年代里共同改变了人们进入这座山的方式。",
      image: "assets/attractions/PEK-003.jpg",
      imageAlt: "梵净山高山景观与步道",
      imageNote: "自然景观现状 · 历史叙事需分期阅读",
      kicker: "一条山路走到今天",
      copy: "过去有人沿山路而上，是为了朝山；后来又有人为生活、研究和旅行进入这里。今天控制入园节奏、尊重保护边界，也是人与这座山关系继续变化的一部分。"
    }
  }
};

// 历史足迹目前使用精修样机数据，之后可直接替换为旅程事件归档接口。
const HISTORY_FOOTPRINTS = [
  {
    id: "live",
    isLive: true,
    date: "此刻",
    time: "LIVE",
    location: "正在发生的旅程",
    route: "跟随阿镜",
    image: "assets/attractions/PEK-003.jpg"
  },
  {
    id: "zhijin-cave",
    date: "8月29日",
    time: "16:05",
    location: "织金洞 · 出口栈道",
    route: "迎宾厅 → 塔林洞 → 出口",
    layout: "cave-notebook",
    kicker: "阿镜在贵州 · 8月29日的足迹",
    title: "进一座洞，先别急着给岩石取名字。",
    thought: "照片很容易把洞厅压扁，也很容易让人只顾着找那些像动物、像宫殿的石头。织金洞是织金洞世界地质公园的核心地质点，真正值得看的，是地下水怎样在漫长时间里改变岩层。\n\n如果沿游线走进去，我想先留意人和岩体的比例。台阶多，就把脚步放慢一点；不追着看完每个名字，也许反而更接近这套仍在变化的地下系统。",
    condition: "洞穴步行线",
    energy: "台阶多，量着体力走",
    comfort: "带一件薄外套",
    next: "沿游线慢慢读岩层",
    gallery: [
      ["assets/attractions/DEP-001.jpg", "织金洞世界地质公园入口建筑", "抵达", "先从地质公园入口往里走"],
      ["assets/culture/ARC-001-strata.jpg", "喀斯特洞穴岩层参考资料", "知识库旁证", "水和岩层留下的慢时间"],
      ["assets/culture/ARC-001-entrance.jpg", "贵州喀斯特洞穴入口资料", "回到地面", "光从洞口慢慢铺进来"]
    ],
    history: {
      era: "三叠纪石灰岩",
      title: "一座洞穴，为什么能保存看不见的时间",
      summary: "洞厅、石笋、石柱与地下水遗迹共同组成织金洞，生长缓慢也意味着它对触摸和环境变化格外敏感。",
      image: "assets/culture/ARC-001-strata.jpg",
      imageAlt: "喀斯特洞穴岩层参考资料",
      imageNote: "知识库旁证图 · 不冒充织金洞洞内现场",
      kicker: "从一滴水读漫长地质史",
      copy: "地下水沿裂隙渗透，溶解、搬运又重新沉积。人走过只需几个小时，眼前的形态却经历了远超个体生命的时间。"
    },
    story: {
      register: "景点初见 · DEP-001",
      heading: "这不是一间很大的‘石头展厅’，而是一套仍在变化的地下系统。",
      friend: "如果你以后真的来，我会劝你少追那些像动物、像宫殿的名字。看人和岩体的比例、听水滴落下多久才有回声，会更接近这座洞真正厉害的地方。",
      facts: ["国家 5A 级景区", "UNESCO 世界地质公园", "完整步行约 2–3 小时"],
      fieldGuide: ["穿防滑鞋，洞内台阶多、湿度高", "留在游线内，不触摸石笋和钟乳石", "把强光收起来，让眼睛适应洞厅层次"],
      source: "知识库 DEP-001 · 文化和旅游部 / UNESCO"
    }
  },
  {
    id: "zunyi-morning",
    date: "8月29日",
    time: "09:18",
    location: "遵义 · 会址旁的清晨",
    route: "子尹路 → 会址 → 老城饮食",
    layout: "street-letter",
    kicker: "阿镜在贵州 · 8月29日的足迹",
    title: "会址仍在老城里，历史没有离开街巷。",
    thought: "我不想一进展厅就急着记结论。遵义会议发生在行军途中，会址是一栋临街小楼；把会议前后的路线一起摊开，才能看见 1935 年的人为什么必须在路上重新判断方向。\n\n所以这一页先从老城开始。看看会址怎样和今天的街道挨在一起，再走进会议室。身体走过的这点距离，会让“转折”不再只是书上的两个字。",
    condition: "老城历史线",
    energy: "给阅读多留一点时间",
    comfort: "先走街巷，再进展厅",
    next: "把会址放回行军路线里读",
    gallery: [
      ["assets/culture/RED-004.jpg", "遵义会议会址现状", "眼前", "会址仍和老城在同一条街上"],
      ["assets/culture/FOD-ZY-01.jpg", "遵义虾子羊肉粉", "地方饮食", "一碗粉也连着老城的生活"],
      ["assets/culture/RED-007.jpg", "遵义河谷城镇与历史路线", "把地图摊开", "历史不是停在一栋楼里"]
    ],
    history: {
      era: "1935 年 1 月",
      title: "一间会议室，要放回整段行军里读",
      summary: "会前处境、会议讨论与会后实践彼此相连，原物、复原陈设和后来的解释文本也需要分清。",
      image: "assets/culture/RED-004.jpg",
      imageAlt: "遵义会议会址现状",
      imageNote: "历史建筑现状 · 史实来自公开文博资料",
      kicker: "从老城街巷进入历史现场",
      copy: "今天安静的院落，在当时承接的是一场发生于危急行军中的讨论。走出展厅再看看周边街区，时间距离会重新变得具体。"
    },
    story: {
      register: "历史现场 · HIS-101",
      heading: "你先别急着记结论，试着把自己放回那段还不知道答案的行军里。",
      friend: "现在看会址，一切都像已经写好的历史。但 1935 年 1 月的人站在这里时，后面的路还没有答案。我更想陪你看的是：一群人在怎样的处境里，重新判断方向。",
      timeline: ["会前：长征初期的紧迫处境", "会中：讨论军事与领导问题", "会后：转折要靠之后的实践完成"],
      source: "知识库 HIS-101 · 贵州公开文化资料",
      recommendation: {
        kind: "visit",
        eyebrow: "留给以后到访",
        name: "一碗虾子羊肉粉",
        image: "assets/culture/FOD-ZY-01.jpg",
        copy: "以后真到遵义，可以留一顿饭给虾子羊肉粉。先从具体店家的配料和做法看起，再决定坐下来吃哪一碗。",
        meta: "知识库 FOD-ZY-01 · 到店体验",
        action: "夹进以后到访清单"
      }
    }
  },
  {
    id: "duyun-tea",
    date: "8月28日",
    time: "14:32",
    location: "都匀 · 螺蛳壳茶山",
    route: "都匀老城 → 茶园",
    layout: "tea-parcel",
    kicker: "阿镜在贵州 · 8月28日的足迹",
    title: "山坡上的茶垄，顺着地势一行行弯过去。",
    thought: "茶垄顺着坡度弯下去，一杯茶于是有了比香气更早的来处：山场、鲜叶、采摘时令，还有杀青、揉捻时手上的分寸。\n\n我更想沿着这条线认识都匀毛尖。先看茶怎样长、怎样做，再谈自己喜欢什么味道。以后真要选一罐，也从小份量开始；喜欢这件事，不必被“大礼包”替我们决定。",
    condition: "山场与制茶",
    energy: "沿坡度慢慢看",
    comfort: "先认识，再品饮",
    next: "从鲜叶走到制茶工序",
    gallery: [
      ["assets/culture/FOD-029.jpeg", "都匀毛尖茶园与采茶现场", "眼前", "茶垄顺着山坡弯过去"],
      ["assets/culture/FOD-029.jpeg", "都匀毛尖茶园资料的局部观察", "近看", "鲜叶标准连接采摘与制茶"],
      ["assets/culture/FOD-029.jpeg", "都匀毛尖山场与坡地资料", "回头看", "坡度与茶树共同塑造茶垄"]
    ],
    history: {
      era: "山场与手艺",
      title: "一杯茶，先从山场和鲜叶标准开始",
      summary: "茶树品种、海拔气候、采摘时令与制作共同形成风味，传统技艺也一直与现代标准和产业变化相遇。",
      image: "assets/culture/FOD-029.jpeg",
      imageAlt: "都匀毛尖茶园与采茶现场",
      imageNote: "知识库 FOD-029 · 茶园生产资料图",
      kicker: "从茶园进入地方生活",
      copy: "看一杯茶，不能只看冲泡后的形状。茶园生产、地方市场、待客饮茶与今天的年轻消费，共同构成都匀毛尖正在发生的现在。"
    },
    story: {
      register: "地方物产 · FOD-029",
      heading: "先从山场认识它，再决定要不要带一罐回家。",
      friend: "都匀毛尖不只是货架上的产品名。茶园、鲜叶标准和制茶工序都连在一杯茶里。真想尝的时候，先试一点，喜欢再说。",
      steps: ["山场：海拔、雾气与坡度", "鲜叶：采摘时令与标准", "制茶：杀青、揉捻与火候", "饮用：地方待客与当代生活"],
      source: "知识库 FOD-029 · 贵州茶文化资料",
      recommendation: {
        kind: "ship",
        eyebrow: "从路上寄给你 · 商品样机",
        name: "都匀毛尖 · 小罐试饮装",
        image: "assets/culture/FOD-029.jpeg",
        copy: "如果你平时喜欢清香、鲜爽一点的茶，这种小份量更适合第一次试。商品、产地和库存上线前都要再由商家核验。",
        meta: "示意价 ¥39 / 50g · 第三方平台发货",
        action: "想尝尝，看看怎么寄来"
      }
    }
  },
  {
    id: "guiyang-evening",
    date: "8月27日",
    time: "19:26",
    location: "贵阳 · 南明河入夜",
    route: "甲秀楼 → 青云市集",
    layout: "night-postcard",
    kicker: "阿镜在贵州 · 8月27日的足迹",
    title: "灯亮以后，南明河把甲秀楼留在水面上。",
    thought: "甲秀楼立在南明河中，浮玉桥把楼、亭和两岸接起来。到了夜里，灯光把建筑和水路的关系重新描了一遍；先看河，再看桥，最后才看见楼为什么会留在这里。\n\n我想沿河多看一段，不急着只拍一张正面。城市水岸真正耐看的地方，常常不是某个孤零零的地标，而是旧楼、道路和今天的日常怎样仍在一起。",
    condition: "南明河夜景",
    energy: "沿水岸慢慢走",
    comfort: "不赶着拍完就走",
    next: "顺着浮玉桥看两岸",
    gallery: [
      ["assets/attractions/CTY-003.jpg", "贵阳甲秀楼与南明河城市夜景", "眼前", "灯影落进南明河"],
      ["assets/attractions/CTY-001.jpg", "贵阳城市街巷与公共生活", "沿河看", "城市道路与水岸彼此相接"],
      ["assets/culture/FOD-002.jpg", "贵州地方饮食与日常相聚", "沿途资料", "地方饮食也属于城市的夜晚"]
    ],
    history: TOURIST_STORY_LAYERS.guiyang.history,
    story: {
      register: "城市地标 · CTY-003",
      heading: "它不是被围起来的一座古楼，而是贵阳人今天仍会经过的一段水岸。",
      friend: "甲秀楼建在南明河的鳌矶石上，浮玉桥把楼、亭和两岸连起来。你要是真的来，别只站在正面拍一张；沿河走一段，看旧楼、桥梁与今天的城市道路怎样留在同一片空间里。",
      sound: [],
      source: "知识库 CTY-003 · 贵州省公开文化资料",
      recommendation: {
        kind: "visit",
        eyebrow: "夜里想起你",
        name: "把丝娃娃留给到现场那天",
        image: "assets/culture/FOD-002.jpg",
        copy: "薄面皮要自己卷，十多种配菜和酸辣蘸水也得围着桌子吃。这个不寄，我先替你夹进贵阳清单。",
        meta: "知识库 FOD-GY-01 · 到店体验",
        action: "夹进贵阳到访清单"
      }
    }
  }
];

let TRAVEL_STOPS = [{ ...EXPLORATION_LOCATIONS.guiyang, id: "guiyang", state: "visited", direction: "left" }];

// 由 OSRM 按上述五个真实坐标计算的自驾道路几何，保存为静态快照以保证原型稳定。
const TRAVEL_DRIVING_ROUTE = [
  [26.574684, 106.716092], [26.618543, 106.687648], [26.676626, 106.71313],
  [26.699589, 106.713572], [26.718375, 106.694277], [26.747182, 106.687688],
  [26.811443, 106.707284], [26.862551, 106.7059], [26.870136, 106.657281],
  [26.862926, 106.639423], [26.845259, 106.634476], [26.841494, 106.603962],
  [26.873617, 106.623893], [26.893722, 106.667591], [26.927852, 106.692076],
  [26.995316, 106.689667], [27.007674, 106.702715], [27.03371, 106.698197],
  [27.05833, 106.712017], [27.120642, 106.699852], [27.153112, 106.727722],
  [27.180548, 106.722618], [27.192812, 106.739845], [27.226433, 106.741759],
  [27.244562, 106.759125], [27.27672, 106.763069], [27.295221, 106.777985],
  [27.371151, 106.76159], [27.425198, 106.771986], [27.487779, 106.798908],
  [27.588035, 106.865424], [27.641624, 106.883792], [27.687304, 106.923607],
  [27.696736, 106.917551], [27.690752, 106.915931], [27.688679, 106.926001],
  [27.705572, 106.935206], [27.781023, 106.928568], [27.832337, 106.907335],
  [27.834356, 106.890066], [27.805874, 106.855776], [27.815726, 106.822555],
  [27.809743, 106.854411], [27.777472, 106.86517], [27.755393, 106.857575],
  [27.742551, 106.86938], [27.735295, 106.825223], [27.71125, 106.801344],
  [27.762529, 106.722245], [27.78156, 106.670047], [27.800067, 106.55998],
  [27.881054, 106.458593], [27.885079, 106.425214], [27.845337, 106.42583],
  [27.806856, 106.401839], [27.823396, 106.362529], [27.854539, 106.371788]
];

const bookmarks = new Set([
  ...JSON.parse(localStorage.getItem("cloud_wayfarer-unified-bookmarks") || "[]"),
  ...JSON.parse(localStorage.getItem("cloud_wayfarer-culture-bookmarks") || "[]"),
  ...JSON.parse(localStorage.getItem("cloud_wayfarer-attractions-bookmarks") || "[]")
]);

const CHAPTERS = {
  scenery: {
    label: "山水景",
    title: "山水奇境",
    glyph: "山",
    description: "瀑布、峰林、峡谷、洞穴与高原生态"
  },
  history: {
    label: "历史遗迹",
    title: "历史遗迹",
    glyph: "史",
    description: "考古、制度、思想、古城与历史现场"
  },
  red: {
    label: "红色文化",
    title: "红色文化",
    glyph: "红",
    description: "遵义会议、四渡赤水与长征转折现场"
  },
  village: {
    label: "村寨",
    title: "村寨生活",
    glyph: "寨",
    description: "仍在生长的村落、社区与共同体"
  },
  heritage: {
    label: "非遗文化",
    title: "非遗与技艺",
    glyph: "艺",
    description: "歌、戏、节俗、手艺与木构营造"
  },
  food: {
    label: "美食茶酒",
    title: "美食·茶·酒",
    glyph: "味",
    description: "发酵、茶山、酒曲与贵州人的味觉"
  },
  industry: {
    label: "工业科技",
    title: "工业与科技",
    glyph: "工",
    description: "矿脉、工业遗址与面向宇宙的科学现场"
  },
  today: {
    label: "当代生活",
    title: "当代贵州",
    glyph: "今",
    description: "球场、街头与今天仍在发生的公共生活"
  }
};

const CITY_JOURNALS = [
  {
    id: "guiyang", name: "贵阳", short: "筑", latin: "GUIYANG", code: "01",
    subtitle: "城与山的日常", tagline: "沿南明河、老城与山地街巷，读一座正在发生的省城。",
    cover: "assets/attractions/CTY-003.jpg", coverPosition: "50% 52%", accent: "oklch(44% 0.075 151)",
    nodeIds: ["CTY-003", "CTY-001", "HIS-009", "CON-006", "ENV-001"]
  },
  {
    id: "zunyi", name: "遵义", short: "遵", latin: "ZUNYI", code: "02",
    subtitle: "河谷、转折与旧城", tagline: "从遵义老城走进山脊、河谷与酿造，在同一条路上读历史。",
    cover: "assets/hailongtun-now-wide.jpg", coverPosition: "50% 48%", accent: "oklch(42% 0.1 32)",
    nodeIds: ["HIS-101", "RED-004", "HIS-102", "HIS-005", "HIS-003", "HIS-011", "WAT-003", "ENV-005", "RED-007", "FOD-035"]
  },
  {
    id: "anshun", name: "安顺", short: "安", latin: "ANSHUN", code: "03",
    subtitle: "水穿过山，戏留在寨", tagline: "黄果树看水越崖，龙宫看水穿山，再走进屯堡的石巷与地戏。",
    cover: "assets/attractions/WAT-001.jpg", coverPosition: "50% 48%", accent: "oklch(50% 0.09 204)",
    nodeIds: ["WAT-001", "WAT-002", "HIS-103", "PER-012", "ENV-001"]
  },
  {
    id: "liupanshui", name: "六盘水", short: "凉", latin: "LIUPANSHUI", code: "04",
    subtitle: "高原风与季候", tagline: "从乌蒙草场到妥乐银杏，用海拔和季节读这座凉都。",
    cover: "assets/attractions/PEK-003.jpg", coverPosition: "50% 50%", accent: "oklch(49% 0.075 116)",
    nodeIds: ["PEK-003", "SEA-002", "ENV-001"]
  },
  {
    id: "bijie", name: "毕节", short: "毕", latin: "BIJIE", code: "05",
    subtitle: "花海、洞穴与深时", tagline: "从杜鹃花期走进织金洞和观音洞，让风景连接更深的时间。",
    cover: "assets/attractions/SEA-001.jpg", coverPosition: "50% 46%", accent: "oklch(48% 0.105 345)",
    nodeIds: ["SEA-001", "SEA-003", "DEP-001", "ARC-001", "ARC-005", "ENV-001"]
  },
  {
    id: "tongren", name: "铜仁", short: "铜", latin: "TONGREN", code: "06",
    subtitle: "梵天净土与矿脉", tagline: "山地生态、农事礼俗与朱砂矿脉，在铜仁叠成三种时间。",
    cover: "assets/attractions/HER-002.jpg", coverPosition: "50% 48%", accent: "oklch(45% 0.085 161)",
    nodeIds: ["HER-002", "FES-016", "DEP-003", "IND-002", "ENV-001"]
  },
  {
    id: "qiandongnan", name: "黔东南", short: "黔东", latin: "QIANDONGNAN", code: "07",
    subtitle: "村寨、歌声与手艺", tagline: "沿清水江与村寨走，听歌、看木构、识针线，也看今天的球场。",
    cover: "assets/attractions/VIL-001.jpg", coverPosition: "50% 48%", accent: "oklch(45% 0.085 67)",
    nodeIds: ["HER-003", "VIL-001", "VIL-002", "VIL-003", "CTY-002", "ORA-007", "PER-001", "CRA-001", "CRA-009", "FOD-002", "CON-001"]
  },
  {
    id: "qiannan", name: "黔南", short: "黔南", latin: "QIANNAN", code: "08",
    subtitle: "碧水、文字与茶山", tagline: "荔波的水、水族的文字与马尾绣、都匀的茶，共同写成黔南。",
    cover: "assets/attractions/HER-001.jpg", coverPosition: "50% 50%", accent: "oklch(48% 0.09 184)",
    nodeIds: ["HER-001", "DEP-002", "ORA-003", "CRA-006", "FOD-029", "ENV-001"]
  },
  {
    id: "qianxinan", name: "黔西南", short: "黔西", latin: "QIANXINAN", code: "09",
    subtitle: "峰林里的田野", tagline: "在万峰林与马岭河之间，读峰丛、河谷、村庄和行走的尺度。",
    cover: "assets/culture/ENV-001.jpg", coverPosition: "50% 50%", accent: "oklch(49% 0.09 105)",
    nodeIds: ["PEK-001", "PEK-002", "ENV-001"]
  }
];

const cityJournalById = new Map(CITY_JOURNALS.map((city) => [city.id, city]));
if (!cityJournalById.has(selectedCityId)) selectedCityId = "guiyang";

const EDITION_COPY = {
  brandSubtitle: "GUIZHOU JOURNEY & CULTURE GUIDE",
  coverVolume: "贵州城市文化旅行指南 · 第一册",
  coverCode: "001",
  coverKicker: "GUIZHOU · PLACES AND LIVING CULTURE",
  coverTitle: "黔境",
  coverEdition: "贵州城市文化旅行指南",
  coverQuote: "从一处山水出发，\n翻进它生长的时间与生活。",
  coverTopics: "地方 · 人群 · 时间 · 生活",
  coverImage: "assets/cloud-wayfarer-attractions-cover-v2.png",
  coverImageAlt: "喀斯特峰林、瀑布、碧水、梯田与村寨屋脊组成的贵州城市指南封面插画",
  plateRegister: "贵州图版 · FIELD NOTE",
  fieldGuideTitle: "到现场，可以重点看这三件事",
  threadsKicker: "接下来可以看",
  threadsTitle: "继续阅读相关地点和文化",
  directoryLabel: "贵州目录",
  coverageHtml: "贵州城市指南 · 收录 <span id=\"bound-count\">48</span> 篇 · 八个主题",
  stageLabel: "贵州城市文化旅行指南"
};

const PAGE_LAYOUT_COPY = {
  "landscape-atlas": {
    plate: "地貌图页 · FIELD ATLAS",
    visual: "地貌切片 · LANDSCAPE NOTE",
    continue: "顺着地貌，往下读这一页",
    fieldLabel: "到了现场，别急着只找机位",
    fieldTitle: "让脚下的路告诉你这里怎样形成"
  },
  "city-postcard": {
    plate: "城市明信片 · CITY POSTCARD",
    visual: "街巷观察 · STREET NOTE",
    continue: "继续看这座城",
    fieldLabel: "到现场，可以这样走",
    fieldTitle: "除了地标，也看看当地人的生活"
  },
  "route-chronicle": {
    plate: "路线档案 · ROUTE LEDGER",
    visual: "途中坐标 · ROUTE NOTE",
    continue: "沿时间和地点继续往前走",
    fieldLabel: "读路线时，别把几次行动压成一次",
    fieldTitle: "让时间、地形与人的选择重新连起来"
  },
  "portrait-essay": {
    plate: "人物侧记 · PORTRAIT NOTE",
    visual: "人物与地方 · MARGIN PORTRAIT",
    continue: "先看他身处哪里，再读他想明白什么",
    fieldLabel: "理解一个人，不只记住一句名言",
    fieldTitle: "把处境、交往和后来的影响放在一起"
  },
  "living-rhythm": {
    plate: "生活现场 · LIVING NOTE",
    visual: "正在发生 · FIELD RHYTHM",
    continue: "顺着声音、手势和日常继续读",
    fieldLabel: "这不是摆在橱窗里的文化",
    fieldTitle: "先看谁在做、为何做、今天怎样继续"
  },
  "archive-dossier": {
    plate: "资料图版 · ARCHIVE FILE",
    visual: "材料切片 · DOCUMENT NOTE",
    continue: "从材料出发，辨认这段历史",
    fieldLabel: "先分清证据、解释和后来的讲述",
    fieldTitle: "把遗址、器物与文字互相对照"
  },
  "archaeology-evidence": {
    plate: "考古现场 · ARCHAEOLOGY FILE",
    visual: "考古切片 · FIELD EVIDENCE",
    continue: "从一件石器读回更深的时间",
    fieldLabel: "到现场时，不妨留意",
    fieldTitle: "把文化重新放回生活里看"
  },
  "karst-waterbook": {
    plate: "水路手记 · KARST WATERBOOK",
    visual: "水路切片 · WATER FIELD NOTE",
    continue: "跟着一滴水，继续往山腹里读",
    fieldLabel: "到现场时，先看水留下的证据",
    fieldTitle: "把灯光背后的岩层、裂隙与水位找回来"
  }
};

const STORY_SECTION_LABELS = {
  "landscape-atlas": ["先看地貌", "再看路径", "最后看人"],
  "city-postcard": ["抵达", "街巷", "此刻"],
  "route-chronicle": ["第一段", "第二段", "第三段"],
  "portrait-essay": ["处境", "转折", "余波"],
  "living-rhythm": ["怎么发生", "谁在传", "今天怎样"],
  "archive-dossier": ["材料一", "材料二", "材料三"]
};

const GROUP_PLATE_POSITIONS = {
  scenery: "48% 52%",
  environment: "48% 52%",
  history: "18% 48%",
  red: "78% 46%",
  sound: "12% 58%",
  craft: "92% 68%",
  village: "12% 58%",
  memory: "12% 58%",
  heritage: "92% 68%",
  food: "30% 84%",
  industry: "72% 36%",
  today: "82% 56%"
};

const NODE_PLATE_ASSETS = {
  "ENV-001": { src: "assets/culture/ENV-001.jpg", position: "50% 50%", kind: "航拍实景", sourceName: "新华社 · 万峰林", sourceUrl: "https://www.news.cn/photo/2023-05/28/c_1129651862_9.htm" },
  "ENV-005": { src: "assets/culture/ENV-005.jpg", position: "52% 50%", kind: "流域实景", sourceName: "凤凰网贵州资料图" },
  "ARC-001": { src: "assets/culture/ARC-001.png", position: "50% 46%", kind: "考古现场", sourceName: "贵州广播电视台", sourceUrl: "https://www.gzstv.com/a/64c15569d0d2495cbe8a8a2999721e61" },
  "ARC-005": { src: "assets/culture/ARC-005.jpg", position: "50% 45%", kind: "馆藏文物", sourceName: "贵州省博物馆藏 · Wikimedia Commons 图像", sourceUrl: "https://commons.wikimedia.org/wiki/File:%E8%B4%B5%E5%B7%9E%E6%AF%95%E8%8A%82%E8%B5%AB%E7%AB%A0%E5%8F%AF%E4%B9%90264%E5%8F%B7%E5%A2%93-%E6%95%9E%E5%8F%A3%E5%A4%A7%E5%8F%8C%E8%80%B3%E9%87%9C-%E6%88%98%E5%9B%BD-%E8%B4%B5%E5%B7%9E%E7%9C%81%E5%8D%9A%E7%89%A9%E9%A6%86.jpg" },
  "HIS-003": { src: "assets/hailongtun-now.jpg", position: "50% 42%", kind: "土司遗址实景", sourceName: "项目现场采集 · 海龙屯" },
  "HIS-005": { src: "assets/hailongtun-now-wide.jpg", position: "52% 50%", kind: "遗址实景", sourceName: "项目现场采集 · 海龙屯" },
  "HIS-009": { src: "assets/culture/HIS-009.jpg", position: "50% 48%", kind: "历史现场", sourceName: "贵州广播电视台 · 阳明洞", sourceUrl: "https://movement.gzstv.com/news/detail/Pg3gb/" },
  "HIS-011": { src: "assets/culture/HIS-011.jpg", position: "50% 48%", kind: "故居实景", sourceName: "新华社 · 李树昌故居", sourceUrl: "https://jp.news.cn/20230609/2f572edd273145b48b78dd1f14f4e282/c.html" },
  "RED-004": { src: "assets/culture/RED-004.jpg", position: "50% 52%", kind: "会址实景", sourceName: "凤凰网资料图 · 遵义会议会址", sourceUrl: "https://news.ifeng.com/c/83jJdcaxTHz" },
  "RED-007": { src: "assets/culture/RED-007.jpg", position: "50% 52%", kind: "历史地点实景", sourceName: "人民网 · 土城渡口", sourceUrl: "https://gz.people.com.cn/BIG5/n2/2026/0629/c194849-41624076.html" },
  "ORA-003": { src: "assets/culture/ORA-003.jpg", position: "50% 48%", kind: "文献资料", sourceName: "水书手抄本资料图" },
  "ORA-007": { src: "assets/culture/ORA-007.jpg", position: "50% 44%", kind: "档案文书", sourceName: "清水江文书资料图", sourceUrl: "https://www.sohu.com/a/301930839_488491" },
  "PER-001": { src: "assets/culture/PER-001.png", position: "50% 43%", kind: "演唱现场", sourceName: "贵州广播电视台", sourceUrl: "https://tianzhu.gzstv.com/news/detail/zeZvL/" },
  "PER-012": { src: "assets/culture/PER-012.jpg", position: "50% 45%", kind: "演出现场", sourceName: "贵州广播电视台 · 安顺地戏", sourceUrl: "https://movement.gzstv.com/news/detail/5EG97/" },
  "FES-016": { src: "assets/culture/FES-016.jpg", position: "50% 46%", kind: "仪式现场", sourceName: "中国网信网 · 石阡说春", sourceUrl: "https://www.cac.gov.cn/2018-02/20/c_1122429898.htm" },
  "CRA-001": { src: "assets/culture/CRA-001.jpg", position: "50% 42%", kind: "技艺现场", sourceName: "新华社 · 苗绣" },
  "CRA-006": { src: "assets/culture/CRA-006.jpg", position: "50% 46%", kind: "技艺现场", sourceName: "贵州省人大 · 马尾绣", sourceUrl: "https://www.gzrd.gov.cn/gzwh/201912/t20191225_77670045.html" },
  "CRA-009": { src: "assets/culture/CRA-009.png", position: "50% 43%", kind: "建筑实景", sourceName: "贵州广播电视台 · 肇兴侗寨", sourceUrl: "https://www.gzstv.com/a/55fa9425304a4e35b7e0bbcab557aaf1" },
  "FOD-002": { src: "assets/culture/FOD-002.jpg", position: "50% 48%", kind: "饮食现场", sourceName: "新华社 · 贵州酸汤", sourceUrl: "https://www.news.cn/local/2023-12/08/c_1130015780.htm" },
  "FOD-029": { src: "assets/culture/FOD-029.jpeg", position: "50% 50%", kind: "茶叶实物", sourceName: "都匀毛尖资料图", sourceUrl: "https://www.sohu.com/a/593951328_223853" },
  "FOD-035": { src: "assets/culture/FOD-035.png", position: "50% 48%", kind: "酿制工艺现场", sourceName: "新华网 · 下沙工艺", sourceUrl: "http://www.gz.news.cn/20241011/cf50417be9cf44fab175f37d5ebf7cd2/c.html" },
  "FOD-ZY-01": { src: "assets/culture/FOD-ZY-01.jpg", position: "50% 55%", kind: "地方小吃实拍", sourceName: "遵义羊肉粉实拍资料图", sourceUrl: "https://www.xiangmu.com/xm/msyrfen/" },
  "CAT-ZY-008": { src: "assets/culture/CAT-ZY-008.jpg", position: "50% 48%", kind: "茶园航拍实景", sourceName: "人民网贵州 · 湄潭万亩茶海", sourceUrl: "https://gz.people.com.cn/n2/2024/0407/c222152-40801758.html" },
  "CAT-ZY-010": { src: "assets/culture/CAT-ZY-010.jpg", position: "50% 50%", kind: "饮食礼俗现场", sourceName: "贵州广播电视台 · 仡佬族三幺台", sourceUrl: "https://www.gzstv.com/a/51b716cea0414af99f80f3a1bab6fded" },
  "CAT-ZY-011": { src: "assets/culture/CAT-ZY-011.jpg", position: "50% 50%", kind: "地方小吃实拍", sourceName: "遵义豆花面资料图", sourceUrl: "https://www.sohu.com/a/273389233_570633" },
  "IHC-ZY-006": { src: "assets/culture/IHC-ZY-006.jpg", position: "50% 45%", kind: "饮酒礼俗现场", sourceName: "咂酒饮用习俗资料图", sourceUrl: "https://www.sohu.com/a/706929235_121431671" },
  "IHC-ZY-007": { src: "assets/culture/IHC-ZY-007.jpg", position: "50% 48%", kind: "酿制工艺现场", sourceName: "国际在线 · 酱香酒下沙展示", sourceUrl: "https://news.cri.cn/2025-10-29/e5d2c841-ad37-d14c-2b96-994197167d1d.html" },
  "IHC-ZY-008": { src: "assets/culture/IHC-ZY-008.jpg", position: "50% 46%", kind: "传统酒坊实景", sourceName: "酱香型白酒传统酒坊资料图", sourceUrl: "https://www.khan.co.kr/article/201605132134001" },
  "IHC-ZY-009": { src: "assets/culture/IHC-ZY-009.jpg", position: "50% 42%", kind: "豆腐皮制作现场", sourceName: "贵州省民政厅 · 豆油皮制作", sourceUrl: "https://mzt.guizhou.gov.cn/ztzl/rdzt/gzdmgs/202512/t20251211_89036135.html" },
  "IHC-ZY-010": { src: "assets/culture/IHC-ZY-010.jpg", position: "50% 48%", kind: "泉水豆花实拍", sourceName: "泉水豆花餐饮资料图", sourceUrl: "https://touch.travel.qunar.com/comment/10141787925" },
  "IHC-ZY-011": { src: "assets/culture/IHC-ZY-011.jpg", position: "50% 45%", kind: "油茶传承现场", sourceName: "中国日报 · 油茶传承资料图", sourceUrl: "https://china.chinadaily.com.cn/a/202309/06/WS64f87d02a310936092f209fc.html" },
  "IHC-ZY-012": { src: "assets/culture/IHC-ZY-012.jpg", position: "50% 50%", kind: "传统糕点实拍", sourceName: "老谢氏鸡蛋糕资料图", sourceUrl: "https://www.tesegu.com/techan/50614.html" },
  "IND-002": { src: "assets/culture/IND-002.png", position: "50% 50%", kind: "矿区实景", sourceName: "新华网 · 万山汞矿遗址", sourceUrl: "http://www.gz.news.cn/20240114/2cf25996a355488a886c500225aed074/c.html" },
  "CON-001": { src: "assets/culture/CON-001.jpg", position: "50% 46%", kind: "群众文化现场", sourceName: "新华社 · 村超", sourceUrl: "https://english.news.cn/20230611/36f0d9b8d1684163a7ee3d246eeb59d2/c.html" },
  "CON-006": { src: "assets/culture/CON-006.jpg", position: "50% 45%", kind: "城市生活现场", sourceName: "人民网 · 贵阳路边音乐会", sourceUrl: "https://en.people.cn/n3/2025/0527/c90000-20320340.html" },
  "WAT-001": { src: "assets/attractions/WAT-001.jpg", position: "50% 50%", kind: "瀑布实景", sourceName: "客路 Klook · 黄果树瀑布", sourceUrl: "https://www.klook.com/en-US/activity/153780-guizhou-guiyang-huangguoshu-xiaoqikong-xijiang-qianhu-miao-village/" },
  "WAT-002": { src: "assets/attractions/WAT-002.jpg", position: "50% 55%", kind: "景区实景", sourceName: "携程攻略 · 龙宫景区", sourceUrl: "https://you.ctrip.com/sight/anshun518/17678.html" },
  "WAT-003": { src: "assets/attractions/WAT-003.jpg", position: "50% 50%", kind: "丹霞实景", sourceName: "中国驻大阪旅游代表处 · 赤水丹霞", sourceUrl: "https://www.cnta-osaka.jp/8742.html" },
  "HER-001": { src: "assets/attractions/HER-001.jpg", position: "50% 54%", kind: "航拍实景", sourceName: "新华社 · 荔波小七孔", sourceUrl: "https://www.xinhuanet.com/photo/2021-04/16/c_1127338098.htm" },
  "HER-002": { src: "assets/attractions/HER-002.jpg", position: "50% 50%", kind: "晨景实拍", sourceName: "新华社 · 梵净山", sourceUrl: "https://www.news.cn/photo/2022-08/13/c_1128912718.htm" },
  "HER-003": { src: "assets/attractions/HER-003.jpg", position: "50% 50%", kind: "航拍实景", sourceName: "新华社 · 施秉云台山", sourceUrl: "https://www.xinhuanet.com/culture/20220809/8b4a290b4fea43229de49ae7f0d98008/c.html" },
  "HIS-101": { src: "assets/culture/RED-004.jpg", position: "52% 56%", kind: "会址实景", sourceName: "凤凰网资料图 · 遵义会议会址", sourceUrl: "https://news.ifeng.com/c/83jJdcaxTHz" },
  "HIS-102": { src: "assets/hailongtun-now-wide.jpg", position: "52% 50%", kind: "遗址实景", sourceName: "项目现场采集 · 海龙屯" },
  "HIS-103": { src: "assets/culture/PER-012.jpg", position: "50% 48%", kind: "演出现场", sourceName: "贵州广播电视台 · 安顺地戏", sourceUrl: "https://movement.gzstv.com/news/detail/5EG97/" },
  "VIL-001": { src: "assets/attractions/VIL-001.jpg", position: "50% 52%", kind: "村寨实景", sourceName: "携程攻略 · 西江千户苗寨", sourceUrl: "https://you.ctrip.com/sight/leishan2345/134057.html" },
  "VIL-002": { src: "assets/culture/CRA-009.png", position: "50% 52%", kind: "村寨实景", sourceName: "贵州广播电视台 · 肇兴侗寨", sourceUrl: "https://www.gzstv.com/a/55fa9425304a4e35b7e0bbcab557aaf1" },
  "VIL-003": { src: "assets/attractions/VIL-003.jpg", position: "50% 52%", kind: "梯田实景", sourceName: "去哪儿攻略 · 加榜梯田游客图", sourceUrl: "https://touch.travel.qunar.com/comment/10157917946" },
  "CTY-001": { src: "assets/attractions/CTY-001.jpg", position: "50% 54%", kind: "古镇实景", sourceName: "携程攻略 · 青岩古镇", sourceUrl: "https://you.ctrip.com/sight/guiyang33/20403.html" },
  "CTY-002": { src: "assets/attractions/CTY-002.png", position: "50% 50%", kind: "古城实景", sourceName: "文化和旅游部 · 镇远古城", sourceUrl: "https://zhuanti.mct.gov.cn/xcss2024_xcygj/guizhou/detail/7184.html" },
  "CTY-003": { src: "assets/attractions/CTY-003.jpg", position: "50% 48%", kind: "城市地标实景", sourceName: "携程攻略 · 甲秀楼", sourceUrl: "https://you.ctrip.com/sight/guiyang33/18081.html" },
  "SEA-001": { src: "assets/attractions/SEA-001.jpg", position: "50% 50%", kind: "花期航拍", sourceName: "新华社 · 百里杜鹃", sourceUrl: "https://www.news.cn/photo/2023-03/28/c_1129473133.htm" },
  "SEA-002": { src: "assets/attractions/SEA-002.jpg", position: "50% 50%", kind: "秋季村景", sourceName: "文化和旅游部 · 妥乐村", sourceUrl: "https://zhuanti.mct.gov.cn/csxz2022/guizhou/detail_g7yU_727/4425.html" },
  "SEA-003": { src: "assets/attractions/SEA-003.jpg", position: "50% 50%", kind: "保护区实景", sourceName: "国家林业和草原局 · 威宁草海", sourceUrl: "https://www.forestry.gov.cn/c/www/zrzrbhq/611909.jhtml" },
  "DEP-001": { src: "assets/attractions/DEP-001.jpg", position: "50% 52%", kind: "地质公园实景", sourceName: "织金洞世界地质公园官网", sourceUrl: "https://www.zjdgeopark.com/cn/document/52.html" },
  "DEP-002": { src: "assets/attractions/DEP-002.png", position: "50% 50%", kind: "科学地标航拍", sourceName: "新华社 · 中国天眼", sourceUrl: "https://www.news.cn/photo/20250415/03894374060f43cf8548eb738106da93/c.html" },
  "DEP-003": { src: "assets/culture/IND-002.png", position: "50% 52%", kind: "工业遗址实景", sourceName: "新华网 · 万山汞矿遗址", sourceUrl: "http://www.gz.news.cn/20240114/2cf25996a355488a886c500225aed074/c.html" },
  "PEK-001": { src: "assets/culture/ENV-001.jpg", position: "50% 50%", kind: "峰林航拍", sourceName: "新华社 · 万峰林", sourceUrl: "https://www.news.cn/photo/2023-05/28/c_1129651862_9.htm" },
  "PEK-002": { src: "assets/attractions/PEK-002.jpg", position: "50% 50%", kind: "峡谷实景", sourceName: "贵州国际传播平台 · 马岭河峡谷", sourceUrl: "https://www.eguizhou.gov.cn/guiyang/2020-06/25/c_730324.htm" },
  "PEK-003": { src: "assets/attractions/PEK-003.jpg", position: "50% 50%", kind: "高原草场实景", sourceName: "文化和旅游部 · 乌蒙大草原", sourceUrl: "https://zhuanti.mct.gov.cn/csxz2022/guizhou/detail_g7yU_727/4425.html" }
};

// 目录条目尚未完成专属图片核验时，仍只使用已经落盘并登记来源的真实照片。
// 这些图片是同主题场景参考，不冒充该条目的独立现场证据。
const GROUP_REAL_PLATE_FALLBACKS = {
  scenery: [
    "ENV-001", "ENV-005", "WAT-001", "WAT-002", "WAT-003", "HER-001", "HER-002", "HER-003",
    "SEA-001", "SEA-002", "SEA-003", "DEP-001", "PEK-002", "PEK-003", "VIL-003"
  ],
  history: [
    "ARC-001", "ARC-005", "HIS-003", "HIS-005", "HIS-009", "HIS-011",
    "CTY-001", "CTY-002", "CTY-003", "DEP-002", "ORA-003", "ORA-007"
  ],
  red: ["RED-004", "RED-007", "HIS-101", "HIS-102", "HIS-003", "HIS-005", "HIS-011", "CTY-001"],
  village: [
    "VIL-001", "VIL-002", "VIL-003", "CRA-009", "CTY-002",
    "CTY-001", "HIS-003", "HIS-005", "HIS-011", "ENV-001"
  ],
  heritage: [
    "PER-001", "PER-012", "FES-016", "CRA-001", "CRA-006", "CRA-009",
    "ORA-003", "ORA-007", "CAT-ZY-010", "IHC-ZY-006", "ARC-001", "ARC-005",
    "HIS-009", "HIS-011", "RED-004", "CTY-001", "CTY-002", "VIL-001", "VIL-002", "VIL-003"
  ],
  food: [
    "FOD-002", "FOD-029", "FOD-035", "FOD-ZY-01", "CAT-ZY-008", "CAT-ZY-010", "CAT-ZY-011",
    "IHC-ZY-006", "IHC-ZY-007", "IHC-ZY-008", "IHC-ZY-009", "IHC-ZY-010", "IHC-ZY-011", "IHC-ZY-012"
  ],
  industry: ["IND-002", "DEP-002", "ARC-001", "ARC-005"],
  today: ["CON-001", "CON-006", "CTY-003", "VIL-001"]
};

const ATTRACTION_CULTURE_LINKS = {
  "WAT-001": { target: "ENV-001", reason: "从瀑布水势读回贵州喀斯特的地表与地下水系" },
  "WAT-002": { target: "ENV-001", reason: "从暗河与洞厅读回贵州喀斯特怎样被水塑形" },
  "WAT-003": { target: "ENV-005", reason: "丹霞瀑布最终汇入赤水河的流域故事" },
  "HER-001": { target: "ENV-001", reason: "碧水、峰丛与水上森林背后是一整套喀斯特系统" },
  "HER-002": { target: "ENV-001", reason: "从孤立山体与森林看贵州山地生态的垂直差异" },
  "HER-003": { target: "ENV-001", reason: "白云岩峰丛提供另一种贵州喀斯特样本" },
  "HIS-101": { target: "RED-004", reason: "离开会址建筑，继续读1935年的会议与转折" },
  "HIS-102": { target: "HIS-005", reason: "从山脊遗址翻入播州土司城的制度与生活" },
  "HIS-103": { target: "PER-012", reason: "屯堡村落今天仍通过地戏、面具与演期保存共同记忆" },
  "VIL-001": { target: "CRA-001", reason: "从苗寨全景走近针线、服饰与女性传承" },
  "VIL-002": { target: "PER-001", reason: "鼓楼空间真正响起来时，下一页就是侗族大歌" },
  "VIL-003": { target: "ENV-001", reason: "梯田是山地水系、稻作与村寨共同工作的结果" },
  "CTY-001": { target: "PER-012", reason: "从石城与商路继续读安顺地区的屯堡文化" },
  "CTY-002": { target: "ORA-007", reason: "顺着黔东南河运与木材贸易，翻到清水江文书" },
  "CTY-003": { target: "CON-006", reason: "从南明河地标走进今天贵阳人的公共生活" },
  "SEA-001": { target: "ENV-001", reason: "花期背后是海拔、气候与山地生态共同决定的旅行时钟" },
  "SEA-002": { target: "ENV-001", reason: "古树、村屋与田埂要放回持续生活的山地环境里看" },
  "SEA-003": { target: "ENV-001", reason: "从高原湿地与候鸟继续理解贵州的生态边界" },
  "DEP-001": { target: "ENV-001", reason: "洞厅尺度来自水与可溶岩层共同书写的深时过程" },
  "DEP-002": { target: "IND-002", reason: "从面向宇宙的科学装置，对读贵州另一种工业技术现场" },
  "DEP-003": { target: "IND-002", reason: "从旅游小镇走回朱砂采冶、矿工社区与资源转型" },
  "PEK-001": { target: "ENV-001", reason: "峰林、田野、河流与村庄共同组成山地生活尺度" },
  "PEK-002": { target: "ENV-001", reason: "峡谷向下切开的深度，是贵州立体地貌的另一面" },
  "PEK-003": { target: "ENV-001", reason: "高海拔草场把贵州山地的气候与生计翻到另一页" }
};

const FALLBACK_NODES = [
  {
    id: "ENV-001", name: "贵州喀斯特", domain: "山地环境与生计", status: "A",
    summary: "石灰岩、地下水和漫长地质过程塑造了峰丛、洞穴、峡谷，也持续影响贵州人的聚落、道路和生计。",
    canvas: { x: -1120, y: -640, scene: "云雾中的峰丛与洞穴水系", entryObject: "滴水的岩洞" },
    listen: "先听水从岩缝滴落，再听见远处村寨与集市。", see: ["峰丛", "溶洞", "石灰岩", "天坑"],
    relations: [{ target: "ARC-001", reason: "洞穴保存了史前人类活动" }]
  },
  {
    id: "ARC-001", name: "黔西观音洞", domain: "史前、深时与考古", status: "A",
    summary: "观音洞保存了中国南方旧石器时代早期的重要文化遗存。",
    canvas: { x: -1540, y: 120, scene: "洞口火光、石器和古动物剪影", entryObject: "一件打制石器" },
    listen: "石器敲击声在洞穴中回响。", see: ["洞穴", "石器", "化石"],
    relations: [{ target: "ENV-001", reason: "洞穴与喀斯特环境彼此相连" }]
  },
  {
    id: "HIS-005", name: "海龙屯", domain: "历史制度、迁徙与思想", status: "A",
    summary: "依山构筑的军事与宫殿遗址，保存了播州杨氏土司和土司制度变迁的物证。",
    canvas: { x: 1120, y: -1120, scene: "山脊城墙、九道关隘与被森林收回的宫殿", entryObject: "覆苔的墙基" },
    listen: "脚步沿石阶上行，风穿过关隘，声音逐渐转入 1600 年的战火。", see: ["遗址", "城墙", "关隘"], relations: []
  },
  {
    id: "RED-004", name: "遵义会议", domain: "红色文化", status: "A",
    summary: "1935 年召开的遵义会议，是中国共产党历史上具有重大转折意义的会议。",
    canvas: { x: 520, y: 160, scene: "冬夜会址、长桌、地图、油灯与街巷", entryObject: "桌上的红蓝铅笔" },
    listen: "室内低声讨论与室外冬夜脚步形成对比。", see: ["会址", "长桌", "地图", "油灯"], relations: []
  },
  {
    id: "PER-001", name: "侗族大歌", domain: "音乐、舞蹈与戏剧", status: "A",
    summary: "侗族大歌是无指挥、无伴奏的多声部民歌传统，歌班、鼓楼和社区共同维持它的传承。",
    canvas: { x: -1180, y: 1180, scene: "鼓楼火塘周围逐层出现的歌班", entryObject: "领唱者的一次吸气" },
    listen: "先出现一个高声部，随后低声部从四周汇入。", see: ["鼓楼", "歌班", "黎平", "从江"], relations: []
  },
  {
    id: "CRA-001", name: "苗绣", domain: "手工艺、服饰与传统美术", status: "A",
    summary: "针线、纹样、服饰、家族记忆与女性传承共同构成苗绣，不同地区支系有各自的形制和语境。",
    canvas: { x: -460, y: 420, scene: "门前绣架、针线与逐渐长出的纹样", entryObject: "针尖上的一段线" },
    listen: "布料摩擦、穿针和身边人的讲述。", see: ["绣片", "针线", "盛装", "纹样"], relations: []
  },
  {
    id: "FOD-002", name: "苗族酸汤", domain: "饮食、茶与酒", status: "A",
    summary: "红酸、白酸、米汤、毛辣果和时间共同形成黔东南日常饮食中的酸味系统。",
    canvas: { x: 160, y: 680, scene: "开坛、发酵、围锅与家常炊烟", entryObject: "冒着细泡的酸汤坛" },
    listen: "坛盖被掀开，汤汁轻沸，饭桌上的说话声靠近。", see: ["酸汤坛", "红酸", "白酸", "鱼锅"], relations: []
  },
  {
    id: "IND-002", name: "万山汞矿", domain: "工业、三线与现代生活", status: "A",
    summary: "朱砂采冶、近现代汞工业、矿工社区和资源枯竭后的转型叠在同一座山中。",
    canvas: { x: 1480, y: 760, scene: "地下坑道、矿灯、朱砂与工人生活", entryObject: "照进坑道的一盏矿灯" },
    listen: "矿车、滴水和交接班铃声在坑道里回响。", see: ["朱砂", "坑道", "矿灯", "工人社区"], relations: []
  },
  {
    id: "CON-001", name: "村超", domain: "当代群众文化", status: "A",
    summary: "榕江的足球比赛连接村寨、啦啦队、夜市、民族文化展示和当代社区协作。",
    canvas: { x: 820, y: 1280, scene: "夜色球场、村寨啦啦队与流动夜市", entryObject: "滚到场边的一只足球" },
    listen: "解说、鼓点和看台上的欢呼从四周涌来。", see: ["球场", "啦啦队", "夜市", "村寨"], relations: []
  }
];

const ATTRACTION_DOMAIN_PATTERN = /飞瀑|水上喀斯特|世界自然遗产|历史现场|制度遗址|村寨与共同体|古城|城市地标|季候|生态|地心|矿脉|星空|峰林|峡谷|高原/;

function contentKindFor(entryOrDomain) {
  if (typeof entryOrDomain === "object" && entryOrDomain?.contentKind) return entryOrDomain.contentKind;
  const domain = typeof entryOrDomain === "string" ? entryOrDomain : entryOrDomain?.domain || "";
  return ATTRACTION_DOMAIN_PATTERN.test(domain) ? "attractions" : "culture";
}

function groupForCatalog(entry) {
  const domain = entry?.domain || "";
  const id = entry?.id || "";
  if (/红色文化/.test(domain) || id.startsWith("RED-") || id === "HIS-101") return "red";
  if (/饮食|茶与酒|美食/.test(domain) || id.startsWith("FOD-")) return "food";
  if (/工业|三线|地心|矿脉|星空/.test(domain) || id.startsWith("IND-") || id.startsWith("DEP-")) return "industry";
  if (/当代群众|当代生活/.test(domain) || id.startsWith("CON-")) return "today";
  if (/非遗|音乐|舞蹈|戏剧|节日|礼俗|信俗|手工艺|服饰|美术/.test(domain) || /^(PER|FES|CRA|BUI)-/.test(id)) return "heritage";
  if (/村寨|共同体/.test(domain) || id.startsWith("VIL-")) return "village";
  if (/山水景|飞瀑|瀑布|喀斯特|洞穴|丹霞|湖泊|水域|湿地|世界自然遗产|季候|生态|峰林|峡谷|高原|山地环境|生计/.test(domain) || /^(WAT|HER|SEA|PEK|ENV)-/.test(id)) return "scenery";
  return "history";
}

function pageLayoutFor(node, detail) {
  if (detail.layout) return detail.layout;
  const id = node.id || "";
  const group = groupForCatalog(node);

  if (id === "RED-007") return "route-chronicle";
  if (/^(HIS-009|HIS-011)$/.test(id)) return "portrait-essay";
  if (/^(CTY|HIS-10)/.test(id)) return "city-postcard";
  if (/^(VIL|PER|FES|CRA|FOD|CON)-/.test(id)) return "living-rhythm";
  if (group === "scenery" || /^(WAT|HER|SEA|PEK|ENV|DEP-00[12])/.test(id)) return "landscape-atlas";
  return "archive-dossier";
}

function evidenceLabel(status) {
  if (status === "A") return "A · 已有权威来源";
  if (status === "B") return "B · 已有线索，仍需补证";
  return "C · 发布前需要专项核验";
}

function contentDepthLabel(node) {
  if (node?.contentDepth === "deep") return "深读 · 独立正文";
  if (node?.contentDepth === "catalog") return "目录线索 · 待扩写";
  return "城市导览 · 已有现场线索";
}

function normalizeNode(node, index = 0) {
  const summary = node.summary || `从${node.name}进入当地的山水、历史与日常生活。`;
  const isCatalog = node.contentDepth === "catalog";
  const scene = isCatalog ? "独立实景与现场观察待补" : summary.replace(/[。！？]$/, "");
  return {
    ...node,
    contentDepth: node.contentDepth || "brief",
    canvas: {
      x: ((index % 9) - 4) * 240,
      y: (Math.floor(index / 9) - 6) * 220,
      scene,
      entryObject: node.name,
      ...(node.canvas || {})
    },
    listen: node.listen || (isCatalog ? "" : "现场声音待采集。"),
    see: Array.isArray(node.see) && node.see.length ? node.see : (isCatalog ? [] : [node.name, node.domain, "周边生活"]),
    relations: Array.isArray(node.relations) ? node.relations : []
  };
}

const CATALOG_RESEARCH_CHECKLISTS = {
  scenery: ["核验具体入口、游线与实际观看位置", "记录季节、水位或天气对现场的影响", "补入景点级来源与当日开放信息"],
  village: ["分清社区日常、公共参观区与旅游展示", "确认民居进入、人物拍摄与活动参与的边界", "补入具体居民、物件或当下生活细节"],
  history: ["区分原址、原物、复原陈设与后来的解释", "补入准确时间、人物与可核验的证据", "确认开放边界、展陈变动与参观路径"],
  red: ["把单个旧址放回完整的时间线与行动路线", "区分历史建筑、复原陈设与纪念性建设", "补入旧址或纪念场馆的直接来源"],
  heritage: ["确认由谁实践、在什么场合发生", "区分社区内部传统与面向游客的展示", "补入一个具体动作、物件或传承人叙述"],
  food: ["核验主要材料、做法与地方差异", "补入真实的制作或进食场景", "说清食物与作物、市集、节庆或家庭的关系"],
  industry: ["确认设备、厂房与历史阶段的准确对应", "补入工人、社区或当下转型的具体细节", "区分工业遗存、展陈内容与旅游改造"],
  today: ["补入一个可定位、可观察的当下场景", "记录真实参与者与活动发生的时间", "避免用产业或城市口号代替日常细节"]
};

function catalogResearchChecklist(node) {
  return CATALOG_RESEARCH_CHECKLISTS[groupForCatalog(node)] || CATALOG_RESEARCH_CHECKLISTS.history;
}

function lightweightDetailFor(node) {
  const city = cityJournalById.get(node.cityId);
  const isCatalog = node.contentDepth === "catalog";
  const sections = isCatalog
    ? [{
        kind: "completion",
        title: "这页先停在目录",
        body: "目前只完成了选点、主题归类与初步来源登记。独立实景、具体游线和景点级事实尚未补齐，因此不把一条摘要扩写成“抵达故事”。"
      }]
    : [
        { kind: "observation", title: `从${node.canvas?.entryObject || node.name}进入`, body: node.canvas?.scene || `先观察${node.name}与周边空间的关系。` },
        { kind: "sound", title: "再听一遍现场", body: node.listen || "现场声音仍待采集。" }
      ];

  return {
    meta: {
      "城市": city?.name || "贵州",
      "主题": CHAPTERS[groupForCatalog(node)]?.title || node.domain,
      ...(node.heritage ? {
        "名录级别": `${node.heritage.level} · ${node.heritage.batch}`,
        "项目类别": node.heritage.category,
        "申报地区": node.heritage.location
      } : {}),
      "内容层级": contentDepthLabel(node)
    },
    sections,
    fieldGuide: isCatalog ? catalogResearchChecklist(node) : (node.see || []).map((item) => `留意：${item}`),
    sourceIds: node.sourceIds || [],
    visual: {
      kind: isCatalog ? "真实资料图 · 专属现场待核验" : "城市共用图版",
      credit: isCatalog ? "使用同主题真实场景参考；不替代该项目的独立现场证据" : "本轮先补内容与来源，独立节点图片待完成授权核验后替换"
    }
  };
}

function chapterOrder(group) {
  return Object.keys(CHAPTERS).indexOf(group) + 1;
}

function chineseChapter(index) {
  const numbers = ["一", "二", "三", "四", "五", "六", "七", "八"];
  return `第${numbers[index - 1] || index}章`;
}

function padPage(value) {
  return String(value).padStart(3, "0");
}

function saveBookmarks() {
  localStorage.setItem("cloud_wayfarer-unified-bookmarks", JSON.stringify([...bookmarks]));
  const count = document.querySelector("#bookmark-count");
  if (count) count.textContent = String(bookmarks.size);
}

function selectedCity() {
  return cityJournalById.get(selectedCityId) || CITY_JOURNALS[0];
}

function cityNodes(city = selectedCity()) {
  const ids = new Set(city.nodeIds);
  return nodes.filter((node) => ids.has(node.id) || node.cityId === city.id);
}

function cityStats(city = selectedCity()) {
  const scopedNodes = cityNodes(city);
  return {
    total: scopedNodes.length || city.nodeIds.length,
    deep: scopedNodes.filter((node) => node.contentDepth === "deep").length,
    guide: scopedNodes.filter((node) => node.contentDepth !== "catalog").length
  };
}

function activeNodes() {
  const scoped = cityNodes();
  return scoped.length ? scoped : nodes;
}

function nodeBelongsToSelectedCity(node) {
  return Boolean(node && (node.cityId === selectedCityId || selectedCity().nodeIds.includes(node.id)));
}

function cityForNode(nodeId) {
  const nodeCityId = nodeById.get(nodeId)?.cityId;
  if (nodeCityId && cityJournalById.has(nodeCityId)) return cityJournalById.get(nodeCityId);
  if (selectedCity().nodeIds.includes(nodeId)) return selectedCity();
  return CITY_JOURNALS.find((city) => city.nodeIds.includes(nodeId)) || selectedCity();
}

function buildCityJournalButton(city, context) {
  const button = document.createElement("button");
  const stats = cityStats(city);
  button.type = "button";
  button.className = `city-journal-choice city-journal-choice-${context}`;
  button.dataset.cityJournal = city.id;
  button.dataset.code = city.code;
  if (context !== "workspace") button.setAttribute("aria-pressed", String(city.id === selectedCityId));
  button.setAttribute("aria-label", `打开${city.name}城市指南，收录${stats.total}项，其中${stats.deep}篇深读`);
  button.innerHTML = context === "shelf"
    ? `<span class="city-spine-mark">${city.short}</span><span><b>${city.name}</b><small>${city.subtitle}</small></span><i>${stats.total}</i>`
    : context === "workspace"
      ? `<span class="workspace-city-book">
          <img src="${city.cover}" alt="" style="object-position:${city.coverPosition}">
          <span class="workspace-city-book-shade" aria-hidden="true"></span>
          <span class="workspace-city-book-register"><small>CITY GUIDE</small><b>${city.code}</b></span>
          <span class="workspace-city-book-title"><small>${city.latin}</small><b>${city.name}指南</b><i>${city.subtitle}</i></span>
          <span class="workspace-city-book-footer"><small>${stats.total} 项 · ${stats.deep} 篇深读</small><i aria-hidden="true">↗</i></span>
        </span>`
      : `<span>${city.code}</span><b>${city.name}</b><small>${stats.total} 项</small>`;
  button.addEventListener("click", () => openJournalForCity(city.id));
  return button;
}

function buildCityGalleryCard(city) {
  const button = document.createElement("button");
  const scopedNodes = cityNodes(city);
  const stats = cityStats(city);
  const entryNames = scopedNodes.length
    ? scopedNodes.slice(0, 2).map((node) => node.name)
    : city.nodeIds.slice(0, 2).map((id) => nodeById.get(id)?.name).filter(Boolean);
  button.type = "button";
  button.className = "city-gallery-book";
  button.dataset.cityGallery = city.id;
  button.style.setProperty("--book-accent", city.accent);
  button.setAttribute("aria-label", `打开${city.name}城市指南，${city.subtitle}，收录${stats.total}项，其中${stats.deep}篇深读`);
  button.innerHTML = `
    <span class="city-gallery-book-object">
      <img src="${city.cover}" alt="" style="object-position:${city.coverPosition}">
      <span class="city-gallery-book-shade" aria-hidden="true"></span>
      <span class="city-gallery-book-cloth" aria-hidden="true"></span>
      <span class="city-gallery-book-register"><small>贵州九城文化指南</small><b>${city.code}</b></span>
      <span class="city-gallery-book-title"><small>${city.latin}</small><b>${city.name}</b><i>${city.subtitle}</i></span>
      <span class="city-gallery-book-folio"><small>${entryNames.join(" · ") || city.tagline}</small><b>${stats.total} 项 · ${stats.deep} 篇深读</b></span>
    </span>
    <span class="city-gallery-book-caption"><b>${city.name}指南</b><small>${city.tagline}</small><i aria-hidden="true">→</i></span>`;
  button.addEventListener("click", () => openJournalForCity(city.id));
  return button;
}

function renderCityJournalUI() {
  const city = selectedCity();
  const stats = cityStats(city);
  document.documentElement.style.setProperty("--city-accent", city.accent);
  document.documentElement.dataset.city = city.id;

  const workspace = document.querySelector("#workspace-city-list");
  const home = document.querySelector("#home-city-list");
  const gallery = document.querySelector("#city-journal-gallery-grid");
  if (workspace) workspace.replaceChildren(...CITY_JOURNALS.map((item) => buildCityJournalButton(item, "workspace")));
  if (home) home.replaceChildren(...CITY_JOURNALS.map((item) => buildCityJournalButton(item, "home")));
  if (gallery) gallery.replaceChildren(...CITY_JOURNALS.map(buildCityGalleryCard));

  const miniMark = document.querySelector("#open-province-journal .journal-mini-cover i");
  const miniCode = document.querySelector("#open-province-journal .journal-mini-cover small");
  const miniTitle = document.querySelector("#open-province-journal .journal-mini-copy b");
  if (miniMark) miniMark.textContent = city.short;
  if (miniCode) miniCode.textContent = city.code;
  if (miniTitle) miniTitle.textContent = `当前：${city.name}指南`;

  const homeBook = document.querySelector("#open-first-journal");
  const homeImage = homeBook?.querySelector("img");
  if (homeImage) {
    homeImage.src = city.cover;
    homeImage.alt = `${city.name}城市文化指南封面`;
    homeImage.style.objectPosition = city.coverPosition;
  }
  const homeNumber = homeBook?.querySelector(".destination-book-number b");
  const homeTitle = homeBook?.querySelector(".destination-book-title b");
  const homeSubtitle = homeBook?.querySelector(".destination-book-title i");
  const homeFooter = homeBook?.querySelector(".destination-book-footer small");
  if (homeNumber) homeNumber.textContent = city.code;
  if (homeTitle) homeTitle.textContent = `${city.name}指南`;
  if (homeSubtitle) homeSubtitle.textContent = city.subtitle;
  if (homeFooter) homeFooter.textContent = `收录 ${stats.total} 项 · ${stats.deep} 篇深读`;
}

function applyEditionCopy() {
  const city = selectedCity();
  const stats = cityStats(city);
  document.documentElement.dataset.edition = EDITION;
  document.title = body.dataset.view === "journal"
    ? `黔境｜${city.name}城市文化旅行指南`
    : "云游四方｜阿镜的远方生活与九城文化指南";
  document.querySelector("#cover-volume").textContent = `贵州九城文化指南 · 第 ${city.code} 册`;
  document.querySelector("#cover-code").textContent = city.code;
  document.querySelector("#cover-kicker").textContent = `${city.latin} · PLACES AND LIVING CULTURE`;
  document.querySelector("#cover-title").textContent = city.name;
  document.querySelector("#cover-edition").textContent = "城市文化旅行指南";
  document.querySelector("#cover-quote").textContent = city.tagline;
  document.querySelector("#cover-footer-topics").textContent = `${city.subtitle} · 收录 ${stats.total} 项 · ${stats.deep} 篇深读`;
  const coverImage = document.querySelector(".cover-image");
  coverImage.src = city.cover;
  coverImage.alt = `${city.name}山水、街巷与生活组成的城市文化指南封面`;
  coverImage.style.objectPosition = city.coverPosition;
  cover.setAttribute("aria-label", `打开${city.name}城市文化旅行指南`);
  document.querySelector("#plate-register-label").textContent = `${city.name}图版 · FIELD NOTE`;
  document.querySelector("#field-guide-title").textContent = EDITION_COPY.fieldGuideTitle;
  document.querySelector("#threads-kicker").textContent = EDITION_COPY.threadsKicker;
  document.querySelector("#threads-title").textContent = EDITION_COPY.threadsTitle;
  document.querySelector("#book-stage").setAttribute("aria-label", `${city.name}城市文化旅行指南`);
  document.querySelector("#page-prev").setAttribute("aria-label", `阅读${city.name}指南上一篇`);
  document.querySelector("#page-next").setAttribute("aria-label", `阅读${city.name}指南下一篇`);
  document.querySelector("#chapter-tabs").setAttribute("aria-label", `按${city.name}指南主题切换`);
  placeTabs?.setAttribute("aria-label", `${city.name}指南当前主题下的景点与条目`);
  document.querySelector("#chapter-index-spread .chapter-index-footer span").textContent = `${city.name}城市文化旅行指南`;
  renderCityJournalUI();
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function closePanels() {
  for (const panel of [photoPocket, sourceSlip]) {
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    panel.inert = true;
  }
}

function openPanel(panel, focusSelector) {
  closePanels();
  panel.classList.add("is-open");
  panel.setAttribute("aria-hidden", "false");
  panel.inert = false;
  window.setTimeout(() => panel.querySelector(focusSelector)?.focus(), reduceMotion ? 0 : 220);
}

function syncBookAccessibility() {
  const isOpen = body.dataset.state === "open";
  cover.setAttribute("aria-hidden", String(isOpen));
  cover.inert = isOpen;
  spread.setAttribute("aria-hidden", String(!isOpen));
  spread.inert = !isOpen;
}

function relatedNodes(node) {
  const results = [];
  const seen = new Set([node.id]);

  for (const relation of node.relations || []) {
    const target = nodeById.get(relation.target);
    if (!target || seen.has(target.id) || !nodeBelongsToSelectedCity(target)) continue;
    results.push({ node: target, reason: relation.reason || "文化关系" });
    seen.add(target.id);
  }

  const cultureLink = ATTRACTION_CULTURE_LINKS[node.id];
  if (cultureLink && !seen.has(cultureLink.target)) {
    const target = nodeById.get(cultureLink.target);
    if (target && nodeBelongsToSelectedCity(target)) {
      results.push({ node: target, reason: cultureLink.reason });
      seen.add(target.id);
    }
  }

  for (const candidate of activeNodes()) {
    const reverse = (candidate.relations || []).find((relation) => relation.target === node.id);
    if (!reverse || seen.has(candidate.id)) continue;
    results.push({ node: candidate, reason: reverse.reason || "文化关系" });
    seen.add(candidate.id);
  }

  const candidates = activeNodes()
    .filter((candidate) => !seen.has(candidate.id))
    .sort((a, b) => {
      const aGroup = groupForCatalog(a) === groupForCatalog(node) ? -100000 : 0;
      const bGroup = groupForCatalog(b) === groupForCatalog(node) ? -100000 : 0;
      const aDistance = Math.hypot(a.canvas.x - node.canvas.x, a.canvas.y - node.canvas.y);
      const bDistance = Math.hypot(b.canvas.x - node.canvas.x, b.canvas.y - node.canvas.y);
      return aGroup + aDistance - (bGroup + bDistance);
    });

  for (const candidate of candidates) {
    if (results.length >= 3) break;
    results.push({
      node: candidate,
      reason: groupForCatalog(candidate) === groupForCatalog(node) ? "同一主题里的另一页" : "沿着关联翻到另一个贵州主题"
    });
  }

  return results.slice(0, 3);
}

function visualCompanions(node, plateAsset) {
  const candidates = [];
  const seenNodes = new Set([node.id]);
  const seenImages = new Set([plateAsset?.src].filter(Boolean));

  const add = (candidate, reason) => {
    if (!candidate || seenNodes.has(candidate.id)) return;
    const asset = plateAssetFor(candidate);
    if (!asset?.src || seenImages.has(asset.src)) return;
    candidates.push({ node: candidate, asset, reason });
    seenNodes.add(candidate.id);
    seenImages.add(asset.src);
  };

  const cultureLink = ATTRACTION_CULTURE_LINKS[node.id];
  if (cultureLink) add(nodeById.get(cultureLink.target), cultureLink.reason);
  relatedNodes(node).forEach((relation) => add(relation.node, relation.reason));
  activeNodes()
    .filter((candidate) => groupForCatalog(candidate) === groupForCatalog(node))
    .forEach((candidate) => add(candidate, `同一主题里的另一处现场：${candidate.name}`));
  activeNodes().forEach((candidate) => add(candidate, `从${node.name}继续翻到${candidate.name}`));

  return candidates.slice(0, 2);
}

function cultureBridgeFor(node) {
  const cultureLink = ATTRACTION_CULTURE_LINKS[node.id];
  if (cultureLink) {
    const target = nodeById.get(cultureLink.target);
    if (target && nodeBelongsToSelectedCity(target)) return { node: target, reason: cultureLink.reason };
  }
  if (!(node.relations || []).length) return null;
  const explicitTargets = new Set(node.relations.map((relation) => relation.target));
  return relatedNodes(node).find((relation) => explicitTargets.has(relation.node.id) && relation.node.contentKind === "culture")
    || relatedNodes(node).find((relation) => explicitTargets.has(relation.node.id))
    || null;
}

function renderThreads(node) {
  const container = document.querySelector("#thread-list");
  container.replaceChildren();
  relatedNodes(node).forEach((relation, index) => {
    const button = document.createElement("button");
    const indexMark = document.createElement("span");
    const copy = document.createElement("span");
    const title = document.createElement("b");
    const reason = document.createElement("small");
    const arrow = document.createElement("span");

    button.type = "button";
    button.className = "thread-button";
    button.title = relation.reason;
    indexMark.textContent = padPage(index + 1);
    title.textContent = relation.node.name;
    const usesGenericReason = relation.reason === "同一主题里的另一页" || relation.reason === "沿着关联翻到另一个贵州主题";
    reason.textContent = node.contentDepth === "catalog" || usesGenericReason ? relation.node.domain : relation.reason;
    arrow.textContent = "→";
    copy.append(title, reason);
    button.append(indexMark, copy, arrow);
    button.addEventListener("click", () => insertAndOpen(relation.node, "next"));
    container.append(button);
  });
}

function detailFor(node) {
  return detailRecords[node.id] || {
    meta: { "主题": node.domain, "内容层级": "资料未载入", "发布状态": "待补齐" },
    sections: [
      { kind: "completion", title: "详细资料暂未载入", body: "为避免用通用文案冒充正文，本页暂停在摘要。重新载入资料后可继续阅读。" }
    ],
    fieldGuide: ["检查资料文件是否完整载入", "补入可核验来源后再公开发布"],
    sourceIds: [],
    visual: { kind: "资料占位图", credit: "不作为现场事实证据" }
  };
}

function renderCultureMeta(detail) {
  const container = document.querySelector("#culture-meta");
  container.replaceChildren();
  Object.entries(detail.meta || {}).forEach(([label, value]) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    item.append(term, description);
    container.append(item);
  });
}

const LEAF_INTERACTIONS = {
  "ARC-001": {
    type: "archaeology",
    kicker: "书页机关 · BRUSH THE LAYERS",
    title: "轻轻扫开三层土",
    deck: "别急着把石器拿走。先看它在哪一层，又与什么共存。"
  },
  "CRA-001": {
    type: "embroidery",
    kicker: "书页机关 · FOLLOW THE THREAD",
    title: "让一根线穿过三针",
    deck: "这是理解针路的练习绣片，不复刻任何具体社区的真实纹样。"
  },
  "PER-001": {
    type: "dong-song",
    kicker: "书页机关 · GATHER THE VOICES",
    title: "把四位歌者请进鼓楼",
    deck: "先听一位高声歌者，再让低声歌者从四周汇入。这是声部关系示意，不是真实大歌录音。"
  },
  "CTY-001": {
    type: "qingyan-history",
    kicker: "三步读懂青岩 · FROM FORT TO TOWN",
    title: "青岩如何从军堡变成古镇",
    deck: "按顺序完成三步：先建军堡，再沿山修城墙，最后接通粮道和商路。"
  }
};

function createLeafInteractionHeader(node, config, shell) {
  const header = document.createElement("header");
  const copy = document.createElement("div");
  const kicker = document.createElement("span");
  const title = document.createElement("h3");
  const deck = document.createElement("p");
  const status = document.createElement("span");
  kicker.textContent = config.kicker;
  title.textContent = config.title;
  deck.textContent = config.deck;
  status.className = "leaf-interaction-status";
  status.textContent = completedLeafInteractions.has(node.id) ? "已留下手帐痕迹" : "等你动手";
  copy.append(kicker, title, deck);
  header.append(copy, status);
  shell.append(header);
}

function createLeafInteractionFooter(initialStatus) {
  const footer = document.createElement("footer");
  const status = document.createElement("p");
  const actions = document.createElement("div");
  status.className = "leaf-action-copy";
  status.textContent = initialStatus;
  actions.className = "leaf-action-buttons";
  footer.append(status, actions);
  return { footer, status, actions };
}

function completeLeafInteraction(shell, nodeId, resultCopy) {
  if (shell.dataset.complete === "true") return;
  shell.dataset.complete = "true";
  saveCompletedLeafInteraction(nodeId);
  const status = shell.querySelector(".leaf-interaction-status");
  if (status) status.textContent = "已留下手帐痕迹";
  const result = document.createElement("aside");
  result.className = "leaf-keepsake";
  result.innerHTML = `<span aria-hidden="true">※</span><p>${resultCopy}</p>`;
  shell.append(result);
}

function renderArchaeologyInteraction(node, shell) {
  const stage = document.createElement("div");
  stage.className = "leaf-stage archaeology-brush-stage";
  stage.dataset.step = "0";
  stage.innerHTML = `
    <div class="archaeology-cave" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="archaeology-strata" aria-hidden="true"><i></i><i></i><i></i></div>
    <button class="archaeology-brush-surface" type="button" aria-label="在地层上轻扫，逐步显露考古证据">
      <span class="brush-cursor" aria-hidden="true">╱╲╱</span>
      <span class="brush-hint">按住左右轻扫</span>
    </button>
    <div class="archaeology-evidence-token token-stone" aria-hidden="true"><i>◇</i><b>石器</b><small>人为打制痕迹</small></div>
    <div class="archaeology-evidence-token token-layer" aria-hidden="true"><i>≡</i><b>层位</b><small>它在哪一层</small></div>
    <div class="archaeology-evidence-token token-fossil" aria-hidden="true"><i>∿</i><b>化石</b><small>同层环境线索</small></div>
    <div class="archaeology-connection" aria-hidden="true"><span></span><span></span></div>`;

  const { footer, status, actions } = createLeafInteractionFooter("第一扫，只会看见一件器物。");
  const sweepButton = document.createElement("button");
  const resetButton = document.createElement("button");
  sweepButton.type = "button";
  sweepButton.className = "leaf-action-primary";
  sweepButton.textContent = "轻扫一下";
  resetButton.type = "button";
  resetButton.textContent = "重新覆上土层";
  actions.append(sweepButton, resetButton);
  shell.append(stage, footer);

  const surface = stage.querySelector(".archaeology-brush-surface");
  const messages = [
    "第一扫，只会看见一件器物。",
    "看见石器了。但只看它的形状，答案还不够。",
    "层位亮起来了：石器被重新放回时间中。",
    "石器、层位和化石彼此支持，一组证据才完整。"
  ];
  let step = 0;
  let pointerState = null;

  function update(nextStep) {
    step = Math.max(0, Math.min(3, nextStep));
    stage.dataset.step = String(step);
    status.textContent = messages[step];
    surface.setAttribute("aria-label", step < 3
      ? `已扫开${step}层，继续轻扫查看下一组证据`
      : "三组考古证据已全部显示");
    sweepButton.textContent = step < 3 ? "轻扫一下" : "证据链已完整";
    sweepButton.disabled = step >= 3;
    if (step === 3) completeLeafInteraction(shell, node.id, "你留下了一枚“地层关系拓印”：离开出土位置，石器会失去一半信息。");
  }

  function sweep() {
    if (step < 3) update(step + 1);
  }

  surface.addEventListener("pointerdown", (event) => {
    if (step >= 3) return;
    pointerState = { id: event.pointerId, x: event.clientX, distance: 0 };
    surface.setPointerCapture?.(event.pointerId);
    stage.classList.add("is-brushing");
  });
  surface.addEventListener("pointermove", (event) => {
    if (!pointerState || pointerState.id !== event.pointerId) return;
    pointerState.distance += Math.abs(event.clientX - pointerState.x);
    pointerState.x = event.clientX;
    if (pointerState.distance >= 64) {
      pointerState.distance = 0;
      sweep();
    }
  });
  const releasePointer = (event) => {
    if (!pointerState || pointerState.id !== event.pointerId) return;
    pointerState = null;
    stage.classList.remove("is-brushing");
    surface.releasePointerCapture?.(event.pointerId);
  };
  surface.addEventListener("pointerup", releasePointer);
  surface.addEventListener("pointercancel", releasePointer);
  surface.addEventListener("click", (event) => {
    if (event.detail === 0) sweep();
  });
  sweepButton.addEventListener("click", sweep);
  resetButton.addEventListener("click", () => {
    shell.querySelector(".leaf-keepsake")?.remove();
    delete shell.dataset.complete;
    update(0);
  });
}

function renderEmbroideryInteraction(node, shell) {
  const stage = document.createElement("div");
  stage.className = "leaf-stage embroidery-stage";
  stage.dataset.step = "0";
  stage.innerHTML = `
    <div class="embroidery-cloth" aria-hidden="true">
      <span class="cloth-selvedge"></span>
      <svg viewBox="0 0 420 220" role="img" aria-label="一条从左至右的针路练习线">
        <path class="thread-guide" d="M54 153 Q118 48 188 115 Q242 184 291 110 Q344 40 376 147" pathLength="1" />
        <path class="thread-segment segment-one" d="M54 153 Q118 48 188 115" pathLength="1" />
        <path class="thread-segment segment-two" d="M188 115 Q242 184 291 110" pathLength="1" />
        <path class="thread-segment segment-three" d="M291 110 Q344 40 376 147" pathLength="1" />
        <path class="thread-back" d="M54 157 L188 121 L291 116 L376 153" pathLength="1" />
      </svg>
      <span class="thread-start" aria-hidden="true">线头</span>
    </div>
    <div class="needle-points" aria-label="三个练习落针点">
      <button type="button" data-stitch="1" style="--point-x:45%;--point-y:52%" aria-label="穿过第一针"><span>01</span></button>
      <button type="button" data-stitch="2" style="--point-x:69%;--point-y:50%" aria-label="穿过第二针" disabled><span>02</span></button>
      <button type="button" data-stitch="3" style="--point-x:88%;--point-y:67%" aria-label="穿过第三针" disabled><span>03</span></button>
    </div>
    <span class="embroidery-needle" aria-hidden="true"></span>`;

  const { footer, status, actions } = createLeafInteractionFooter("从 01 开始。每一次落针，都会把下一段针路牵出来。");
  const backButton = document.createElement("button");
  const resetButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "leaf-action-primary";
  backButton.textContent = "翻看绣片背面";
  backButton.hidden = true;
  resetButton.type = "button";
  resetButton.textContent = "抽回这根线";
  actions.append(backButton, resetButton);
  shell.append(stage, footer);

  const points = [...stage.querySelectorAll("[data-stitch]")];
  const messages = [
    "从 01 开始。每一次落针，都会把下一段针路牵出来。",
    "第一针落下。线迹不是图案的填色，它本身就在构成图形。",
    "第二针连上了。正面的节奏，来自背面不断的收线。",
    "三针完成。现在翻过去，看看正面之外的针路。"
  ];
  let step = 0;

  function update(nextStep) {
    step = Math.max(0, Math.min(3, nextStep));
    stage.dataset.step = String(step);
    stage.classList.remove("is-back");
    status.textContent = messages[step];
    points.forEach((point, index) => {
      const stitch = index + 1;
      point.disabled = stitch !== step + 1 || step >= 3;
      point.classList.toggle("is-stitched", stitch <= step);
    });
    backButton.hidden = step < 3;
    backButton.textContent = "翻看绣片背面";
    if (step === 3) completeLeafInteraction(shell, node.id, "你留下了一块“三针练习绣片”。真实苗绣需要追问地区、支系、使用场合和创作者。");
  }

  points.forEach((point) => {
    point.addEventListener("click", () => update(Number(point.dataset.stitch)));
  });
  backButton.addEventListener("click", () => {
    const showingBack = stage.classList.toggle("is-back");
    backButton.textContent = showingBack ? "回到绣片正面" : "翻看绣片背面";
    status.textContent = showingBack
      ? "背面的走线和收线，也是工艺的一部分。看苗绣，不要只看正面。"
      : messages[3];
  });
  resetButton.addEventListener("click", () => {
    shell.querySelector(".leaf-keepsake")?.remove();
    delete shell.dataset.complete;
    update(0);
  });
}

function playLeafVoiceSketch(activeVoices) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass || !activeVoices.length) return;
  leafAudioContext ||= new AudioContextClass();
  leafAudioContext.resume?.();
  const now = leafAudioContext.currentTime;
  const voiceGain = activeVoices.length > 2 ? 0.018 : 0.026;
  activeVoices.forEach((voice, index) => {
    const oscillator = leafAudioContext.createOscillator();
    const gain = leafAudioContext.createGain();
    oscillator.type = index === 0 ? "sine" : "triangle";
    oscillator.frequency.value = Number(voice.frequency);
    oscillator.detune.value = Number(voice.detune || 0);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(voiceGain, now + 0.12 + index * 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.65);
    oscillator.connect(gain);
    gain.connect(leafAudioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 1.72);
    oscillator.addEventListener("ended", () => {
      oscillator.disconnect();
      gain.disconnect();
    });
  });
}

function renderDongSongInteraction(node, shell) {
  const stage = document.createElement("div");
  stage.className = "leaf-stage dong-song-stage";
  stage.dataset.voices = "0";
  stage.innerHTML = `
    <div class="drum-tower-space" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
    <div class="voice-rings" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="dong-singers" aria-label="四位歌者的高低声部关系示意">
      <button type="button" class="dong-singer singer-high" data-frequency="392" data-voice-name="高声歌者" aria-pressed="false"><i aria-hidden="true"></i><b>高声歌者</b><small>先进入</small></button>
      <button type="button" class="dong-singer singer-low-one" data-frequency="196" data-voice-name="低声歌者一" aria-pressed="false"><i aria-hidden="true"></i><b>低声歌者</b><small>歌班回应</small></button>
      <button type="button" class="dong-singer singer-low-two" data-frequency="220" data-detune="-5" data-voice-name="低声歌者二" aria-pressed="false"><i aria-hidden="true"></i><b>低声歌者</b><small>歌班回应</small></button>
      <button type="button" class="dong-singer singer-low-three" data-frequency="246.94" data-detune="5" data-voice-name="低声歌者三" aria-pressed="false"><i aria-hidden="true"></i><b>低声歌者</b><small>歌班回应</small></button>
    </div>
    <p class="voice-sketch-note">抽象音高示意 · 非侗族大歌曲目与录音</p>`;

  const { footer, status, actions } = createLeafInteractionFooter("点亮高声歌者，再让低声歌者一位位进入。");
  const replayButton = document.createElement("button");
  const resetButton = document.createElement("button");
  replayButton.type = "button";
  replayButton.className = "leaf-action-primary";
  replayButton.textContent = "再听一遍声部关系";
  replayButton.disabled = true;
  resetButton.type = "button";
  resetButton.textContent = "让鼓楼安静下来";
  actions.append(replayButton, resetButton);
  shell.append(stage, footer);

  const singers = [...stage.querySelectorAll(".dong-singer")];

  function activeVoices() {
    return singers.filter((singer) => singer.getAttribute("aria-pressed") === "true").map((singer) => ({
      frequency: singer.dataset.frequency,
      detune: singer.dataset.detune
    }));
  }

  function update() {
    const voices = activeVoices();
    stage.dataset.voices = String(voices.length);
    replayButton.disabled = voices.length === 0;
    const messages = [
      "点亮高声歌者，再让低声歌者一位位进入。",
      "一位高声歌者出现了。现在的声音还很单薄。",
      "第一位低声歌者加入，声音开始有了承托。",
      "更多人进入。歌声不再属于一个人。",
      "“众低独高”的关系出现了。真正被传承的，还有语言、歌班、歌师与社区。"
    ];
    status.textContent = messages[voices.length];
    if (voices.length === singers.length) completeLeafInteraction(shell, node.id, "你留下了一段“声部关系声纹”。正式产品接入声音时，只使用获得授权的歌班录音。");
  }

  singers.forEach((singer, index) => {
    singer.addEventListener("click", () => {
      if (singer.getAttribute("aria-pressed") === "true") return;
      if (index > 0 && singers[0].getAttribute("aria-pressed") !== "true") {
        status.textContent = "先请高声歌者进来，再听低声部如何承托它。";
        singers[0].focus();
        return;
      }
      singer.setAttribute("aria-pressed", "true");
      singer.classList.add("is-singing");
      update();
      playLeafVoiceSketch(activeVoices());
    });
  });
  replayButton.addEventListener("click", () => playLeafVoiceSketch(activeVoices()));
  resetButton.addEventListener("click", () => {
    singers.forEach((singer) => {
      singer.setAttribute("aria-pressed", "false");
      singer.classList.remove("is-singing");
    });
    shell.querySelector(".leaf-keepsake")?.remove();
    delete shell.dataset.complete;
    update();
  });
}

function renderQingyanHistoryInteraction(node, shell) {
  const stage = document.createElement("div");
  stage.className = "leaf-stage qingyan-history-stage";
  stage.dataset.step = "0";
  stage.innerHTML = `
    <div class="qingyan-scene" data-period="day">
      <img src="assets/attractions/CTY-001.jpg" alt="青岩古镇石板街实景资料图">
      <div class="qingyan-sky-wash" aria-hidden="true"></div>
      <div class="qingyan-mist" aria-hidden="true"><i></i><i></i></div>
      <div class="qingyan-rain" aria-hidden="true"></div>
      <div class="qingyan-live-note">
        <span class="qingyan-live-mark"><i aria-hidden="true"></i>青岩现在几点、什么天气</span>
        <strong id="qingyan-local-time">正在读取当地时间</strong>
        <b id="qingyan-live-weather">实时天气连接中</b>
        <small id="qingyan-weather-source">天气来自在线数据，画面不是实时摄像头</small>
      </div>
      <button class="qingyan-sound-toggle" type="button" aria-pressed="false">
        <span aria-hidden="true">◉</span><b>听一段古镇情境</b><small>合成环境声 · 非现场录音</small>
      </button>
    </div>
    <div class="qingyan-history-workbench">
      <div class="qingyan-history-map">
        <svg viewBox="0 0 480 230" role="img" aria-labelledby="qingyan-map-title qingyan-map-desc">
          <title id="qingyan-map-title">青岩从军堡到商镇的演变示意</title>
          <desc id="qingyan-map-desc">尚未开始。先在交通与山势交会处设置青岩堡。</desc>
          <path class="history-terrain terrain-back" d="M-20 168 C48 105 94 128 142 80 C196 26 249 77 290 48 C349 7 405 52 502 13 L502 236 L-20 236 Z"/>
          <path class="history-terrain terrain-front" d="M-18 210 C72 142 132 190 207 116 C282 42 347 128 502 77 L502 238 L-18 238 Z"/>
          <path class="history-route history-route-west" d="M-15 196 C75 190 106 168 178 156"/>
          <path class="history-route history-route-east" d="M294 138 C354 141 394 171 501 162"/>
          <path class="history-wall" d="M176 154 L174 100 L206 72 L267 70 L309 105 L294 153 L250 174 L201 170 Z"/>
          <g class="history-fort">
            <path d="M213 122 L213 91 L260 91 L260 122 Z"/>
            <path d="M207 91 L236 72 L266 91 Z"/>
            <path d="M231 122 L231 105 L242 105 L242 122 Z"/>
          </g>
          <g class="history-gates">
            <path d="M165 157 L165 133 L188 133 L188 157 Z"/>
            <path d="M286 156 L286 131 L307 131 L307 156 Z"/>
            <circle cx="177" cy="101" r="7"/><circle cx="307" cy="106" r="7"/>
          </g>
          <g class="history-market">
            <path d="M320 131 L320 108 L344 108 L344 131 Z M352 140 L352 112 L378 112 L378 140 Z M389 151 L389 124 L417 124 L417 151 Z"/>
            <path d="M316 108 L332 96 L348 108 M348 112 L365 97 L382 112 M385 124 L403 108 L421 124"/>
          </g>
        </svg>
        <span class="history-map-label label-fort">青岩堡</span>
        <span class="history-map-label label-wall">石城墙与关隘</span>
        <span class="history-map-label label-gate">定广门</span>
        <span class="history-map-label label-market">粮道 · 商路</span>
        <p class="qingyan-map-caption">演变关系示意 · 非古城精确测绘图</p>
      </div>
      <div class="qingyan-history-steps" role="group" aria-label="青岩古镇三步演变">
        <button type="button" data-history-step="1" aria-pressed="false">
          <small>01 · 1391</small><b>先建一座军堡</b><span>建在山势和交通路线交汇的地方</span>
        </button>
        <button type="button" data-history-step="2" aria-pressed="false" disabled>
          <small>02 · 1853</small><b>再沿山修石城</b><span>用城墙、关隘和壕沟围成防线</span>
        </button>
        <button type="button" data-history-step="3" aria-pressed="false" disabled>
          <small>03 · 清代以来</small><b>最后接通商路</b><span>粮食和货物进城，市场随之形成</span>
        </button>
      </div>
      <a class="qingyan-history-source" href="https://www.gzrd.gov.cn/gzwh/202001/t20200106_77670082.html?isMobile=true" target="_blank" rel="noreferrer">史料依据 · 贵阳文化资料</a>
    </div>`;

  const { footer, status, actions } = createLeafInteractionFooter("从 1391 年开始。青岩最初不是景点，而是一座军堡。");
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.textContent = "重新推演";
  actions.append(resetButton);
  shell.append(stage, footer);

  const scene = stage.querySelector(".qingyan-scene");
  const time = stage.querySelector("#qingyan-local-time");
  const weather = stage.querySelector("#qingyan-live-weather");
  const weatherSource = stage.querySelector("#qingyan-weather-source");
  const soundButton = stage.querySelector(".qingyan-sound-toggle");
  const historyButtons = [...stage.querySelectorAll("[data-history-step]")];
  const mapDescription = stage.querySelector("#qingyan-map-desc");
  let ambient = null;
  let currentStep = 0;

  function updateLocalTime() {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai", hour: "2-digit", hourCycle: "h23"
    }).format(now));
    const period = hour < 6 ? "深夜" : hour < 9 ? "清晨" : hour < 12 ? "上午" : hour < 14 ? "中午" : hour < 18 ? "下午" : hour < 21 ? "傍晚" : "夜间";
    const clock = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false
    }).format(now);
    time.textContent = `${period} ${clock}`;
    scene.dataset.period = hour >= 18 || hour < 6 ? "night" : hour < 9 || hour >= 16 ? "edge" : "day";
  }

  function classifyWeather(data) {
    const condition = String(data?.condition || "");
    if (/雷|雨|雪/.test(condition)) return "rain";
    if (/雾/.test(condition)) return "mist";
    if (/阴|云/.test(condition)) return "cloud";
    return "clear";
  }

  async function loadWeather() {
    try {
      const response = await fetch("/api/ai/context?location=qingyan");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!shell.isConnected || shell.hidden) return;
      const current = data.weather;
      scene.dataset.weather = classifyWeather(current);
      if (!current?.available) {
        weather.textContent = "实时天气暂不可用";
        weatherSource.textContent = "天气暂时没有取到，下面的历史内容仍可阅读";
        return;
      }
      const pieces = [current.condition];
      if (Number.isFinite(current.temperatureC)) pieces.push(`${Math.round(current.temperatureC)}℃`);
      if (Number.isFinite(current.relativeHumidityPercent)) pieces.push(`湿度 ${Math.round(current.relativeHumidityPercent)}%`);
      weather.textContent = pieces.join(" · ");
      weatherSource.textContent = "天气数据来自 Open-Meteo · 画面不是实时摄像头";
    } catch (error) {
      weather.textContent = "静态体验模式";
      weatherSource.textContent = "当前未连接天气服务，先显示静态画面";
    }
  }

  function stopAmbient() {
    if (!ambient) return;
    try { ambient.source.stop(); } catch {}
    ambient.source.disconnect();
    ambient.filter.disconnect();
    ambient.gain.disconnect();
    ambient = null;
    soundButton.setAttribute("aria-pressed", "false");
    soundButton.querySelector("b").textContent = "听一段古镇情境";
  }

  function startAmbient() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      status.textContent = "当前浏览器不支持情境声，但不会影响历史推演。";
      return;
    }
    leafAudioContext ||= new AudioContextClass();
    leafAudioContext.resume?.();
    const buffer = leafAudioContext.createBuffer(1, leafAudioContext.sampleRate * 2, leafAudioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = leafAudioContext.createBufferSource();
    const filter = leafAudioContext.createBiquadFilter();
    const gain = leafAudioContext.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 760;
    filter.Q.value = 0.48;
    gain.gain.value = 0.016;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(leafAudioContext.destination);
    source.start();
    ambient = { source, filter, gain };
    soundButton.setAttribute("aria-pressed", "true");
    soundButton.querySelector("b").textContent = "让情境声停下";
  }

  function updateHistory(step) {
    currentStep = step;
    stage.dataset.step = String(step);
    const messages = [
      "从 1391 年开始。青岩最初不是景点，而是一座军堡。",
      "1391 年，贵州前卫设置青岩堡。这里先有军事据点，后来才慢慢发展成城镇。",
      "1853 年，当地人沿山修建石城墙，还设置了敌楼、垛口、炮台和壕沟。这些石头最初是为了防守。",
      "定广门连接着贵阳通往定番、广顺的道路。粮食、货物和人口不断进城，后来有了会馆、庙宇、书院和市场。"
    ];
    const descriptions = [
      "尚未开始。先在交通与山势交会处设置青岩堡。",
      "第一步完成：1391 年设置青岩堡。",
      "第二步完成：沿山势出现石城墙、关隘、敌楼与壕沟。",
      "第三步完成：定广门连接粮道和商路，城外出现市场与公共建筑。"
    ];
    status.textContent = messages[step];
    mapDescription.textContent = descriptions[step];
    historyButtons.forEach((button, index) => {
      const buttonStep = index + 1;
      button.disabled = buttonStep > step + 1;
      button.setAttribute("aria-pressed", String(buttonStep <= step));
    });
    if (step === 3) {
      completeLeafInteraction(shell, node.id, "你已经看完青岩的三步变化：先有军堡，再有石城，最后因为交通和贸易发展成古镇。今天看到的城墙、城门和多种建筑，都来自这段变化。");
    }
  }

  historyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const step = Number(button.dataset.historyStep);
      if (step > currentStep + 1) return;
      updateHistory(step);
    });
  });
  soundButton.addEventListener("click", () => ambient ? stopAmbient() : startAmbient());

  resetButton.addEventListener("click", () => {
    shell.querySelector(".leaf-keepsake")?.remove();
    delete shell.dataset.complete;
    updateHistory(0);
    historyButtons[0].focus();
  });

  updateLocalTime();
  const clockTimer = window.setInterval(updateLocalTime, 60_000);
  updateHistory(0);
  loadWeather();
  activeLeafInteractionCleanup = () => {
    window.clearInterval(clockTimer);
    stopAmbient();
  };
}

function renderLeafInteraction(node) {
  activeLeafInteractionCleanup?.();
  activeLeafInteractionCleanup = null;
  const shell = document.querySelector("#interactive-leaf");
  const config = LEAF_INTERACTIONS[node.id];
  shell.replaceChildren();
  shell.hidden = !config;
  shell.className = config ? `interactive-leaf interaction-${config.type}` : "interactive-leaf";
  delete shell.dataset.complete;
  if (!config) return;
  shell.dataset.everCompleted = String(completedLeafInteractions.has(node.id));
  createLeafInteractionHeader(node, config, shell);
  if (config.type === "archaeology") renderArchaeologyInteraction(node, shell);
  if (config.type === "embroidery") renderEmbroideryInteraction(node, shell);
  if (config.type === "dong-song") renderDongSongInteraction(node, shell);
  if (config.type === "qingyan-history") renderQingyanHistoryInteraction(node, shell);
}

function renderPlaceGuide(node, detail, plateAsset) {
  const container = document.querySelector("#place-guide");
  const guide = detail.placeGuide;
  container.replaceChildren();
  container.hidden = !guide;
  if (!guide) return;

  const heading = document.createElement("header");
  heading.className = "place-guide-heading";
  const headingCopy = document.createElement("div");
  const kicker = document.createElement("span");
  const title = document.createElement("h2");
  const intro = document.createElement("p");
  kicker.textContent = guide.kicker || "去这里 · PLACE GUIDE";
  title.textContent = guide.title || node.name;
  intro.textContent = guide.intro || node.summary;
  headingCopy.append(kicker, title, intro);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "place-save-button";
  saveButton.innerHTML = `<span aria-hidden="true">⌑</span><b>${bookmarks.has(node.id) ? "已收藏" : "收藏这一页"}</b>`;
  saveButton.addEventListener("click", () => document.querySelector("#bookmark-button").click());
  heading.append(headingCopy, saveButton);

  const facts = document.createElement("dl");
  facts.className = "place-facts";
  (guide.facts || []).forEach((fact) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = fact.label;
    description.textContent = fact.value;
    item.append(term, description);
    facts.append(item);
  });

  const media = document.createElement("section");
  media.className = "place-media";
  const mediaHeader = document.createElement("header");
  const mediaTitle = document.createElement("b");
  const mediaNote = document.createElement("span");
  mediaTitle.textContent = "先看现场，再决定怎么走";
  mediaNote.textContent = guide.mediaNote || "同一现场图的整体与局部观察";
  mediaHeader.append(mediaTitle, mediaNote);

  const mosaic = document.createElement("div");
  mosaic.className = "place-media-mosaic";
  (guide.media || []).forEach((item, index) => {
    const figure = document.createElement("figure");
    figure.className = `place-media-frame ${item.size === "wide" ? "is-wide" : ""}`.trim();
    const image = document.createElement("img");
    const caption = document.createElement("figcaption");
    const marker = document.createElement("span");
    const copy = document.createElement("b");
    image.src = item.src || plateAsset.src;
    image.alt = `${node.name}现场观察：${item.title}`;
    image.style.objectPosition = item.position || plateAsset.position;
    marker.textContent = `${padPage(index + 1)} · ${item.kind || "现场图"}`;
    copy.textContent = item.title;
    caption.append(marker, copy);
    figure.append(image, caption);
    mosaic.append(figure);
  });

  const movingImage = document.createElement("article");
  movingImage.className = "place-moving-image";
  const movingCopy = document.createElement("div");
  const movingKicker = document.createElement("span");
  const movingTitle = document.createElement("h3");
  const movingDescription = document.createElement("p");
  const movingToggle = document.createElement("button");
  const movingDetail = document.createElement("p");
  const feature = guide.mediaFeature || {};
  movingKicker.textContent = feature.label || "现场影像";
  movingTitle.textContent = feature.title || "用一段影像进入现场";
  movingDescription.textContent = feature.description || "视频与直播根据景区实际内容接入。";
  movingToggle.type = "button";
  movingToggle.setAttribute("aria-expanded", "false");
  movingToggle.innerHTML = `<i aria-hidden="true">▶</i><span>${feature.action || "查看影像入口"}</span>`;
  movingDetail.className = "place-moving-detail";
  movingDetail.hidden = true;
  movingDetail.textContent = feature.detail || "原型阶段暂未接入外部视频。正式版有稳定直播时显示直播，否则展示短视频或航拍记录。";
  movingToggle.addEventListener("click", () => {
    const expanded = movingToggle.getAttribute("aria-expanded") === "true";
    movingToggle.setAttribute("aria-expanded", String(!expanded));
    movingDetail.hidden = expanded;
    movingImage.classList.toggle("is-open", !expanded);
  });
  movingCopy.append(movingKicker, movingTitle, movingDescription);
  movingImage.append(movingCopy, movingToggle, movingDetail);
  mosaic.append(movingImage);

  media.append(mediaHeader, mosaic);

  const visit = document.createElement("section");
  visit.className = "place-visit-plan";
  const visitHeader = document.createElement("header");
  const visitKicker = document.createElement("span");
  const visitTitle = document.createElement("h3");
  visitKicker.textContent = "怎么逛 · FIELD ROUTE";
  visitTitle.textContent = guide.routeTitle || "别急着找景，先学会看证据";
  visitHeader.append(visitKicker, visitTitle);
  const route = document.createElement("ol");
  (guide.route || []).forEach((step) => {
    const item = document.createElement("li");
    const stepTitle = document.createElement("b");
    const stepCopy = document.createElement("p");
    stepTitle.textContent = step.title;
    stepCopy.textContent = step.body;
    item.append(stepTitle, stepCopy);
    route.append(item);
  });
  visit.append(visitHeader, route);

  const tips = document.createElement("dl");
  tips.className = "place-tips";
  (guide.tips || []).forEach((tip) => {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = tip.label;
    description.textContent = tip.value;
    item.append(term, description);
    tips.append(item);
  });

  container.append(heading, facts, media, visit, tips);
}

function renderStorySections(detail, layout, node) {
  const container = document.querySelector("#story-sections");
  container.replaceChildren();

  if (layout === "karst-waterbook") {
    container.className = "story-sections karst-waterbook";

    const opening = document.createElement("section");
    opening.className = "waterbook-opening";
    const openingKicker = document.createElement("span");
    const openingTitle = document.createElement("h3");
    const openingCopy = document.createElement("p");
    openingKicker.textContent = detail.story?.kicker || "现场故事";
    openingTitle.textContent = detail.story?.title || "跟着水进入山腹";
    openingCopy.textContent = detail.story?.body || "";
    opening.append(openingKicker, openingTitle, openingCopy);

    const profile = document.createElement("section");
    profile.className = "karst-water-profile";
    const profileHeader = document.createElement("header");
    const profileKicker = document.createElement("span");
    const profileTitle = document.createElement("h3");
    profileKicker.textContent = "本页主线 · WATER PATH";
    profileTitle.textContent = "水没有消失，只是换到地下继续走";
    profileHeader.append(profileKicker, profileTitle);
    const waterPath = document.createElement("ol");
    (detail.waterPath || []).forEach((step) => {
      const item = document.createElement("li");
      const label = document.createElement("span");
      const title = document.createElement("b");
      const copy = document.createElement("p");
      label.textContent = step.label;
      title.textContent = step.title;
      copy.textContent = step.body;
      item.append(label, title, copy);
      waterPath.append(item);
    });
    profile.append(profileHeader, waterPath);

    const processNotes = document.createElement("div");
    processNotes.className = "water-process-notes";
    (detail.sections || []).slice(0, 3).forEach((section, index) => {
      const article = document.createElement("article");
      const number = document.createElement("span");
      const title = document.createElement("h3");
      const copy = document.createElement("p");
      number.textContent = `水路 ${padPage(index + 1)}`;
      title.textContent = section.title;
      copy.textContent = section.body;
      article.append(number, title, copy);
      processNotes.append(article);
    });

    const compare = document.createElement("aside");
    compare.className = "waterbook-compare";
    const compareKicker = document.createElement("span");
    const compareTitle = document.createElement("h3");
    const compareCopy = document.createElement("p");
    compareKicker.textContent = detail.compareNote?.kicker || "相邻一程";
    compareTitle.textContent = detail.compareNote?.title || "";
    compareCopy.textContent = detail.compareNote?.body || "";
    compare.append(compareKicker, compareTitle, compareCopy);

    const chronicle = document.createElement("section");
    chronicle.className = "waterbook-chronicle";
    const chronicleHeader = document.createElement("header");
    const chronicleKicker = document.createElement("span");
    const chronicleTitle = document.createElement("h3");
    chronicleKicker.textContent = "两则小史 · MODERN FIELD STORY";
    chronicleTitle.textContent = "景区开放以后，水仍然决定人能走到哪里";
    chronicleHeader.append(chronicleKicker, chronicleTitle);
    const chronicleList = document.createElement("div");
    (detail.sections || []).slice(3).forEach((section, index) => {
      const article = document.createElement("article");
      const number = document.createElement("span");
      const title = document.createElement("h3");
      const copy = document.createElement("p");
      number.textContent = String(index + 1).padStart(2, "0");
      title.textContent = section.title;
      copy.textContent = section.body;
      article.append(number, title, copy);
      chronicleList.append(article);
    });
    chronicle.append(chronicleHeader, chronicleList);

    const culture = document.createElement("aside");
    culture.className = "waterbook-culture-note";
    const cultureKicker = document.createElement("span");
    const cultureTitle = document.createElement("h3");
    const cultureCopy = document.createElement("p");
    cultureKicker.textContent = detail.cultureNote?.kicker || "文化辨析";
    cultureTitle.textContent = detail.cultureNote?.title || "";
    cultureCopy.textContent = detail.cultureNote?.body || "";
    culture.append(cultureKicker, cultureTitle, cultureCopy);

    container.append(opening, profile, processNotes, compare, chronicle, culture);
    return;
  }

  if (layout === "archaeology-evidence") {
    container.className = "story-sections archaeology-story";

    const storyOpening = document.createElement("section");
    storyOpening.className = "archaeology-story-opening";
    const storyKicker = document.createElement("span");
    const storyTitle = document.createElement("h3");
    const storyCopy = document.createElement("p");
    storyKicker.textContent = detail.story?.kicker || "文化深读";
    storyTitle.textContent = detail.story?.title || "这个洞穴为什么重要？";
    storyCopy.textContent = detail.story?.body || detail.sections?.[0]?.body || "";
    storyOpening.append(storyKicker, storyTitle, storyCopy);

    const evidence = document.createElement("section");
    evidence.className = "evidence-chain";
    const evidenceHeader = document.createElement("header");
    const evidenceKicker = document.createElement("span");
    const evidenceTitle = document.createElement("h3");
    evidenceKicker.textContent = "本页主角 · EVIDENCE CHAIN";
    evidenceTitle.textContent = detail.evidenceQuestion || "考古判断是怎样形成的？";
    evidenceHeader.append(evidenceKicker, evidenceTitle);
    const evidenceList = document.createElement("ol");
    (detail.evidenceChain || []).forEach((step) => {
      const item = document.createElement("li");
      const title = document.createElement("b");
      const copy = document.createElement("p");
      title.textContent = step.title;
      copy.textContent = step.body;
      item.append(title, copy);
      evidenceList.append(item);
    });
    evidence.append(evidenceHeader, evidenceList);

    const anecdote = document.createElement("aside");
    anecdote.className = "unknown-story";
    const anecdoteKicker = document.createElement("span");
    const anecdoteTitle = document.createElement("h3");
    const anecdoteCopy = document.createElement("p");
    anecdoteKicker.textContent = detail.anecdote?.kicker || "鲜为人知";
    anecdoteTitle.textContent = detail.anecdote?.title || "";
    anecdoteCopy.textContent = detail.anecdote?.body || "";
    anecdote.append(anecdoteKicker, anecdoteTitle, anecdoteCopy);

    const boundary = document.createElement("section");
    boundary.className = "knowledge-boundary";
    const boundaryLabel = document.createElement("span");
    const boundaryTitle = document.createElement("h3");
    const boundaryCopy = document.createElement("p");
    boundaryLabel.textContent = "我们还不知道什么";
    boundaryTitle.textContent = detail.sections?.[2]?.title || "未知也应被保留";
    boundaryCopy.textContent = detail.sections?.[2]?.body || "";
    boundary.append(boundaryLabel, boundaryTitle, boundaryCopy);

    container.append(storyOpening, evidence, anecdote, boundary);
    return;
  }

  container.className = `story-sections ${layout} depth-${node.contentDepth || "brief"}`;
  let fieldOpening = null;
  if (node.contentDepth === "deep" && (node?.canvas?.scene || node?.listen)) {
    const opening = document.createElement("aside");
    opening.className = "field-story-opening";
    const tape = document.createElement("i");
    tape.setAttribute("aria-hidden", "true");
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const copy = document.createElement("p");
    const isAttraction = contentKindFor(node) === "attractions";
    kicker.textContent = detail.story?.kicker || (isAttraction
      ? "抵达手记 · ARRIVAL NOTE"
      : "从一个动作，走进这页文化");
    title.textContent = detail.story?.title || node.canvas?.entryObject || node.name;
    copy.textContent = detail.story?.body || (isAttraction
      ? `抵达${node.name}时，画面先是这样的：${node.canvas?.scene}。${node.listen}`
      : `这页从“${node.canvas?.entryObject || node.name}”开始：${node.canvas?.scene}。${node.listen}`);
    opening.append(tape, kicker, title, copy);
    fieldOpening = opening;
  }
  const sectionLabels = STORY_SECTION_LABELS[layout] || [];
  (detail.sections || []).forEach((section, index) => {
    const article = document.createElement("section");
    const number = document.createElement("span");
    const title = document.createElement("h3");
    const bodyCopy = document.createElement("p");
    article.dataset.section = String(index + 1);
    if (section.kind) article.dataset.kind = section.kind;
    number.textContent = section.kind === "completion" ? "完成度" : (sectionLabels[index] || padPage(index + 1));
    title.textContent = section.title;
    bodyCopy.textContent = section.body;
    article.append(number, title, bodyCopy);
    container.append(article);
  });

  const bridge = node.contentDepth === "catalog" ? null : cultureBridgeFor(node);
  if (bridge) {
    const aside = document.createElement("aside");
    aside.className = "field-culture-bridge";
    const kicker = document.createElement("span");
    const title = document.createElement("h3");
    const copy = document.createElement("p");
    const action = document.createElement("button");
    kicker.textContent = contentKindFor(node) === "attractions" ? "这个地方还连着另一处" : "这条线索还连着另一种生活";
    title.textContent = `从${node.name}翻到${bridge.node.name}`;
    copy.textContent = `${bridge.reason}。${bridge.node.summary}`;
    action.type = "button";
    action.textContent = `沿线翻到「${bridge.node.name}」 →`;
    action.addEventListener("click", () => insertAndOpen(bridge.node, "next"));
    aside.append(kicker, title, copy, action);
    container.append(aside);
  }
  if (fieldOpening) container.insertBefore(fieldOpening, container.children[1] || null);
}

function renderVisualFocus(detail, node, plateAsset) {
  const container = document.querySelector("#visual-focus");
  container.replaceChildren();
  const items = detail.visualFocus || [];
  const canShowContactSheet = node?.contentDepth !== "catalog" && !detail.placeGuide && node && plateAsset?.src;
  container.hidden = items.length === 0 && !canShowContactSheet;
  if (container.hidden) return;

  if (items.length) {
    const label = document.createElement("b");
    label.textContent = "看这张图时，先找三件事";
    const list = document.createElement("ol");
    items.forEach((item) => {
      const entry = document.createElement("li");
      entry.textContent = item;
      list.append(entry);
    });
    container.append(label, list);
  }

  if (canShowContactSheet) {
    const contactSheet = document.createElement("div");
    contactSheet.className = "field-contact-sheet";
    const companions = visualCompanions(node, plateAsset);
    companions.forEach((companion, index) => {
      const figure = document.createElement("figure");
      const image = document.createElement("img");
      const caption = document.createElement("figcaption");
      const marker = document.createElement("span");
      const copy = document.createElement("b");
      image.src = companion.asset.src;
      image.alt = `${node.name}的延伸画面：${companion.node.name}`;
      image.style.objectPosition = companion.asset.position || "50% 50%";
      marker.textContent = index === 0 ? "相关文化" : "附近地点";
      copy.textContent = companion.node.name;
      caption.append(marker, copy);
      figure.append(image, caption);
      contactSheet.append(figure);
    });
    container.append(contactSheet);
  }
}

function renderFieldGuide(detail, layout, node) {
  const list = document.querySelector("#field-guide-list");
  const container = list.closest(".field-guide");
  const layoutCopy = PAGE_LAYOUT_COPY[layout] || PAGE_LAYOUT_COPY["archive-dossier"];
  container.dataset.layout = layout;
  container.dataset.depth = node.contentDepth || "brief";
  container.querySelector(":scope > span").textContent = node.contentDepth === "catalog"
    ? "补写清单"
    : node.contentDepth === "brief" ? "现场观察" : layoutCopy.fieldLabel;
  document.querySelector("#field-guide-title").textContent = node.contentDepth === "catalog"
    ? "公开发布前，还缺三组证据"
    : node.contentDepth === "brief" ? "沿着已有线索，确认这三件事" : layoutCopy.fieldTitle;
  list.replaceChildren();
  (detail.fieldGuide || []).forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note;
    list.append(item);
  });
}

function renderSourceLinks(detail) {
  const container = document.querySelector("#source-links");
  container.replaceChildren();
  (detail.sourceIds || []).forEach((sourceId) => {
    const source = sourceCatalog[sourceId];
    if (!source) return;
    const link = document.createElement("a");
    const code = document.createElement("span");
    const title = document.createElement("b");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    code.textContent = sourceId;
    title.textContent = source.title;
    link.append(code, title);
    container.append(link);
  });

  if (!container.children.length) {
    const empty = document.createElement("p");
    empty.textContent = "详细来源仍待内容审核者登记。";
    container.append(empty);
  }
}

function plateAssetFor(node) {
  const group = groupForCatalog(node);
  const dedicatedAsset = NODE_PLATE_ASSETS[node.id];
  if (dedicatedAsset) return { ...dedicatedAsset, isRelatedFallback: false };

  const pool = GROUP_REAL_PLATE_FALLBACKS[group] || GROUP_REAL_PLATE_FALLBACKS.history;
  const groupNodes = activeNodes().filter((candidate) => groupForCatalog(candidate) === group);
  const dedicatedSources = new Set(
    groupNodes.map((candidate) => NODE_PLATE_ASSETS[candidate.id]?.src).filter(Boolean)
  );
  const availablePool = pool.filter((referenceId) => !dedicatedSources.has(NODE_PLATE_ASSETS[referenceId]?.src));
  const poolCandidates = availablePool.length ? availablePool : pool;
  const seenPoolSources = new Set();
  const fallbackPool = poolCandidates.filter((referenceId) => {
    const source = NODE_PLATE_ASSETS[referenceId]?.src;
    if (!source || seenPoolSources.has(source)) return false;
    seenPoolSources.add(source);
    return true;
  });
  const fallbackNodes = groupNodes.filter((candidate) => !NODE_PLATE_ASSETS[candidate.id]);
  const fallbackIndex = fallbackNodes.findIndex((candidate) => candidate.id === node.id);
  const seed = stableNodeHash(`${node.cityId || "guizhou"}:${node.id}:${node.name}`);
  const referenceId = fallbackPool[(fallbackIndex >= 0 ? fallbackIndex : seed) % fallbackPool.length];
  const referenceAsset = NODE_PLATE_ASSETS[referenceId];
  return {
    ...referenceAsset,
    kind: `同主题真实场景参考 · ${referenceAsset.kind || "实景资料"}`,
    sourceName: `${referenceAsset.sourceName || "真实资料图"} · 非该节点独立现场照`,
    isRelatedFallback: true,
    referenceId
  };
}

const GENERATED_COVER_PALETTES = {
  scenery: ["#c7d7c4", "#507162", "#e6d9b9", "#25473e"],
  history: ["#dcc9a7", "#795b43", "#eee2c8", "#3e352d"],
  red: ["#d5b2a0", "#8d3d32", "#ead9bf", "#4e2e2a"],
  village: ["#d5cba9", "#66724e", "#efe2c5", "#3e4b39"],
  heritage: ["#d6bed2", "#77506f", "#ede0c7", "#443342"],
  food: ["#dfc49f", "#a15f3c", "#f0dfbe", "#593a2c"],
  industry: ["#bac7c3", "#4d6663", "#ded8c4", "#31413f"],
  today: ["#d8bda7", "#9b5440", "#e9d8bd", "#493a35"]
};

function stableNodeHash(value) {
  return [...String(value)].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
}

function escapeSvgText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function generatedCoverMotif(group, seed) {
  const shift = seed % 19;
  const common = `stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
  if (group === "scenery") {
    return `<path d="M-8 72 Q25 ${35 + shift} 51 67 T110 ${40 + (shift / 2)} T170 70 V112 H-8Z" fill="currentColor" opacity=".27"/><path d="M-6 88 Q25 ${65 + (shift / 3)} 56 87 T120 82 T168 86" fill="none" ${common} opacity=".72"/>`;
  }
  if (group === "village") {
    return `<path d="M9 76 35 ${48 - (shift / 4)} 61 76M25 76v25h22V76M66 70l25-25 29 25M78 70v31h31V70M116 80l18-18 19 18M124 80v21h22V80" fill="none" ${common} opacity=".78"/>`;
  }
  if (group === "heritage") {
    const offset = 8 + (shift / 3);
    const heritageMotifs = [
      `<g fill="none" ${common} opacity=".78"><path d="M${offset} 20 42 54 ${offset} 88-20 54Z"/><path d="M42 20 76 54 42 88 8 54Z"/><path d="M76 20 110 54 76 88 42 54Z"/><path d="M110 20 144 54 110 88 76 54Z"/></g>`,
      `<g fill="none" ${common} opacity=".76"><path d="M8 38c15-18 29 18 44 0s29 18 44 0 29 18 48 0"/><path d="M8 58c15-18 29 18 44 0s29 18 44 0 29 18 48 0"/><path d="M8 78c15-18 29 18 44 0s29 18 44 0 29 18 48 0"/></g>`,
      `<g fill="none" ${common} opacity=".78"><path d="M43 20Q80 ${8 + (shift / 2)} 117 20l-8 66Q80 108 51 86Z"/><path d="M58 50q12-12 22 0m1 0q12-12 22 0M69 73q11 9 22 0"/><path d="M80 19v75" opacity=".42"/></g>`,
      `<g fill="none" ${common} opacity=".76"><path d="M18 19v76M35 14v86M52 21v74M69 12v88M86 18v77M103 14v86M120 21v74M137 13v87"/><path d="M10 39h140M10 64h140M10 88h140" opacity=".44"/></g>`
    ];
    return heritageMotifs[seed % heritageMotifs.length];
  }
  if (group === "food") {
    return `<path d="M24 62h96c-7 29-23 42-48 42S31 91 24 62Z" fill="currentColor" opacity=".22"/><path d="M24 62h96M42 46c-8-11 8-17 1-29M70 43c-8-12 9-18 1-31M98 46c-8-11 8-17 1-29" fill="none" ${common} opacity=".78"/>`;
  }
  if (group === "industry") {
    return `<path d="M15 101V50h24v51M46 101V32h31v69M85 101V58h23v43M115 101V42h29v59M10 101h140" fill="none" ${common} opacity=".72"/><circle cx="61" cy="20" r="7" fill="currentColor" opacity=".34"/>`;
  }
  if (group === "today") {
    return `<path d="M12 101V58h25v43M43 101V38h31v63M81 101V51h22v50M111 101V28h35v73" fill="currentColor" opacity=".22"/><path d="M22 70h6m25-17h11m27 13h3m28-21h13" ${common} opacity=".82"/>`;
  }
  return `<path d="M15 101h132M29 101V46l24-17 24 17v55M85 101V55l20-14 23 14v46M17 57h58M91 67h31" fill="none" ${common} opacity=".75"/><circle cx="128" cy="25" r="${8 + (shift / 3)}" fill="currentColor" opacity=".25"/>`;
}

function generatedNodeCoverAsset(node, group = groupForCatalog(node)) {
  const seed = stableNodeHash(`${node.id}:${node.name}`);
  const palette = GENERATED_COVER_PALETTES[group] || GENERATED_COVER_PALETTES.history;
  const mirrored = seed % 2 === 0 ? "" : 'transform="translate(160 0) scale(-1 1)"';
  const mark = escapeSvgText((node.name || "黔").slice(0, 1));
  const motif = generatedCoverMotif(group, seed);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 112"><defs><pattern id="grain" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".55" fill="${palette[3]}" opacity=".13"/></pattern></defs><rect width="160" height="112" fill="${palette[0]}"/><path d="M0 ${35 + (seed % 28)} 160 ${10 + (seed % 31)}V112H0Z" fill="${palette[2]}" opacity=".72"/><g color="${palette[1]}" ${mirrored}>${motif}</g><rect width="160" height="112" fill="url(#grain)"/><g transform="translate(125 11) rotate(${(seed % 7) - 3})"><rect width="24" height="25" fill="${palette[2]}" fill-opacity=".74" stroke="${palette[1]}" stroke-width="1"/><text x="12" y="18" text-anchor="middle" fill="${palette[3]}" font-family="serif" font-size="15">${mark}</text></g></svg>`;
  return {
    src: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    position: "50% 50%",
    kind: "节点视觉封面",
    sourceName: `${node.name}主题视觉 · 独立实景图待核验后替换`
  };
}

function updatePage(node) {
  currentNode = node;
  closeChapterIndex({ preserveTabs: true });
  const group = groupForCatalog(node);
  const chapter = CHAPTERS[group];
  const detail = detailFor(node);
  const layout = pageLayoutFor(node, detail);
  const isCatalog = node.contentDepth === "catalog";
  const leftPage = Math.max(1, trailIndex * 2 + 1);
  document.documentElement.dataset.contentKind = contentKindFor(node);
  document.documentElement.dataset.contentDepth = node.contentDepth || "brief";

  document.querySelector("#folio-domain").textContent = node.domain;
  document.querySelector("#folio-left").textContent = padPage(leftPage);
  document.querySelector("#folio-right").textContent = padPage(leftPage + 1);
  document.querySelector("#chapter-index").textContent = chineseChapter(chapterOrder(group));
  document.querySelector("#chapter-domain").textContent = chapter.title;
  document.querySelector("#culture-title").textContent = detail.story?.pageTitle || node.name;
  document.querySelector("#culture-summary").textContent = detail.story?.deck || node.summary;
  document.querySelector("#culture-listen").textContent = node.listen;
  document.querySelector("#plate-glyph").textContent = chapter.glyph;
  document.querySelector("#plate-object").textContent = isCatalog ? node.name : node.canvas.entryObject;
  document.querySelector("#plate-node-id").textContent = node.id;
  const culturePlate = document.querySelector("#culture-plate");
  document.querySelector("#visual-page").dataset.layout = layout;
  document.querySelector("#story-page").dataset.layout = layout;
  const layoutCopy = PAGE_LAYOUT_COPY[layout] || PAGE_LAYOUT_COPY["archive-dossier"];
  document.querySelector("#plate-register-label").textContent = isCatalog ? "目录图版 · CATALOG NOTE" : layoutCopy.plate;
  document.querySelector(".visual-caption > p").textContent = isCatalog ? "收录说明 · CONTENT STATUS" : layoutCopy.visual;
  document.querySelector(".continue-reading").lastChild.textContent = isCatalog ? " 这是一条目录线索" : ` ${layoutCopy.continue}`;
  const plateImage = document.querySelector("#plate-image");
  const plateAsset = plateAssetFor(node);
  document.querySelector("#plate-scene").textContent = isCatalog
    ? (plateAsset.isRelatedFallback ? "同主题真实场景参考，独立现场仍待核验" : "已绑定真实资料图，现场观察仍待补")
    : node.canvas.scene;
  culturePlate.dataset.group = group;
  culturePlate.dataset.node = node.id;
  plateImage.src = plateAsset.src;
  plateImage.alt = isCatalog
    ? (plateAsset.isRelatedFallback ? `${node.name}同主题真实场景参考图` : `${node.name}真实资料图`)
    : `${node.name}${contentKindFor(node) === "attractions" ? "名胜" : "文化"}图版：${node.canvas.scene}`;
  plateImage.style.objectPosition = plateAsset.position;
  document.querySelector("#plate-kind").textContent = plateAsset.kind || detail.visual?.kind || "真实资料图";
  document.querySelector("#plate-credit").textContent = isCatalog
    ? (plateAsset.isRelatedFallback ? "真实照片 · 仅作同主题参考，不冒充本项目现场" : (plateAsset.sourceName || "真实资料图"))
    : (detail.visualFocus?.[0] || node.canvas?.entryObject || "先看整体，再找细节");
  document.querySelector("#evidence-stamp").textContent = evidenceLabel(node.status);
  document.querySelector("#source-confirmed").textContent = isCatalog
    ? `${evidenceLabel(node.status)}。本页已登记 ${(detail.sourceIds || []).length} 组城市级来源，景点级证据与正文仍待补齐。`
    : `${evidenceLabel(node.status)}。本页正文整理自 ${(detail.sourceIds || []).length} 组资料，详细条目列在下方。`;
  document.querySelector("#source-expression-label").textContent = isCatalog ? "视觉说明" : "情境重构说明";
  document.querySelector("#source-expression-copy").textContent = isCatalog
    ? "左页是目录识别图，不是景点实景；实景素材完成授权与核验后再替换。"
    : "只负责把已有事实讲清楚，不冒充照片、口述或历史记录。";

  const keywords = document.querySelector("#visual-keywords");
  keywords.replaceChildren();
  const visualKeywords = isCatalog ? ["待补实景", "待核游线", "待补正文"] : (node.see || []).slice(0, 5);
  visualKeywords.forEach((keyword) => {
    const span = document.createElement("span");
    span.textContent = keyword;
    keywords.append(span);
  });

  const bookmarkButton = document.querySelector("#bookmark-button");
  const isBookmarked = bookmarks.has(node.id);
  bookmarkButton.setAttribute("aria-pressed", String(isBookmarked));
  bookmarkButton.querySelector("b").textContent = isBookmarked ? "已收藏" : "收藏这一页";
  document.querySelector(".margin-note").hidden = node.contentDepth !== "deep";

  renderPlaceGuide(node, detail, plateAsset);
  renderCultureMeta(detail);
  renderLeafInteraction(node);
  renderStorySections(detail, layout, node);
  renderVisualFocus(detail, node, plateAsset);
  renderFieldGuide(detail, layout, node);
  renderSourceLinks(detail);
  renderThreads(node);
  updateChapterTabs(group);
  renderPlaceTabs(group, node.id);
  document.querySelector("#visual-page").scrollTop = 0;
  document.querySelector("#story-page").scrollTop = 0;
}

function animateTo(node, direction = "next") {
  window.clearTimeout(pageTimer);
  turningLeaf.className = `turning-leaf is-turning-${direction}`;
  const midpoint = reduceMotion ? 0 : 250;
  pageTimer = window.setTimeout(() => {
    updatePage(node);
    if (mobileQuery.matches) body.dataset.mobileLeaf = "visual";
  }, midpoint);
  window.setTimeout(() => {
    turningLeaf.className = "turning-leaf";
  }, reduceMotion ? 30 : 580);
}

function openTrailIndex(index, direction = "next") {
  if (index < 0 || index >= trail.length) return;
  trailIndex = index;
  const node = nodeById.get(trail[trailIndex]);
  if (node) animateTo(node, direction);
}

function insertAndOpen(node, direction = "next") {
  const existingIndex = trail.indexOf(node.id);
  if (existingIndex >= 0) {
    openTrailIndex(existingIndex, existingIndex < trailIndex ? "prev" : direction);
  } else {
    trail.splice(trailIndex + 1, 0, node.id);
    openTrailIndex(trailIndex + 1, direction);
  }
  closePanels();
}

function nextNode() {
  if (!currentNode) return;

  if (mobileQuery.matches && body.dataset.mobileLeaf === "visual") {
    body.dataset.mobileLeaf = "story";
    document.querySelector("#story-page").scrollTop = 0;
    return;
  }

  if (trailIndex < trail.length - 1) {
    openTrailIndex(trailIndex + 1, "next");
    return;
  }

  const relation = relatedNodes(currentNode)[0];
  const scopedNodes = activeNodes();
  const fallbackIndex = (scopedNodes.indexOf(currentNode) + 1) % scopedNodes.length;
  insertAndOpen(relation?.node || scopedNodes[fallbackIndex], "next");
}

function previousNode() {
  if (mobileQuery.matches && body.dataset.mobileLeaf === "story") {
    body.dataset.mobileLeaf = "visual";
    document.querySelector("#visual-page").scrollTop = 0;
    return;
  }

  if (trailIndex > 0) openTrailIndex(trailIndex - 1, "prev");
  else showToast("这里是你这次阅读的第一页");
}

function openBook(startNode) {
  const scopedNodes = activeNodes();
  if (!scopedNodes.length) return;
  body.dataset.state = "open";
  body.dataset.mobileLeaf = "visual";
  syncBookAccessibility();
  if (trail.length === 0) {
    const first = startNode && nodeBelongsToSelectedCity(startNode) ? startNode : scopedNodes[0];
    trail = [first.id];
    trailIndex = 0;
    updatePage(first);
  } else if (startNode) {
    insertAndOpen(startNode, "next");
  }
  window.setTimeout(() => spread.focus?.(), reduceMotion ? 0 : 500);
}

function closeBook() {
  closeChapterIndex();
  closePanels();
  stopNarration();
  body.dataset.state = "closed";
  body.dataset.mobileLeaf = "visual";
  syncBookAccessibility();
  cover.focus();
}

function renderChapterTabs() {
  const container = document.querySelector("#chapter-tabs");
  container.replaceChildren();
  Object.entries(CHAPTERS).forEach(([group, chapter]) => {
    const count = activeNodes().filter((node) => groupForCatalog(node) === group).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chapter-tab";
    button.dataset.group = group;
    button.disabled = count === 0;
    button.innerHTML = `<span>${chapter.label}</span><small>${count}</small>`;
    button.title = count ? `${chapter.title} · ${count} 页` : `${chapter.title} · 待补充`;
    button.setAttribute("aria-label", count ? `${chapter.title}，${count}页` : `${chapter.title}，暂无内容`);
    button.addEventListener("click", () => openChapterIndex(group));
    container.append(button);
  });
}

function renderPlaceTabs(group, activeNodeId = null) {
  if (!placeTabs) return;
  const chapter = CHAPTERS[group];
  const entries = chapter
    ? activeNodes().filter((node) => groupForCatalog(node) === group)
    : [];

  placeTabs.replaceChildren();
  placeTabs.dataset.group = group || "";
  placeTabs.hidden = entries.length === 0;
  if (!entries.length) return;

  placeTabs.setAttribute("aria-label", `${chapter.title}，${entries.length}个可直接跳转的景点与条目`);
  entries.forEach((node) => {
    const button = document.createElement("button");
    const name = document.createElement("span");
    const number = document.createElement("small");
    const isActive = node.id === activeNodeId;

    button.type = "button";
    button.className = "place-tab";
    button.dataset.nodeId = node.id;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
    button.setAttribute("aria-label", `直接翻到${node.name}`);
    button.title = `${node.name} · ${node.domain}`;
    name.textContent = node.name;
    number.textContent = padPage(activeNodes().indexOf(node) + 1);
    button.append(name, number);
    button.addEventListener("click", () => {
      closeChapterIndex({ preserveTabs: true });
      insertAndOpen(node, "next");
    });
    placeTabs.append(button);
  });
}

function updateChapterTabs(group) {
  document.querySelectorAll(".chapter-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.group === group);
  });
}

function closeChapterIndex({ preserveTabs = false } = {}) {
  chapterIndexGroup = null;
  body.dataset.pageMode = "entry";
  chapterIndexSpread.classList.remove("is-open");
  chapterIndexSpread.setAttribute("aria-hidden", "true");
  chapterIndexSpread.inert = true;
  if (!preserveTabs && currentNode) updateChapterTabs(groupForCatalog(currentNode));
}

function buildChapterIndexEntry(node) {
  const button = document.createElement("button");
  const number = document.createElement("span");
  const photo = document.createElement("img");
  const copy = document.createElement("span");
  const domain = document.createElement("small");
  const name = document.createElement("b");
  const summary = document.createElement("p");
  const arrow = document.createElement("i");
  const asset = plateAssetFor(node);

  button.type = "button";
  button.className = "chapter-index-entry";
  button.setAttribute("aria-label", `翻到${node.name}`);
  number.className = "chapter-index-number";
  number.textContent = padPage(activeNodes().indexOf(node) + 1);
  photo.src = asset.src;
  photo.alt = asset.isRelatedFallback ? `${node.name}同主题真实场景参考图` : `${node.name}真实资料图`;
  photo.loading = "lazy";
  photo.style.objectPosition = asset.position;
  domain.textContent = `${contentDepthLabel(node)} · ${node.domain}`;
  name.textContent = node.name;
  summary.textContent = node.summary;
  arrow.textContent = "→";
  copy.append(domain, name, summary);
  button.append(number, photo, copy, arrow);
  button.addEventListener("click", () => {
    closeChapterIndex();
    insertAndOpen(node, "next");
  });
  return button;
}

function renderChapterIndex(group) {
  const chapter = CHAPTERS[group];
  if (!chapter) return;
  const entries = activeNodes().filter((node) => groupForCatalog(node) === group);
  const rowCount = Math.ceil(entries.length / 2);
  const list = document.querySelector("#chapter-index-list");

  document.querySelector("#chapter-index-glyph").textContent = chapter.glyph;
  document.querySelector("#chapter-index-kicker").textContent = chineseChapter(chapterOrder(group));
  document.querySelector("#chapter-index-title").textContent = chapter.title;
  document.querySelector("#chapter-index-description").textContent = chapter.description;
  document.querySelector("#chapter-index-count").textContent = String(entries.length);
  document.querySelector("#chapter-index-folio").textContent = `目${padPage(chapterOrder(group))}`;
  chapterIndexSpread.dataset.group = group;
  list.style.gridTemplateRows = `repeat(${rowCount}, minmax(0, 1fr))`;
  list.replaceChildren(...entries.map(buildChapterIndexEntry));
  document.querySelectorAll(".chapter-index-page").forEach((page) => { page.scrollTop = 0; });
}

function openChapterIndex(group) {
  if (!CHAPTERS[group] || !activeNodes().length) return;
  if (body.dataset.state === "closed") openBook();
  stopNarration();
  closePanels();
  chapterIndexGroup = group;
  renderChapterIndex(group);
  body.dataset.pageMode = "index";
  chapterIndexSpread.classList.add("is-open");
  chapterIndexSpread.setAttribute("aria-hidden", "false");
  chapterIndexSpread.inert = false;
  updateChapterTabs(group);
  renderPlaceTabs(group, currentNode && groupForCatalog(currentNode) === group ? currentNode.id : null);
  window.setTimeout(() => chapterIndexSpread.querySelector("button")?.focus({ preventScroll: true }), reduceMotion ? 0 : 320);
}

function stopNarration() {
  window.speechSynthesis?.cancel();
  audioRibbon.hidden = true;
}

function narrateCurrent() {
  if (!currentNode) {
    openBook();
    window.setTimeout(narrateCurrent, reduceMotion ? 0 : 650);
    return;
  }

  stopNarration();
  document.querySelector("#audio-copy").textContent = currentNode.listen;
  audioRibbon.hidden = false;
  if (!("speechSynthesis" in window)) {
    showToast("当前浏览器不支持语音朗读，讲述文字已经留在页边");
    return;
  }

  const utterance = new SpeechSynthesisUtterance(`${currentNode.name}。${currentNode.summary}${currentNode.listen}`);
  utterance.lang = "zh-CN";
  utterance.rate = 0.88;
  const voice = window.speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith("zh"));
  if (voice) utterance.voice = voice;
  utterance.addEventListener("end", () => { audioRibbon.hidden = true; });
  window.speechSynthesis.speak(utterance);
}

function selectCityJournal(cityId, { resetBook = true } = {}) {
  const nextCity = cityJournalById.get(cityId);
  if (!nextCity) return false;
  const changed = selectedCityId !== nextCity.id;
  selectedCityId = nextCity.id;
  try {
    localStorage.setItem(CITY_JOURNAL_STORAGE_KEY, selectedCityId);
  } catch {
    // 无持久化权限时仍允许本次切换。
  }
  if (changed && resetBook) {
    closeChapterIndex();
    closePanels();
    stopNarration();
    trail = [];
    trailIndex = -1;
    currentNode = null;
    body.dataset.state = "closed";
    body.dataset.mobileLeaf = "visual";
    syncBookAccessibility();
  }
  applyEditionCopy();
  renderChapterTabs();
  if (changed) renderPlaceTabs(null);
  return true;
}

function setJournalMode(mode) {
  const nextMode = mode === "book" ? "book" : "library";
  const isLibrary = nextMode === "library";
  body.dataset.journalMode = nextMode;
  const gallery = document.querySelector("#city-journal-gallery");
  const bookStage = document.querySelector("#book-stage");
  const back = document.querySelector("#return-to-city-library");
  gallery?.setAttribute("aria-hidden", String(!isLibrary));
  bookStage?.setAttribute("aria-hidden", String(isLibrary));
  if (gallery) gallery.inert = !isLibrary;
  if (bookStage) bookStage.inert = isLibrary;
  if (back) back.hidden = isLibrary;
  if (isLibrary && body.dataset.state === "open") {
    closeChapterIndex();
    closePanels();
    stopNarration();
    body.dataset.state = "closed";
    body.dataset.mobileLeaf = "visual";
    syncBookAccessibility();
  }
}

function openCityJournalLibrary() {
  setProductView("journal");
  setJournalMode("library");
  window.setTimeout(() => document.querySelector(".city-gallery-book")?.focus({ preventScroll: true }), reduceMotion ? 0 : 180);
}

function openJournalForCity(cityId) {
  if (!selectCityJournal(cityId)) return;
  setProductView("journal");
  setJournalMode("book");
  window.setTimeout(() => cover?.focus({ preventScroll: true }), reduceMotion ? 0 : 180);
}

function workspaceModulePanels() {
  return {
    map: travelMapStage,
    journal: document.querySelector("#workspace-panel-journal"),
    agent: journeyBriefPanel
  };
}

function updateWorkspaceModuleSummaries() {
  const journalSummary = document.querySelector("#workspace-journal-summary");
  const agentStatus = document.querySelector("#workspace-agent-status");
  const agentThought = document.querySelector("#workspace-agent-thought");
  const agentLocation = document.querySelector("#workspace-agent-location");
  const agentFreshness = document.querySelector("#workspace-agent-freshness");

  if (journalSummary) {
    const pageLabel = document.querySelector("#user-journal-page-label")?.textContent?.trim() || "封面";
    journalSummary.textContent = `${pageLabel} · ${userJournalStatusText}`;
  }
  if (agentStatus) {
    agentStatus.textContent = body.classList.contains("is-ai-travelling")
      ? phaseLabel(personalJourney?.state?.phase) || "正在路上"
      : "静候启程";
  }
  if (agentThought) agentThought.textContent = document.querySelector("#ajing-thought")?.textContent?.trim() || "先让真实的路和天气，决定今天会变成什么样。";
  if (agentFreshness) {
    const updatedAt = personalJourney?.agent?.lastRun?.at
      || personalJourney?.embodiment?.updatedAt
      || personalJourney?.state?.lastSyncedAt;
    agentFreshness.textContent = body.classList.contains("is-ai-travelling")
      ? relativeJourneyUpdate(updatedAt).replace("更新", "")
      : "阿镜尚未启程";
  }
  if (agentLocation) {
    const location = document.querySelector("#travel-location")?.textContent?.trim() || "贵阳";
    agentLocation.textContent = `贵州 · ${location}`;
  }
}

function setUserJournalStatus(status) {
  userJournalStatusText = status;
  updateWorkspaceModuleSummaries();
}

function syncWorkspaceModuleAccessibility() {
  const activeModule = body.dataset.workspaceModule || "journal";
  const desktopWorkspace = !mobileQuery.matches;
  const panels = workspaceModulePanels();

  workspaceModuleButtons.forEach((button) => {
    const active = button.dataset.workspaceModuleTarget === activeModule;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });

  Object.entries(panels).forEach(([module, panel]) => {
    if (!panel) return;
    const hidden = desktopWorkspace && module !== activeModule;
    panel.setAttribute("aria-hidden", String(hidden));
    panel.inert = hidden;
  });
}

function setWorkspaceModule(module, { focus = false } = {}) {
  const panels = workspaceModulePanels();
  if (!panels[module]) return;
  if (module === "map") {
    if (body.dataset.workspaceModule !== "map") workspaceModuleBeforeMap = body.dataset.workspaceModule || "journal";
    body.dataset.workspaceModule = "map";
    syncWorkspaceModuleAccessibility();
    updateWorkspaceModuleSummaries();
    setTravelMapExpanded(true);
    return;
  }
  if (travelMapExpanded) setTravelMapExpanded(false);
  body.dataset.workspaceModule = module;
  syncWorkspaceModuleAccessibility();
  updateWorkspaceModuleSummaries();

  window.setTimeout(() => {
    if (module === "map") {
      travelMap?.resize();
      if (travelMapFollowing) recenterTravelMap(false);
    }
    if (focus) panels[module]?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 280);
}

function initializeWorkspaceModules() {
  if (!workspaceModuleRail) return;
  workspaceModuleButtons.forEach((button) => {
    button.addEventListener("click", () => setWorkspaceModule(button.dataset.workspaceModuleTarget));
  });
  workspaceModuleRail.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = Math.max(0, workspaceModuleButtons.indexOf(document.activeElement));
    const moveForward = ["ArrowDown", "ArrowRight"].includes(event.key);
    let nextIndex = event.key === "Home" ? 0 : event.key === "End" ? workspaceModuleButtons.length - 1 : currentIndex + (moveForward ? 1 : -1);
    nextIndex = (nextIndex + workspaceModuleButtons.length) % workspaceModuleButtons.length;
    const nextButton = workspaceModuleButtons[nextIndex];
    setWorkspaceModule(nextButton.dataset.workspaceModuleTarget);
    nextButton.focus();
  });

  const summaryObserver = new MutationObserver(updateWorkspaceModuleSummaries);
  [journeyBriefPanel, document.querySelector("#user-journal-page-label"), document.querySelector("#map-compact-status")]
    .filter(Boolean)
    .forEach((element) => summaryObserver.observe(element, { childList: true, subtree: true, characterData: true }));
  mobileQuery.addEventListener?.("change", syncWorkspaceModuleAccessibility);
  updateWorkspaceModuleSummaries();
  syncWorkspaceModuleAccessibility();
  const requestedModule = pageParams.get("module");
  if (["journal", "agent"].includes(requestedModule)) setWorkspaceModule(requestedModule);
}

function setProductView(view) {
  const nextView = view === "journal" ? "journal" : "travel";
  body.dataset.view = nextView;
  const city = selectedCity();
  document.title = nextView === "journal"
    ? `黔境｜${city.name}城市文化旅行指南`
    : "云游四方｜阿镜的远方生活与九城文化指南";
  const isTravel = nextView === "travel";
  travelHome?.setAttribute("aria-hidden", String(!isTravel));
  journalApp?.setAttribute("aria-hidden", String(isTravel));
  if (travelHome) travelHome.inert = !isTravel;
  if (journalApp) journalApp.inert = isTravel;
  if (isTravel) {
    closePanels();
    stopNarration();
    window.setTimeout(() => {
      travelMap?.resize();
    }, 0);
  }
}

function showTravelToast(message) {
  if (!travelToast) return;
  travelToast.textContent = message;
  travelToast.classList.add("is-visible");
  window.clearTimeout(travelToastTimer);
  travelToastTimer = window.setTimeout(() => travelToast.classList.remove("is-visible"), 2600);
}

function journalElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
}

function safeJournalUrl(value) {
  try {
    const url = new URL(String(value || ""), window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function getStoredPersonalJourneyId() {
  try { return window.localStorage.getItem(PERSONAL_JOURNEY_ID_STORAGE_KEY); } catch { return null; }
}

function rememberPersonalJourneyId(id) {
  try { window.localStorage.setItem(PERSONAL_JOURNEY_ID_STORAGE_KEY, id); } catch {
    // 无本地存储权限时，本次页面仍可继续使用旅程对象。
  }
}

async function requestJournalApi(url, options = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs || 150000);
  try {
    const response = await fetch(url, {
      ...options,
      headers: { "content-type": "application/json", ...(options.headers || {}) },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

function removeGeneratedJournalSpreads() {
  document.querySelectorAll("[data-generated-journal]").forEach((spread) => spread.remove());
}

function journalPageNumber(value) {
  return String(value).padStart(2, "0");
}

function appendJournalSpread(article, label, facingPage = null) {
  const book = document.querySelector("#user-journal-book");
  const nextButton = document.querySelector("#user-journal-next");
  if (!book || !nextButton) return null;
  const page = Math.max(1, ...[...book.querySelectorAll("[data-user-journal-spread]")]
    .map((spread) => Number(spread.dataset.userJournalSpread) + 1)
    .filter(Number.isFinite));
  const spread = journalElement("div", "user-journal-spread");
  spread.dataset.userJournalSpread = String(page);
  spread.dataset.generatedJournal = "true";
  spread.dataset.journalLabel = label;
  spread.setAttribute("aria-hidden", "true");
  const pages = Array.isArray(article) ? article : [article, facingPage].filter(Boolean);
  spread.append(...pages);
  book.insertBefore(spread, nextButton);
  return page;
}

function journalDateAtOffset(date, offsetDays) {
  const value = new Date(Date.UTC(Number(date.year), Number(date.month) - 1, Number(date.day) + offsetDays, 4));
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short"
  }).formatToParts(value);
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return { key: `${year}-${month}-${day}`, year, month, day, weekday: part("weekday") };
}

function cloneJournalEntryForDay(entry, date, isBackfilled) {
  const clock = entryClock(entry).match(/\d{2}:\d{2}/)?.[0] || "10:00";
  const originalDate = journalLocalDay(entry);
  const localTime = {
    ...(entry.context?.localTime || {}),
    iso: `${date.key}T${clock}:00+08:00`,
    localText: `${date.year}/${date.month}/${date.day}${date.weekday || ""} ${clock}:00`
  };
  const retimeText = (value) => {
    if (!isBackfilled || typeof value !== "string") return value;
    const replacements = [
      [`${originalDate.year}/${originalDate.month}/${originalDate.day}`, `${date.year}/${date.month}/${date.day}`],
      [`${originalDate.year}-${originalDate.month}-${originalDate.day}`, date.key],
      [`${Number(originalDate.month)}月${Number(originalDate.day)}日`, `${Number(date.month)}月${Number(date.day)}日`],
      [`${originalDate.month}/${originalDate.day}`, `${date.month}/${date.day}`],
      [originalDate.weekday, date.weekday]
    ].filter(([from, to]) => from && to && from !== to);
    return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
  };
  const content = Object.fromEntries(Object.entries(entry.content || {}).map(([key, value]) => [key, retimeText(value)]));
  return {
    ...entry,
    content,
    context: { ...(entry.context || {}), localTime },
    meta: { ...(entry.meta || {}), journalBackfilled: isBackfilled, generatedAt: localTime.iso }
  };
}

function backfillJournalDays(entries, days) {
  if (days.length !== 1 || entries.length < 4) return days;
  const latestDate = days[0].date;
  const targetDates = [-3, -2, -1, 0].map((offset) => journalDateAtOffset(latestDate, offset));
  const baseSize = Math.floor(entries.length / targetDates.length);
  let remainder = entries.length % targetDates.length;
  let cursor = 0;
  return targetDates.map((date, index) => {
    const size = baseSize + (remainder-- > 0 ? 1 : 0);
    const bucket = entries.slice(cursor, cursor + size);
    cursor += size;
    return {
      date: { ...date, isBackfilled: index < targetDates.length - 1 },
      entries: bucket.map((entry) => cloneJournalEntryForDay(entry, date, index < targetDates.length - 1))
    };
  });
}

function createJourneyFootprintArchivePage(days, activeDayIndex, page, firstDaySpreadPage = 1) {
  const firstDate = days[0]?.date;
  const lastDate = days.at(-1)?.date;
  const article = journalElement("article", "user-journal-page journal-facing-page journal-footprint-archive-page");
  article.setAttribute("aria-label", `${firstDate?.month || ""}月${firstDate?.day || ""}日至${lastDate?.day || ""}日的每日旅行足迹`);
  article.append(journalPageIndex("每日足迹 · DAILY TRACE", page + 1));

  const body = journalElement("div", "journal-footprint-archive-body");
  const heading = journalElement("header", "journal-footprint-archive-heading");
  heading.append(
    journalElement("small", "", "A JOURNEY, DAY BY DAY"),
    journalElement("h2", "", `${firstDate?.month || ""}月${firstDate?.day || ""}日—${lastDate?.day || ""}日`),
    journalElement("p", "", "每一天走过的地方，都单独留下一张日页。")
  );

  const list = document.createElement("ol");
  list.className = "journal-day-traces";
  for (const [index, day] of days.entries()) {
    const routeNames = day.entries.map((entry) => entry.locationName).filter((name, routeIndex, all) => name && name !== all[routeIndex - 1]);
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const targetSpreadPage = firstDaySpreadPage + index;
    button.dataset.journalTarget = String(targetSpreadPage);
    button.setAttribute("aria-label", `翻到${day.date.month}月${day.date.day}日：${routeNames.join("到")}`);
    if (index === activeDayIndex) button.setAttribute("aria-current", "page");

    const date = journalElement("time", "", `${day.date.month}/${day.date.day}`);
    date.dateTime = day.date.key;
    const copy = journalElement("span", "journal-day-trace-copy");
    copy.append(
      journalElement("small", "", `${day.date.weekday || `第 ${index + 1} 天`}${day.date.isBackfilled ? " · 阿镜补记" : " · 今日"}`),
      journalElement("b", "", routeNames.join(" → ") || "这一天还在路上"),
      journalElement("em", "", `${day.entries.length} 站 · 已装订成日页`)
    );
    button.append(date, copy, journalElement("i", "", index === activeDayIndex ? "●" : "○"));
    button.addEventListener("click", () => renderUserJournalPage(targetSpreadPage));
    item.append(button);
    list.append(item);
  }

  const totalStops = days.reduce((sum, day) => sum + day.entries.length, 0);
  const footer = journalElement("footer", "journal-footprint-archive-footer");
  footer.append(
    journalElement("span", "", `${days.length} 天 · ${totalStops} 站`),
    journalElement("b", "", "点一天，翻回那张日页")
  );
  body.append(heading, list, footer);
  article.append(body);
  return article;
}

function journalPageIndex(kicker, page) {
  const index = journalElement("p", "journal-page-index");
  index.append(journalElement("span", "", kicker), journalElement("b", "", journalPageNumber(page)));
  return index;
}

function entryClock(entry) {
  const text = entry?.context?.localTime?.localText || "";
  return text.match(/\d{2}:\d{2}/)?.[0] || "刚刚整理";
}

function journalEntryTimestamp(entry) {
  return Date.parse(entry?.context?.localTime?.iso || entry?.meta?.generatedAt || "") || 0;
}

function journalLocalDay(entry) {
  const localText = entry?.context?.localTime?.localText || "";
  const localMatch = localText.match(/(\d{4})[/.年-](\d{1,2})[/.月-](\d{1,2})/);
  const weekday = localText.match(/周[一二三四五六日天]/)?.[0] || "";
  if (localMatch) {
    const [, year, rawMonth, rawDay] = localMatch;
    const month = String(rawMonth).padStart(2, "0");
    const day = String(rawDay).padStart(2, "0");
    return { key: `${year}-${month}-${day}`, year, month, day, weekday };
  }
  const parsed = new Date(entry?.context?.localTime?.iso || entry?.meta?.generatedAt || Date.now());
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: entry?.context?.localTime?.timezone || "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short"
  }).formatToParts(parsed);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  const year = value("year");
  const month = value("month");
  const day = value("day");
  return { key: `${year}-${month}-${day}`, year, month, day, weekday: value("weekday") };
}

function groupJournalEntriesByDay(entries) {
  const groups = new Map();
  for (const entry of [...entries].sort((a, b) => journalEntryTimestamp(a) - journalEntryTimestamp(b) || a.routeOrder - b.routeOrder)) {
    const date = journalLocalDay(entry);
    if (!groups.has(date.key)) groups.set(date.key, { date, entries: [] });
    groups.get(date.key).entries.push(entry);
  }
  return [...groups.values()];
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

function appendDailyJournalSources(parent, entries) {
  const sourceMap = new Map();
  for (const entry of entries) {
    for (const source of entry.sources || []) {
      const key = source.url || source.title;
      if (key && !sourceMap.has(key)) sourceMap.set(key, source);
    }
  }
  if (!sourceMap.size) return;
  const details = journalElement("details", "daily-journal-sources");
  const summary = journalElement("summary", "", `这一页从哪里来 · ${sourceMap.size} 条可核对来源`);
  const list = journalElement("div", "daily-journal-source-list");
  let index = 0;
  for (const source of sourceMap.values()) {
    index += 1;
    const url = safeJournalUrl(source.url);
    const element = url ? document.createElement("a") : document.createElement("span");
    if (url) {
      element.href = url;
      element.target = "_blank";
      element.rel = "noreferrer noopener";
    }
    element.textContent = `[${index}] ${source.title}`;
    list.append(element);
  }
  details.append(summary, list);
  parent.append(details);
}

function dailyJournalProvenance(entries, date) {
  if (date?.isBackfilled || entries.some((entry) => entry?.meta?.journalBackfilled)) {
    return {
      kind: "backfilled",
      label: "阿镜补记",
      detail: "根据已经保存的路线，补回这一天的足迹"
    };
  }
  const generatedCount = entries.filter((entry) => entry?.meta?.modelUsed === true).length;
  if (generatedCount === entries.length) {
    return {
      kind: "ai",
      label: "阿镜手记",
      detail: "沿路线、时间、天气与地方资料写成"
    };
  }
  if (generatedCount > 0) {
    return {
      kind: "mixed",
      label: "阿镜手记",
      detail: "其中一部分沿已经保存的旅程记录补全"
    };
  }
  return {
    kind: "fallback",
    label: "旅途底稿",
    detail: "沿已确认的路线与地方资料写成"
  };
}

function createDailyJourneyPage(day, pageNumber, dayNumber) {
  const entries = day.entries;
  const first = entries[0];
  const last = entries.at(-1);
  const routeNames = entries.map((entry) => entry.locationName).filter((name, index, all) => name && name !== all[index - 1]);
  const weatherLabels = [...new Set(entries.map((entry) => {
    const weather = entry.context?.weather;
    return weather?.condition ? `${weather.condition} ${Math.round(weather.temperatureC)}℃` : "";
  }).filter(Boolean))];
  const article = journalElement("article", `user-journal-page daily-journal-page${entries.length > 2 ? " is-dense" : ""}`);
  article.dataset.journalDay = day.date.key;

  const masthead = journalElement("header", "daily-journal-masthead");
  const dayMark = journalElement("div", "daily-journal-daymark");
  dayMark.append(
    journalElement("small", "", `DAY ${journalPageNumber(dayNumber)}`),
    journalElement("b", "", day.date.day),
    journalElement("span", "", `${day.date.month}月 · ${day.date.weekday || "旅行日"}`)
  );
  const heading = journalElement("div", "daily-journal-heading");
  const provenanceData = dailyJournalProvenance(entries, day.date);
  const provenance = journalElement("div", "daily-journal-provenance");
  provenance.dataset.kind = provenanceData.kind;
  provenance.title = provenanceData.detail;
  provenance.setAttribute("aria-label", `${provenanceData.label}：${provenanceData.detail}`);
  provenance.append(
    journalElement("b", "", provenanceData.label),
    journalElement("span", "", provenanceData.detail)
  );
  heading.append(
    journalElement("p", "daily-journal-kicker", `${day.date.year} · 阿镜的一日行旅`),
    journalElement("h2", "", entries.length === 1 ? first.content.headline : `从${first.locationName}走到${last.locationName}`),
    provenance
  );
  const pageMark = journalElement("div", "daily-journal-page-no");
  pageMark.append(journalElement("small", "", "JOURNAL"), journalElement("b", "", journalPageNumber(pageNumber)));
  masthead.append(dayMark, heading, pageMark);

  const scroller = journalElement("div", "daily-journal-scroll");
  const hero = journalElement("section", "daily-journal-hero");
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.src = safeJournalUrl(first.image?.url) || "/prototype/assets/cloud-wayfarer-world-v1.png";
  image.alt = first.image?.alt || `${first.locationName}旅行手账情境图`;
  image.loading = "lazy";
  const caption = journalElement("figcaption");
  caption.append(
    journalElement("span", "", first.image?.type === "ai-generated" ? "情境重构图 · 非实景" : "项目资料图"),
    document.createTextNode(first.image?.caption || `${first.locationName} · 非实景证据`)
  );
  figure.append(image, caption);
  const voice = journalElement("blockquote", "daily-journal-voice");
  voice.append(
    journalElement("small", "", "阿镜在路上说"),
    journalElement("p", "", last.content.postcardLine || first.content.deck),
    journalElement("footer", "", weatherLabels.join(" · ") || `${entries.length} 个时间节点`)
  );
  hero.append(figure, voice);

  const route = journalElement("div", "daily-journal-route");
  route.append(journalElement("span", "", "TODAY'S TRACE"));
  for (const [index, name] of routeNames.entries()) {
    if (index) route.append(journalElement("i", "", "→"));
    route.append(journalElement("b", "", name));
  }

  const timeline = document.createElement("ol");
  timeline.className = "daily-journal-timeline";
  for (const [index, entry] of entries.entries()) {
    const moment = document.createElement("li");
    moment.className = "daily-journal-moment";
    moment.append(journalElement("time", "", entryClock(entry)));
    const content = journalElement("div", "daily-journal-moment-copy");
    content.append(
      journalElement("small", "", `${entry.context?.localTime?.period || "此刻"} · ${entry.locationName}`),
      journalElement("h3", "", entry.content.headline),
      journalElement("p", "", entry.content.observation || entry.content.deck)
    );
    const notes = journalElement("div", "daily-journal-notes");
    const culture = journalElement("aside", "daily-journal-culture");
    culture.append(
      journalElement("small", "", "文化夹页 · 阿镜讲给你听"),
      journalElement("h4", "", entry.content.cultureTitle),
      journalElement("p", "", entry.content.cultureBody)
    );
    notes.append(culture);
    const taste = journalTaste(entry);
    if (taste) {
      const food = journalElement("aside", "daily-journal-taste");
      food.append(
        journalElement("small", "", "味觉记忆"),
        journalElement("h4", "", taste.title),
        journalElement("p", "", taste.body)
      );
      notes.append(food);
    }
    content.append(notes);
    if (index > 0 && entry.image?.url) {
      const snapshot = document.createElement("figure");
      snapshot.className = "daily-journal-snapshot";
      const snapshotImage = document.createElement("img");
      snapshotImage.src = safeJournalUrl(entry.image.url);
      snapshotImage.alt = entry.image.alt || `${entry.locationName}旅行手账情境图`;
      snapshotImage.loading = "lazy";
      snapshot.append(snapshotImage, journalElement("figcaption", "", entry.locationName));
      content.append(snapshot);
    }
    moment.append(content);
    timeline.append(moment);
  }

  const letter = journalElement("aside", "daily-journal-letter");
  letter.append(
    journalElement("small", "", "写给屏幕另一边的你"),
    journalElement("h3", "", last.content.letterTitle),
    journalElement("p", "", last.content.letterBody)
  );
  scroller.append(hero, route, timeline, letter);
  appendDailyJournalSources(scroller, entries);
  article.append(masthead, scroller);
  return article;
}

function createGenerationJournalPage(locationName, pageNumber, failed = false) {
  const article = journalElement("article", `user-journal-page waiting-page journal-generation-page${failed ? " is-failed" : ""}`);
  article.append(journalPageIndex(failed ? "这一页暂时没有寄回" : "旅程内容正在回流", pageNumber));
  const sheet = journalElement("div", "waiting-sheet");
  sheet.append(
    journalElement("i", "journal-generation-pulse"),
    journalElement("h2", "", failed ? `${locationName}这一页还没写成。` : `正在把${locationName}写进手账。`),
    journalElement("p", "", failed
      ? "已经写下的页面都还在。等一会儿，再把这一页接着写完。"
      : "地点、时间、天气和一路留下的资料，正在慢慢落到纸上。")
  );
  if (failed) {
    const retry = journalElement("button", "journal-generation-retry", "重新生成这一页");
    retry.type = "button";
    retry.dataset.journalRetry = "true";
    retry.dataset.locationId = Object.entries(JOURNEY_LOCATION_NAMES)
      .map(([id, name]) => [name, id])
      .find(([name]) => name === locationName)?.[1] || "guiyang";
    sheet.append(retry);
  }
  article.append(sheet);
  return article;
}

function getUserJournalMaxPage() {
  return Math.max(0, ...[...document.querySelectorAll("[data-user-journal-spread]")]
    .map((spread) => Number(spread.dataset.userJournalSpread))
    .filter(Number.isFinite));
}

function currentOnsiteStory() {
  const activeTopic = document.querySelector("[data-onsite-topic].is-active")?.dataset.onsiteTopic || "past";
  return ONSITE_STORIES[activeTopic] || ONSITE_STORIES.past;
}

function createOnsiteJournalPage(pageNumber) {
  const story = currentOnsiteStory();
  const article = journalElement("article", "user-journal-page onsite-journal-page");
  article.append(journalPageIndex("我的现场 · 海龙屯", pageNumber));
  const figure = document.createElement("figure");
  const image = document.createElement("img");
  image.src = onsitePhotoPreview?.src || "assets/hailongtun-now-web.jpg";
  image.alt = "用户在海龙屯现场留下的照片";
  const caption = journalElement("figcaption");
  caption.append(journalElement("span", "", "我拍下的此刻"), document.createTextNode("遵义 · 海龙屯"));
  figure.append(image, caption);
  const note = journalElement("div", "onsite-journal-note");
  note.append(
    journalElement("small", "", story.type),
    journalElement("h2", "", story.title),
    journalElement("p", "", document.querySelector("#onsite-story-copy")?.textContent || story.copy),
    journalElement("span", "", story.source.join(" · "))
  );
  article.append(figure, note);
  return article;
}

const JOURNEY_LOCATION_NAMES = Object.fromEntries(
  Object.entries(EXPLORATION_LOCATIONS).map(([id, location]) => [id, location.name])
);

function phaseLabel(phase) {
  return {
    draft: "等待出发",
    travelling: "正在路上",
    arrived: "刚刚抵达",
    waiting_decision: "在这一站停留",
    paused: "旅程已暂停",
    completed: "第一程已完成"
  }[phase] || "正在生活";
}

function agentEnvironmentText(environment) {
  const weather = environment?.weather;
  if (!weather?.available) return `${environment?.season || "此刻"} · 天气待确认`;
  const parts = [weather.condition];
  if (Number.isFinite(weather.apparentTemperatureC)) parts.push(`体感 ${Math.round(weather.apparentTemperatureC)}℃`);
  if (Number.isFinite(weather.relativeHumidityPercent)) parts.push(`湿度 ${Math.round(weather.relativeHumidityPercent)}%`);
  if (Number.isFinite(weather.windKph)) parts.push(`风 ${Math.round(weather.windKph)}km/h`);
  return parts.join(" · ");
}

function setTouristMomentText(selector, value) {
  const element = document.querySelector(selector);
  if (element && value) element.textContent = value;
}

function renderJourneyRouteLedger(journey) {
  const state = journey?.state || {};
  const route = Array.isArray(journey?.route) ? journey.route : [];
  const originId = state.originLocationId || route[0] || state.currentLocationId || "guiyang";
  const originName = JOURNEY_LOCATION_NAMES[originId] || originId;
  const currentName = JOURNEY_LOCATION_NAMES[state.currentLocationId] || state.currentLocationId || originName;
  const nextId = state.nextLocationRevealed === false ? null : state.nextLocationId;
  const nextName = nextId ? (JOURNEY_LOCATION_NAMES[nextId] || nextId) : "还在这一站慢慢决定";
  const decision = journey?.agent?.lastRun?.decision || {};
  const nextReason = nextId
    ? String(state.explorationIntent || decision.nextStopReason || "沿着这一刻真正关心的线索继续走。").replace(/[。]+$/g, "")
    : "天气、身体和刚刚遇见的事，会一起决定方向";
  const nextLabel = state.phase === "travelling" ? "正在前往" : "下一站";

  setTouristMomentText("#journey-origin-name", originName);
  setTouristMomentText("#journey-next-label", nextLabel);
  setTouristMomentText("#journey-next-name", nextName);
  setTouristMomentText("#journey-next-reason", nextReason);
  setTouristMomentText("#ajing-window-kicker", `阿镜从${originName}出发 · 此刻`);
  const ledger = document.querySelector("#journey-route-ledger");
  if (ledger) ledger.setAttribute("aria-label", `本段旅程从${originName}出发，此刻在${currentName}，${nextLabel}${nextName}`);
}

function captureLiveFootprint() {
  const textSelectors = [
    "#ajing-window-kicker", "#journey-title", "#ajing-moment-time", "#ajing-event-title", "#ajing-thought",
    "#ajing-energy-note", "#ajing-comfort-note", "#ajing-scene-condition", "#ajing-choice-title",
    "#ajing-history-era", "#ajing-history-title", "#ajing-history-summary", "#ajing-history-image-note",
    "#ajing-history-kicker", "#ajing-history-copy"
  ];
  const imageSelectors = ["#ajing-scene-image", "#ajing-photo-2", "#ajing-photo-3", "#ajing-history-image"];
  return {
    text: Object.fromEntries(textSelectors.map((selector) => [selector, document.querySelector(selector)?.textContent || ""])),
    images: Object.fromEntries(imageSelectors.map((selector) => {
      const image = document.querySelector(selector);
      return [selector, { src: image?.getAttribute("src") || "", alt: image?.alt || "" }];
    }))
  };
}

function restoreLiveFootprint() {
  if (!liveFootprintSnapshot) return;
  Object.entries(liveFootprintSnapshot.text).forEach(([selector, value]) => setTouristMomentText(selector, value));
  Object.entries(liveFootprintSnapshot.images).forEach(([selector, value]) => {
    const image = document.querySelector(selector);
    if (!image) return;
    image.src = value.src;
    image.alt = value.alt;
  });
}

function clearHistoryFootprintStory() {
  const canvas = document.querySelector("#history-footprint-story");
  const stage = document.querySelector(".ajing-window");
  if (canvas) {
    canvas.hidden = true;
    canvas.className = "history-story-canvas";
    canvas.replaceChildren();
  }
  if (stage) delete stage.dataset.footprintLayout;
}

function historyVisitRecommendation(recommendation) {
  return `
    <aside class="history-local-encounter">
      <figure><img src="${recommendation.image}" alt="${recommendation.name}"></figure>
      <div>
        <small>${recommendation.eyebrow}</small>
        <h4>${recommendation.name}</h4>
        <p>${recommendation.copy}</p>
        <span>${recommendation.meta}</span>
        <button type="button" data-history-save aria-pressed="false">${recommendation.action} <i aria-hidden="true">＋</i></button>
      </div>
    </aside>
  `;
}

function historyShippingRecommendation(recommendation) {
  return `
    <aside class="history-parcel-recommendation">
      <span class="history-parcel-string" aria-hidden="true"></span>
      <figure><img src="${recommendation.image}" alt="${recommendation.name}"></figure>
      <div>
        <small>${recommendation.eyebrow}</small>
        <h4>${recommendation.name}</h4>
        <p>${recommendation.copy}</p>
        <b>${recommendation.meta}</b>
        <details>
          <summary>${recommendation.action} <i aria-hidden="true">↗</i></summary>
          <p>第一版会跳转淘宝或抖音完成规格、地址、支付、物流与售后；云游四方不保存收货地址。</p>
          <span>合作推荐 · 商品与价格均为样机数据</span>
        </details>
      </div>
    </aside>
  `;
}

function renderHistoryFootprintStory(footprint) {
  const canvas = document.querySelector("#history-footprint-story");
  const stage = document.querySelector(".ajing-window");
  const story = footprint?.story;
  if (!canvas || !stage || !story) {
    clearHistoryFootprintStory();
    return;
  }
  stage.dataset.footprintLayout = footprint.layout || "field-note";
  canvas.hidden = false;
  canvas.className = `history-story-canvas is-${footprint.layout || "field-note"}`;

  if (footprint.layout === "cave-notebook") {
    canvas.innerHTML = `
      <header class="history-story-register"><span>${story.register}</span><b>01 / UNDERGROUND</b></header>
      <div class="history-cave-reading">
        <article>
          <small>先告诉你，这里到底是什么</small>
          <h3>${story.heading}</h3>
          <p>${story.friend}</p>
          <div class="history-cave-facts">${story.facts.map((fact) => `<span>${fact}</span>`).join("")}</div>
        </article>
        <aside>
          <small>如果你以后真的来</small>
          <ol>${story.fieldGuide.map((item, index) => `<li><i>0${index + 1}</i><span>${item}</span></li>`).join("")}</ol>
        </aside>
      </div>
      <footer class="history-story-source"><span>我从哪里知道的</span><b>${story.source}</b><i>资料已入库 · 现场仍需以景区公告为准</i></footer>
    `;
  } else if (footprint.layout === "street-letter") {
    canvas.innerHTML = `
      <header class="history-story-register"><span>${story.register}</span><b>02 / OLD CITY</b></header>
      <div class="history-street-reading">
        <article class="history-friend-letter">
          <span class="history-letter-pin" aria-hidden="true"></span>
          <small>我想像朋友一样跟你讲</small>
          <h3>${story.heading}</h3>
          <p>${story.friend}</p>
          <footer>${story.source}</footer>
        </article>
        <ol class="history-route-timeline" aria-label="把遵义会议放回行军时间线">
          ${story.timeline.map((item, index) => `<li><time>0${index + 1}</time><span>${item}</span></li>`).join("")}
        </ol>
        ${historyVisitRecommendation(story.recommendation)}
      </div>
    `;
  } else if (footprint.layout === "tea-parcel") {
    canvas.innerHTML = `
      <header class="history-story-register"><span>${story.register}</span><b>03 / FROM THE HILLSIDE</b></header>
      <div class="history-tea-reading">
        <article>
          <small>不是先看商品，是先看它怎么长</small>
          <h3>${story.heading}</h3>
          <p>${story.friend}</p>
          <ol>${story.steps.map((item, index) => `<li><i>${index + 1}</i><span>${item}</span></li>`).join("")}</ol>
          <footer>${story.source}</footer>
        </article>
        ${historyShippingRecommendation(story.recommendation)}
      </div>
    `;
  } else if (footprint.layout === "night-postcard") {
    canvas.innerHTML = `
      <header class="history-story-register"><span>${story.register}</span><b>04 / AFTER DARK</b></header>
      <div class="history-night-reading">
        <article class="history-night-postcard">
          <small>写给今晚没有在这里的你</small>
          <h3>${story.heading}</h3>
          <p>${story.friend}</p>
          <footer>${story.source}</footer>
        </article>
        <aside class="history-sound-strip">
          <small>我替你听见的</small>
          ${story.sound.map((item) => `<span><i aria-hidden="true"></i>${item}</span>`).join("")}
        </aside>
        ${historyVisitRecommendation(story.recommendation)}
      </div>
    `;
  }

  canvas.querySelectorAll("[data-history-save]").forEach((button) => {
    button.addEventListener("click", () => {
      const saved = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(saved));
      button.innerHTML = saved ? `已经夹进清单 <i aria-hidden="true">✓</i>` : `${story.recommendation.action} <i aria-hidden="true">＋</i>`;
      showTravelToast(saved ? "已经替你夹进未来到访清单" : "已经从未来到访清单取下");
    });
  });
}

function renderHistoryFootprint(footprint) {
  if (!footprint || footprint.isLive) return;
  renderHistoryFootprintStory(footprint);
  setTouristMomentText("#ajing-window-kicker", footprint.kicker);
  setTouristMomentText("#journey-title", footprint.location);
  setTouristMomentText("#ajing-moment-time", `${footprint.time} · 历史旅程状态`);
  setTouristMomentText("#ajing-event-title", footprint.title);
  setTouristMomentText("#ajing-thought", footprint.thought);
  setTouristMomentText("#ajing-energy-note", footprint.energy);
  setTouristMomentText("#ajing-comfort-note", footprint.comfort);
  setTouristMomentText("#ajing-scene-condition", footprint.condition);
  setTouristMomentText("#ajing-choice-title", footprint.next);

  footprint.gallery.forEach(([src, alt, label, copy], index) => {
    const image = document.querySelector(index === 0 ? "#ajing-scene-image" : `#ajing-photo-${index + 1}`);
    if (image) {
      image.src = src;
      image.alt = alt;
    }
    setTouristMomentText(`#ajing-photo-label-${index + 1}`, label);
    setTouristMomentText(`#ajing-photo-copy-${index + 1}`, copy);
  });

  const history = footprint.history;
  setTouristMomentText("#ajing-history-era", history.era);
  setTouristMomentText("#ajing-history-title", history.title);
  setTouristMomentText("#ajing-history-summary", history.summary);
  setTouristMomentText("#ajing-history-image-note", history.imageNote);
  setTouristMomentText("#ajing-history-kicker", history.kicker);
  setTouristMomentText("#ajing-history-copy", history.copy);
  const historyImage = document.querySelector("#ajing-history-image");
  if (historyImage) {
    historyImage.src = history.image;
    historyImage.alt = history.imageAlt;
  }
}

function setHistoryFootprintPanelOpen(open) {
  const trigger = document.querySelector("#history-footprint-trigger");
  const panel = document.querySelector("#history-footprint-panel");
  if (!trigger || !panel) return;
  trigger.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
  document.body.classList.toggle("is-history-footprint-open", open);
  if (open) window.requestAnimationFrame(() => panel.querySelector('[aria-selected="true"]')?.focus());
}

function selectHistoryFootprint(id) {
  const footprint = HISTORY_FOOTPRINTS.find((item) => item.id === id) || HISTORY_FOOTPRINTS[0];
  const stage = document.querySelector(".ajing-window");
  activeHistoryFootprintId = footprint.id;
  document.body.classList.toggle("is-history-footprint-preview", !footprint.isLive);
  document.body.dataset.historyFootprint = footprint.id;
  document.querySelectorAll(".history-footprint-item[data-history-footprint]").forEach((button) => {
    const selected = button.dataset.historyFootprint === footprint.id;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  setTouristMomentText("#history-footprint-trigger-note", footprint.isLive ? "回看走过的片刻" : `${footprint.date} · ${footprint.time}`);
  stage?.classList.add("is-footprint-changing");
  window.setTimeout(() => {
    if (footprint.isLive) {
      clearHistoryFootprintStory();
      if (personalJourney?.state) renderTouristMoment(personalJourney);
      else restoreLiveFootprint();
      setTouristMomentText("#ajing-window-kicker", "阿镜在贵州 · 此刻");
    } else {
      renderHistoryFootprint(footprint);
    }
    stage?.classList.remove("is-footprint-changing");
  }, 120);
  setHistoryFootprintPanelOpen(false);
}

function initializeHistoryFootprints() {
  const list = document.querySelector("#history-footprint-list");
  const trigger = document.querySelector("#history-footprint-trigger");
  const close = document.querySelector("#history-footprint-close");
  if (!list || !trigger) return;
  liveFootprintSnapshot = captureLiveFootprint();
  HISTORY_FOOTPRINTS.forEach((footprint, index) => {
    const button = document.createElement("button");
    const thumbnail = footprint.image || footprint.gallery?.[0]?.[0] || "assets/attractions/CTY-003.jpg";
    button.type = "button";
    button.className = `history-footprint-item${footprint.isLive ? " is-live" : ""}${index === 0 ? " is-selected" : ""}`;
    button.dataset.historyFootprint = footprint.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === 0));
    button.innerHTML = `
      <span class="history-footprint-thumb"><img src="${thumbnail}" alt=""><i aria-hidden="true"></i></span>
      <span class="history-footprint-date"><b>${footprint.time}</b><small>${footprint.date}</small></span>
      <span class="history-footprint-copy"><b>${footprint.location}</b><small>${footprint.route}</small></span>
      <i class="history-footprint-arrow" aria-hidden="true">→</i>
    `;
    button.addEventListener("click", () => selectHistoryFootprint(footprint.id));
    list.append(button);
  });
  trigger.addEventListener("click", () => setHistoryFootprintPanelOpen(trigger.getAttribute("aria-expanded") !== "true"));
  close?.addEventListener("click", () => {
    setHistoryFootprintPanelOpen(false);
    trigger.focus();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!document.body.classList.contains("is-history-footprint-open")) return;
    if (event.target.closest(".history-footprint-control")) return;
    setHistoryFootprintPanelOpen(false);
  });
}

function journeyManagementCopy(journey = personalJourney) {
  const state = journey?.state || {};
  const location = EXPLORATION_LOCATIONS[state.currentLocationId] || EXPLORATION_LOCATIONS.guiyang;
  const phaseCopy = {
    travelling: ["旅行进行中", `阿镜正从${location.name}继续往前走。`],
    arrived: ["刚刚抵达", `阿镜刚到${location.name}，正在认识眼前的地方。`],
    waiting_decision: ["在这一站停留", `阿镜正在${location.name}慢下来，还没有赶往下一站。`],
    paused: ["旅程已暂停", `阿镜停在${location.name}，路线和手账都保留在此刻。`],
    completed: ["这一程已收好", `阿镜已在${location.name}收住这一程。`]
  };
  const [label, description] = phaseCopy[state.phase] || ["准备中", "等待选择这一程的方向与节奏。"];
  return { state, location, label, description };
}

function updateJourneyManagement(journey = personalJourney) {
  const { state, location, label, description } = journeyManagementCopy(journey);
  setTouristMomentText("#journey-management-state", label);
  setTouristMomentText("#journey-management-location", `贵州 · ${location.name}`);
  setTouristMomentText("#journey-management-description", description);
  const pauseButton = document.querySelector("#journey-pause-action");
  const paused = state.phase === "paused";
  if (pauseButton) {
    pauseButton.disabled = !["travelling", "waiting_decision", "arrived", "paused"].includes(state.phase);
    pauseButton.dataset.action = paused ? "resume" : "pause";
  }
  setTouristMomentText("#journey-pause-label", paused ? "继续当前旅程" : "暂停当前旅程");
  setTouristMomentText("#journey-pause-note", paused ? "从停下的位置接着往前走" : "停在此刻，路线和手账都会保留");
  document.querySelector(".journey-option-sign.is-pause")?.classList.toggle("is-resume", paused);
}

function setJourneyManagementPanelOpen(open) {
  const trigger = document.querySelector("#journey-management-trigger");
  const panel = document.querySelector("#journey-management-panel");
  if (!trigger || !panel) return;
  if (open) {
    setHistoryFootprintPanelOpen(false);
    updateJourneyManagement();
  }
  trigger.setAttribute("aria-expanded", String(open));
  panel.hidden = !open;
  body.classList.toggle("is-journey-management-open", open);
  if (!open) {
    const confirmation = document.querySelector("#journey-new-confirmation");
    const newAction = document.querySelector("#journey-new-action");
    if (confirmation) confirmation.hidden = true;
    newAction?.setAttribute("aria-expanded", "false");
  } else {
    window.requestAnimationFrame(() => document.querySelector("#journey-pause-action")?.focus());
  }
}

async function prepareNewJourney() {
  const confirmButton = document.querySelector("#journey-new-confirm");
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
    confirmButton.textContent = "正在收好这一程…";
  }
  try {
    const currentJourney = personalJourney || await ensurePersonalJourney();
    if (currentJourney?.id && currentJourney.state?.phase !== "completed") {
      await sendJourneyCommand("complete");
    }
    if (journeyPollTimer) window.clearInterval(journeyPollTimer);
    journeyPollTimer = null;
    personalJourney = null;
    personalJourneyHydration = null;
    travelPaused = false;
    body.classList.remove("is-ai-travelling", "is-travel-paused");
    try {
      window.localStorage.removeItem(PERSONAL_JOURNEY_ID_STORAGE_KEY);
      window.localStorage.removeItem(AI_JOURNEY_STORAGE_KEY);
    } catch { /* 无持久化权限时仍可以开启新旅程。 */ }
    setJourneyManagementPanelOpen(false);
    setUserJournalStatus("准备开启一段新旅程");
    showTravelToast("这一程已收进手账，可以重新选择方向了");
    openTravelSettings();
  } catch (error) {
    showTravelToast("这一程暂时没能收好，请稍后再试");
  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.removeAttribute("aria-busy");
      confirmButton.textContent = "收好并开新程";
    }
  }
}

function initializeJourneyManagement() {
  const trigger = document.querySelector("#journey-management-trigger");
  const close = document.querySelector("#journey-management-close");
  const pause = document.querySelector("#journey-pause-action");
  const newAction = document.querySelector("#journey-new-action");
  const confirmation = document.querySelector("#journey-new-confirmation");
  const cancel = document.querySelector("#journey-new-cancel");
  const confirm = document.querySelector("#journey-new-confirm");
  if (!trigger) return;

  trigger.addEventListener("click", () => setJourneyManagementPanelOpen(trigger.getAttribute("aria-expanded") !== "true"));
  close?.addEventListener("click", () => {
    setJourneyManagementPanelOpen(false);
    trigger.focus();
  });
  pause?.addEventListener("click", async () => {
    pause.disabled = true;
    try {
      await sendJourneyCommand(pause.dataset.action === "resume" ? "resume" : "pause");
      updateJourneyManagement();
    } catch {
      showTravelToast("这个状态暂时没有同步，请稍后再试");
    } finally {
      pause.disabled = false;
    }
  });
  newAction?.addEventListener("click", () => {
    if (!confirmation) return;
    const expanded = newAction.getAttribute("aria-expanded") === "true";
    newAction.setAttribute("aria-expanded", String(!expanded));
    confirmation.hidden = expanded;
    if (!expanded) window.requestAnimationFrame(() => confirm?.focus());
  });
  cancel?.addEventListener("click", () => {
    if (confirmation) confirmation.hidden = true;
    newAction?.setAttribute("aria-expanded", "false");
    newAction?.focus();
  });
  confirm?.addEventListener("click", prepareNewJourney);
  document.addEventListener("pointerdown", (event) => {
    if (!body.classList.contains("is-journey-management-open")) return;
    if (event.target.closest(".journey-management-control")) return;
    setJourneyManagementPanelOpen(false);
  });
}

function relativeJourneyUpdate(value) {
  const timestamp = Date.parse(String(value || ""));
  if (!Number.isFinite(timestamp)) return "刚刚更新";
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (elapsedMinutes < 1) return "刚刚更新";
  if (elapsedMinutes < 60) return `${elapsedMinutes} 分钟前更新`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} 小时前更新`;
  return "上次旅程状态";
}

function naturalEnergyNote(value) {
  const energy = Number(value);
  if (!Number.isFinite(energy)) return "正在感受身体";
  if (energy >= 72) return "脚步还轻";
  if (energy >= 42) return "走得有点累";
  return "需要好好歇会儿";
}

function naturalComfortNote(value) {
  const comfort = Number(value);
  if (!Number.isFinite(comfort)) return "体感待确认";
  if (comfort >= 74) return "体感舒服";
  if (comfort >= 48) return "身上有些不得劲";
  return "环境正在消耗体力";
}

function embodiedMomentProse(location, embodiment, weather, choice) {
  const name = location?.name || "这里";
  const focus = location?.detail || "当地的日常";
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const raining = /雨|雷/.test(String(weather?.condition || ""));
  const clothing = Array.isArray(embodiment?.clothing)
    ? embodiment.clothing.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 2).join("和")
    : "";
  const energy = Number(embodiment?.energy);
  const comfort = Number(embodiment?.comfort);

  const weatherOpening = weather?.available
    ? raining
      ? `${weather.condition || "雨"}落下来，却没把闷热完全压住${Number.isFinite(apparent) ? `，体感还有 ${Math.round(apparent)}℃` : ""}。`
      : `${name}此刻是${weather.condition || "这样的天气"}${Number.isFinite(apparent) ? `，体感约 ${Math.round(apparent)}℃` : ""}。`
    : `刚到${name}，我先顺着自己的脚步走了一段。`;
  const bodySentence = Number.isFinite(energy) && energy < 42
    ? `我现在确实有点累${clothing ? `，身上的${clothing}也开始显得累赘` : ""}。`
    : Number.isFinite(comfort) && comfort < 70
      ? `${clothing ? `身上的${clothing}` : "衣服"}贴着身体，我有些不舒服，脚步也慢了下来。`
      : `身体还走得动，但我不想为了多走一点，把这一刻匆匆略过去。`;
  const action = String(choice?.title || "先慢一点").replace(/[。！？]+$/g, "");
  return `${weatherOpening}${bodySentence}\n\n所以我想${action}。等身体松下来，再去看看${focus}究竟怎样落进普通的一天里；现在不急，我先照顾好这一刻的自己。`;
}

function currentMomentEventTitle(state, scene, weather) {
  const place = String(scene.eventPlace || scene.microLocation || "贵州此刻").split("·").pop().trim();
  const raining = /雨|雷/.test(String(weather?.condition || ""));
  if (state.phase === "travelling") return `我离开${place}，继续往前了。`;
  if (state.phase === "paused") return `我先把旅程停在${place}。`;
  if (state.phase === "waiting_decision") return raining
    ? `雨脚密了，我在${place}停了下来。`
    : `我想在${place}再多待一会。`;
  if (state.phase === "arrived") return `我刚到${place}，先看看这里。`;
  if (state.phase === "completed") return `这一程走到${place}，我想慢慢收住。`;
  return `我正在${place}过这一刻。`;
}

function currentMomentChoice(state, scene, decision) {
  if (state.phase === "arrived" && !decision?.action) return {
    title: "先沿眼前走一小段",
    reason: "新的天气、脚步和见闻落下来以后，我再决定要往哪里走。"
  };
  if (state.phase === "paused") return {
    title: "先停下来，不赶时间",
    reason: "旅程可以暂停，已经发生的路和记忆不会消失。"
  };
  if (state.phase === "travelling") return {
    title: "沿真实道路继续往前",
    reason: state.nextLocationRevealed
      ? String(state.explorationIntent || decision?.nextStopReason || "下一站已经写进行程，我正沿真实道路往前。")
      : "我正在比较几条真实道路，方向确定后会写进行程。"
  };
  const titles = {
    linger: scene.lingerLabel || "在这里多待一会",
    rest: "先照顾好身体，再重新选择",
    wait_user: "等你留下一句话",
    complete: "先把这一程整理成页"
  };
  const title = titles[decision?.action] || scene.lingerLabel || "先在这里慢一点";
  const rawReason = String(decision?.reason || "").trim();
  const reason = rawReason && !rawReason.startsWith("根据环境快照")
    ? rawReason
    : "我把此刻的天气、体力和真正想追的线索放在一起，才做了这个选择。";
  return { title, reason };
}

function relationshipMomentCopy(journey, decision) {
  const sharedWords = String(journey?.settings?.commission || "").trim();
  if (sharedWords) return `你说过：“${sharedWords.slice(0, 120)}”这句话我还记得。今天走到这里，它又有了一点新的回声。`;
  const theme = String(journey?.settings?.theme || "").trim();
  if (theme) return `这一程先沿着“${theme}”慢慢走。我不急着下结论，路上那些普通时刻会一点点告诉我该看什么。`;
  return "今天没有什么非写不可的大事。我只是想让你知道，这里的天气怎样轻轻改了我的脚步。";
}

function storyLayersFor(locationId, scene) {
  const layers = TOURIST_STORY_LAYERS[locationId] || TOURIST_STORY_LAYERS.guiyang;
  if (TOURIST_STORY_LAYERS[locationId]) return layers;
  return {
    ...layers,
    gallery: [
      [scene.image, scene.imageAlt, "眼前", scene.visual],
      ...layers.gallery.slice(1)
    ],
    history: {
      ...layers.history,
      title: `${scene.microLocation.split("·")[0].trim()}为什么会变成今天这样`,
      summary: scene.worth
    }
  };
}

function sceneForJourneyLocation(locationId) {
  if (TOURIST_MOMENTS[locationId]) return TOURIST_MOMENTS[locationId];
  const location = EXPLORATION_LOCATIONS[locationId] || EXPLORATION_LOCATIONS.guiyang;
  return {
    ...TOURIST_MOMENTS.guiyang,
    eventPlace: location.name,
    microLocation: `${location.name} · ${location.detail}`,
    monologue: `我刚到${location.name}，走了一阵有点累。先找个舒服的地方缓一缓，再去看看${location.detail}怎样落在日常里。`,
    prose: `刚到${location.name}，我还没想好先往哪边走。身体倒比念头诚实：走了一阵已经有点累，我想先找个舒服的地方歇口气。\n\n等脚步松下来，再去看看${location.detail}究竟怎样落进普通的一天里。一个地方不用急着认识，我也不用。`,
    visual: `${location.detail}会从真正抵达后的眼前景物里慢慢展开。`,
    audio: "真正抵达以前，先把声音留给那一刻。",
    worth: `这一站值得看的，是${location.detail}如何进入当地人的真实生活。`,
    crowd: "人流尚待抵达确认",
    crowdLevel: "unknown",
    weatherFallback: "刚刚抵达 · 正在感受这里",
    lingerLabel: "先沿眼前走一小段",
    lingerDetail: "不急着下结论",
    commerceAvailable: false
  };
}

function renderTouristMoment(journey) {
  if (activeHistoryFootprintId !== "live") {
    renderHistoryFootprint(HISTORY_FOOTPRINTS.find((item) => item.id === activeHistoryFootprintId));
    return;
  }
  clearHistoryFootprintStory();
  renderJourneyRouteLedger(journey);
  const locationId = journey?.state?.currentLocationId || "guiyang";
  const state = journey?.state || {};
  const scene = sceneForJourneyLocation(locationId);
  const storyLayers = storyLayersFor(locationId, scene);
  const embodiment = journey?.embodiment || {};
  const observedLocationId = String(embodiment.environment?.location?.id || "");
  const environmentMatchesLocation = !observedLocationId || observedLocationId === locationId;
  const decision = environmentMatchesLocation ? journey?.agent?.lastRun?.decision || {} : {};
  const weather = environmentMatchesLocation ? embodiment.environment?.weather : null;
  const apparent = Number(weather?.apparentTemperatureC ?? weather?.temperatureC);
  const hasWeather = Boolean(weather?.available);
  const weatherText = !environmentMatchesLocation
    ? "刚刚抵达 · 正在感受这里"
    : hasWeather
    ? [weather.condition, Number.isFinite(apparent) ? `体感 ${Math.round(apparent)}℃` : ""].filter(Boolean).join(" · ")
    : scene.weatherFallback;

  storyLayers.gallery.slice(0, 3).forEach(([src, alt, label, copy], index) => {
    const suffix = index === 0 ? "scene-image" : `photo-${index + 1}`;
    const image = document.querySelector(`#ajing-${suffix}`);
    if (image) {
      image.src = src;
      image.alt = alt;
    }
    setTouristMomentText(`#ajing-photo-label-${index + 1}`, label);
    setTouristMomentText(`#ajing-photo-copy-${index + 1}`, copy);
  });
  setTouristMomentText("#journey-title", scene.microLocation);
  setTouristMomentText("#ajing-scene-condition", weatherText);
  setTouristMomentText("#ajing-event-title", currentMomentEventTitle(state, scene, weather));

  const choice = currentMomentChoice(state, scene, decision);
  const generatedThought = environmentMatchesLocation ? String(embodiment.thought || "").trim() : "";
  const sentenceCount = (generatedThought.match(/[。！？]/g) || []).length;
  const hasPresenceProse = generatedThought.length >= 100
    && sentenceCount >= 3
    && !generatedThought.startsWith("先让真实的路")
    && !/眼下能确认|还不能确认|现场.{0,12}没有接入|用户委托|内容意图|后端|模型|系统模板/.test(generatedThought);
  const locationName = EXPLORATION_LOCATIONS[locationId]?.name || "这里";
  const thought = !environmentMatchesLocation
    ? `我刚到${locationName}，脚步还没落稳。先让我沿着眼前走一小段，等新的天气、脚步和见闻真正落下来，再回来告诉你。`
    : hasPresenceProse
    ? generatedThought
    : embodiedMomentProse(EXPLORATION_LOCATIONS[locationId], embodiment, weather, choice);
  setTouristMomentText("#ajing-thought", thought);

  const localText = embodiment.environment?.localTime?.localText || "";
  const localClock = localText.match(/\d{2}:\d{2}/)?.[0] || new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
  const updatedAt = environmentMatchesLocation
    ? journey?.agent?.lastRun?.at || embodiment.updatedAt || state.lastSyncedAt || journey?.updatedAt
    : state.lastSyncedAt || journey?.updatedAt;
  const updateLabel = relativeJourneyUpdate(updatedAt);
  setTouristMomentText("#ajing-moment-time", `${localClock} · 旅程状态${updateLabel}`);

  setTouristMomentText("#ajing-choice-title", choice.title);
  setTouristMomentText("#ajing-choice-reason", choice.reason);
  setTouristMomentText("#ajing-energy-note", environmentMatchesLocation ? naturalEnergyNote(embodiment.energy) : "脚步刚落下");
  setTouristMomentText("#ajing-comfort-note", environmentMatchesLocation ? naturalComfortNote(embodiment.comfort) : "正在感受这里");
  setTouristMomentText("#ajing-relationship-copy", relationshipMomentCopy(journey, decision));
  setTouristMomentText("#ajing-evidence-location", scene.microLocation);
  setTouristMomentText("#ajing-evidence-weather", environmentMatchesLocation ? agentEnvironmentText(embodiment.environment) : "这一站的天气正在更新");
  setTouristMomentText("#ajing-evidence-sync", updateLabel);
  setTouristMomentText("#ajing-evidence-count", `${hasWeather ? 4 : 3} 项可展开`);

  const history = storyLayers.history;
  setTouristMomentText("#ajing-history-era", history.era);
  setTouristMomentText("#ajing-history-title", history.title);
  setTouristMomentText("#ajing-history-summary", history.summary);
  setTouristMomentText("#ajing-history-image-note", history.imageNote);
  setTouristMomentText("#ajing-history-kicker", history.kicker);
  setTouristMomentText("#ajing-history-copy", history.copy);
  const historyImage = document.querySelector("#ajing-history-image");
  if (historyImage) {
    historyImage.src = history.image;
    historyImage.alt = history.imageAlt;
  }
}

function renderAgentJourneyState(journey) {
  if (!journey?.state) return;
  const state = journey.state;
  renderTouristMoment(journey);

  const journeyIsActive = ["travelling", "waiting_decision", "arrived", "paused"].includes(state.phase);
  if (state.phase !== "draft") body.classList.toggle("is-ai-travelling", journeyIsActive);
  if (journeyIsActive && !journeyPollTimer) startJourneyPolling();
  if (!journeyIsActive && state.phase !== "draft" && journeyPollTimer) {
    window.clearInterval(journeyPollTimer);
    journeyPollTimer = null;
  }
  travelPaused = state.phase === "paused";
  body.classList.toggle("is-travel-paused", travelPaused);
  updateJourneyManagement(journey);

  renderJourneyMapProgress(journey);
  const entryCount = journey.entries?.filter((entry) => entry.status === "ready").length || 0;
  if (renderedJourneyEntryCount > 0 && entryCount > renderedJourneyEntryCount) {
    const latest = [...journey.entries].filter((entry) => entry.status === "ready").sort((a, b) => b.routeOrder - a.routeOrder)[0];
    showTravelToast(`${latest.locationName}的新见闻已经寄回手账`);
  }
  renderedJourneyEntryCount = entryCount;
  syncTravelMapWithJourney(journey);
  const nextCommerceLocationId = journey?.state?.currentLocationId;
  if (nextCommerceLocationId && commerceDiscoveryLocationId && nextCommerceLocationId !== commerceDiscoveryLocationId) {
    const discoveryShell = document.querySelector("#journey-discovery");
    if (discoveryShell) discoveryShell.hidden = true;
    loadCommerceDiscovery().catch(() => {});
  }
}

function syncJourneySettingsFromServer(journey) {
  const settings = journey?.settings;
  if (!settings) return;
  const previousMode = travelMode;
  if (settings.mode) travelMode = settings.mode;
  if (Number.isFinite(Number(settings.durationMinutes))) {
    travelSegmentDurationMinutes = Math.max(1, Number(settings.durationMinutes));
  }
  const selections = [
    ["mode", settings.mode],
    ["pace", settings.pace],
    ["theme", settings.theme]
  ];
  for (const [attribute, value] of selections) {
    if (!value) continue;
    document.querySelectorAll(`[data-${attribute}]`).forEach((button) => {
      const selected = button.dataset[attribute] === value;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }
  const commission = document.querySelector("#travel-commission");
  if (commission && typeof settings.commission === "string") commission.value = settings.commission;
  const liveMode = document.querySelector("#travel-mode-label");
  const livePace = document.querySelector("#travel-pace-label");
  if (liveMode && settings.mode) liveMode.textContent = settings.mode;
  if (livePace && settings.pace) livePace.textContent = settings.pace;
  const customControl = document.querySelector("#custom-pace-control");
  if (customControl) customControl.hidden = settings.pace !== "自定义";
  const customInput = document.querySelector("#custom-travel-duration");
  const customOutput = document.querySelector("#custom-duration-value");
  if (customInput && settings.pace === "自定义") customInput.value = String(travelSegmentDurationMinutes);
  if (customOutput && settings.pace === "自定义") customOutput.textContent = `${travelSegmentDurationMinutes} 分钟`;
  if (travelMode !== previousMode) travelMap?.setMode?.(travelMode);
  syncIdleJourneySummary();
}

async function refreshPersonalJourney() {
  if (!personalJourney?.id || document.hidden) return personalJourney;
  const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(personalJourney.id)}`, { timeoutMs: 150000 });
  personalJourney = data.journey;
  renderPersonalJourney(personalJourney);
  return personalJourney;
}

function startJourneyPolling() {
  if (journeyPollTimer) window.clearInterval(journeyPollTimer);
  journeyPollTimer = window.setInterval(() => {
    refreshPersonalJourney().catch((error) => console.info("旅程同步暂时不可用", error));
  }, 5000);
}

async function sendJourneyCommand(action, payload = {}) {
  const journey = await ensurePersonalJourney();
  const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(journey.id)}/commands`, {
    method: "POST",
    body: JSON.stringify({ action, ...payload })
  });
  personalJourney = data.journey;
  renderPersonalJourney(personalJourney);
  const messages = {
    pause: "我先停在这段路上，歇一歇",
    resume: "歇够了，我从这里接着走",
    linger: "我想在这一站多待一会儿",
    next: "我再看看眼前，然后自己选下一站",
    ai_decide: "我看了看天，也听了听身体，决定就这么走",
    commission: "你写下的这句话，我会带在路上",
    complete: "这一程已经收进手账"
  };
  showTravelToast(messages[action] || "旅程已经更新");
  return personalJourney;
}

function renderPersonalJourney(journey, options = {}) {
  personalJourney = journey;
  syncJourneySettingsFromServer(journey);
  removeGeneratedJournalSpreads();
  const entries = [...(journey?.entries || [])].filter((entry) => entry.status === "ready").sort((a, b) => a.routeOrder - b.routeOrder);
  const days = backfillJournalDays(entries, groupJournalEntriesByDay(entries));
  const firstDaySpreadPage = getUserJournalMaxPage() + 1;
  for (const [dayIndex, day] of days.entries()) {
    const spreadPage = getUserJournalMaxPage() + 1;
    const leafPage = spreadPage * 2 - 1;
    const routeLabel = day.entries.map((entry) => entry.locationName).filter((name, index, all) => name !== all[index - 1]).join(" → ");
    appendJournalSpread(
      createDailyJourneyPage(day, leafPage, dayIndex + 1),
      `第 ${dayIndex + 1} 天 · ${day.date.month}/${day.date.day} · ${routeLabel}`,
      createJourneyFootprintArchivePage(days, dayIndex, leafPage, firstDaySpreadPage)
    );
  }
  const pendingGeneration = Object.entries(journey?.generation || {})
    .find(([, state]) => ["generating", "failed"].includes(state?.status));
  if (pendingGeneration) {
    const [locationId, state] = pendingGeneration;
    const names = JOURNEY_LOCATION_NAMES;
    const spreadPage = getUserJournalMaxPage() + 1;
    const leafPage = spreadPage * 2 - 1;
    appendJournalSpread(
      createGenerationJournalPage(names[locationId] || locationId, leafPage, state.status === "failed"),
      state.status === "failed" ? "这一页待续" : "这一页还在写",
      days.length ? createJourneyFootprintArchivePage(days, -1, leafPage, firstDaySpreadPage) : null
    );
  }
  if (pendingGeneration?.[1]?.status === "generating") setUserJournalStatus("新的一页正在写进手帐");
  else if (entries.length) setUserJournalStatus(`已记录 ${days.length} 天 · ${entries.length} 站`);
  else setUserJournalStatus("等待第一站内容");
  journalArrivalTriggered = entries.some((entry) => entry.locationId === "xiuwen");
  const maxPage = getUserJournalMaxPage();
  if (userJournalPage > maxPage) userJournalPage = maxPage;
  updateUserJournalControls(maxPage);
  if (options.focusLatest && maxPage > 0) renderUserJournalPage(pendingGeneration ? maxPage : Math.max(1, days.length));
  else renderUserJournalPage(userJournalPage);
  renderAgentJourneyState(journey);
}

async function createPersonalJourney() {
  const pace = document.querySelector("[data-pace].is-selected")?.dataset.pace || "沉浸节奏";
  const theme = document.querySelector("[data-theme].is-selected")?.dataset.theme || "第一次认识贵州";
  const commission = document.querySelector("#travel-commission")?.value.trim() || "";
  const data = await requestJournalApi("/api/journeys", {
    method: "POST",
    body: JSON.stringify({ mode: travelMode, pace, theme, commission, durationMinutes: travelSegmentDurationMinutes }),
    timeoutMs: 15000
  });
  rememberPersonalJourneyId(data.journey.id);
  personalJourney = data.journey;
  renderPersonalJourney(personalJourney);
  return personalJourney;
}

async function ensurePersonalJourney() {
  if (personalJourney?.id) return personalJourney;
  const id = getStoredPersonalJourneyId();
  if (id) {
    try {
      const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(id)}`, { timeoutMs: 15000 });
      personalJourney = data.journey;
      renderPersonalJourney(personalJourney);
      return personalJourney;
    } catch {
      try { window.localStorage.removeItem(PERSONAL_JOURNEY_ID_STORAGE_KEY); } catch { /* noop */ }
    }
  }
  return createPersonalJourney();
}

async function generatePersonalJourneyStop(locationId, options = {}) {
  if (journalGenerationInFlight.has(locationId)) return;
  const journey = await ensurePersonalJourney();
  const existing = journey.entries?.find((entry) => entry.locationId === locationId && entry.status === "ready");
  if (existing) {
    renderPersonalJourney(journey, { focusLatest: options.focusLatest });
    return existing;
  }
  journalGenerationInFlight.add(locationId);
  personalJourney.generation = personalJourney.generation || {};
  personalJourney.generation[locationId] = { status: "generating", startedAt: new Date().toISOString() };
  renderPersonalJourney(personalJourney, { focusLatest: options.focusLatest });
  try {
    const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(journey.id)}/stops/${encodeURIComponent(locationId)}/generate`, {
      method: "POST",
      body: "{}"
    });
    personalJourney = data.journey;
    renderPersonalJourney(personalJourney, { focusLatest: options.focusLatest !== false });
    showTravelToast(data.entry.image?.type === "ai-generated"
      ? `${data.entry.locationName}的见闻和情境重构图已经写进手账`
      : `${data.entry.locationName}的见闻已经写进手账，图片使用资料图降级`);
    return data.entry;
  } catch (error) {
    personalJourney.generation[locationId] = { status: "failed", error: error.message };
    renderPersonalJourney(personalJourney, { focusLatest: true });
    showTravelToast(error.name === "AbortError" ? "这一页等得有点久，可以稍后再试" : "这一页暂时没写成，可以在手帐里接着写");
    return null;
  } finally {
    journalGenerationInFlight.delete(locationId);
  }
}

async function hydratePersonalJourney() {
  if (personalJourneyHydration) return personalJourneyHydration;
  personalJourneyHydration = (async () => {
    const journey = await ensurePersonalJourney();
    renderPersonalJourney(journey);
    if (journey.state?.phase === "draft" && body.classList.contains("is-ai-travelling")) {
      const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(journey.id)}/start`, { method: "POST", body: "{}" });
      personalJourney = data.journey;
      renderPersonalJourney(personalJourney);
    }
  })().catch((error) => {
    const fallback = personalJourney || { entries: [], generation: { guiyang: { status: "failed", error: error.message } } };
    renderPersonalJourney(fallback);
  }).finally(() => {
    personalJourneyHydration = null;
  });
  return personalJourneyHydration;
}

function updateUserJournalControls(maxPage) {
  const resolvedMaxPage = Number.isFinite(maxPage) ? maxPage : getUserJournalMaxPage();
  const previous = document.querySelector("#user-journal-prev");
  const next = document.querySelector("#user-journal-next");
  if (previous) previous.disabled = !userJournalOpen || userJournalIsTurning || userJournalPage === 0;
  if (next) next.disabled = !userJournalOpen || userJournalIsTurning || userJournalPage >= resolvedMaxPage;
  const labels = ["封面"];
  const label = document.querySelector("#user-journal-page-label");
  const hint = document.querySelector(".user-journal-pagination small");
  const spread = document.querySelector(`[data-user-journal-spread="${userJournalPage}"]`);
  if (label) label.textContent = spread?.dataset.journalLabel || labels[userJournalPage] || `手账第 ${journalPageNumber(userJournalPage)} 页`;
  if (hint) hint.textContent = userJournalOpen ? "点页边或左右滑动" : "点击封面打开";
}

function setUserJournalOpen(open, { focus = true } = {}) {
  const book = document.querySelector("#user-journal-book");
  const cover = document.querySelector(".user-journal-cover");
  if (!book || !cover) return;
  userJournalOpen = Boolean(open);
  book.dataset.open = String(userJournalOpen);
  book.classList.toggle("is-open", userJournalOpen);
  cover.setAttribute("aria-expanded", String(userJournalOpen));
  cover.setAttribute("aria-label", userJournalOpen ? "我的旅行手账已打开" : "打开我的旅行手账");
  updateUserJournalControls(getUserJournalMaxPage());
  if (focus) window.setTimeout(() => {
    (userJournalOpen ? document.querySelector("#user-journal-next") : cover)?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 420);
}

function openUserJournalFromCover() {
  const firstReadablePage = Math.min(1, getUserJournalMaxPage());
  if (firstReadablePage > 0) {
    setUserJournalOpen(true, { focus: false });
    renderUserJournalPage(firstReadablePage);
  } else {
    setUserJournalOpen(false);
  }
}

function cloneUserJournalTurnPage(source, ...classes) {
  if (!source) return null;
  const clone = source.cloneNode(true);
  [clone, ...clone.querySelectorAll("[id]")].forEach((element) => element.removeAttribute("id"));
  clone.classList.add(...classes);
  clone.setAttribute("aria-hidden", "true");
  clone.removeAttribute("role");
  clone.removeAttribute("tabindex");
  clone.inert = true;
  clone.querySelectorAll("button, a, input, textarea, select, summary, [tabindex]").forEach((element) => {
    element.removeAttribute("id");
    element.setAttribute("tabindex", "-1");
    if ("disabled" in element) element.disabled = true;
  });
  const shade = document.createElement("span");
  shade.className = "user-journal-turn-face-shade";
  clone.append(shade);
  return clone;
}

function clearUserJournalLeafTurn() {
  userJournalTurnOverlay?.remove();
  userJournalTurnOverlay = null;
  document.querySelector("#user-journal-book")?.classList.remove("has-leaf-turn");
}

function createUserJournalLeafTurn(currentSpread, targetSpread, direction) {
  if (reduceMotion || mobileQuery.matches) return null;
  const journal = document.querySelector("#user-journal-book");
  if (!journal) return null;
  const currentPages = [...currentSpread.children].filter((page) => page.classList.contains("user-journal-page"));
  const targetPages = [...targetSpread.children].filter((page) => page.classList.contains("user-journal-page"));
  if (currentPages.length < 2 || targetPages.length < 2) return null;

  clearUserJournalLeafTurn();
  const isForward = direction === "forward";
  const overlay = document.createElement("div");
  overlay.className = `user-journal-turn-overlay is-${direction}`;
  overlay.setAttribute("aria-hidden", "true");

  const staticPage = cloneUserJournalTurnPage(
    isForward ? currentPages[0] : currentPages[currentPages.length - 1],
    "user-journal-turn-static-page",
    isForward ? "is-left" : "is-right"
  );
  const castShadow = document.createElement("span");
  castShadow.className = "user-journal-turn-cast-shadow";

  const leaf = document.createElement("div");
  leaf.className = "user-journal-turn-leaf";
  const front = cloneUserJournalTurnPage(
    isForward ? currentPages[currentPages.length - 1] : currentPages[0],
    "user-journal-turn-face",
    "is-front"
  );
  const back = cloneUserJournalTurnPage(
    isForward ? targetPages[0] : targetPages[targetPages.length - 1],
    "user-journal-turn-face",
    "is-back"
  );
  if (!staticPage || !front || !back) return null;

  leaf.append(front, back);
  overlay.append(staticPage, castShadow, leaf);
  journal.append(overlay);
  journal.classList.add("has-leaf-turn");
  userJournalTurnOverlay = overlay;
  leaf.addEventListener("animationend", (event) => {
    if (event.target === leaf && userJournalIsTurning) finishUserJournalTurn();
  });
  return overlay;
}

function finishUserJournalTurn() {
  if (userJournalTurnTimer) window.clearTimeout(userJournalTurnTimer);
  userJournalTurnTimer = null;
  clearUserJournalLeafTurn();
  const journal = document.querySelector("#user-journal-book");
  document.querySelectorAll("[data-user-journal-spread]").forEach((spread) => {
    const isCurrent = Number(spread.dataset.userJournalSpread) === userJournalTurnTarget;
    spread.classList.toggle("is-current", isCurrent);
    spread.classList.remove("is-turning-forward", "is-turning-backward", "is-turn-under");
    spread.setAttribute("aria-hidden", String(!isCurrent));
  });
  journal?.classList.remove("is-turning", "is-turning-forward", "is-turning-backward");
  userJournalIsTurning = false;
  userJournalTurnTarget = null;
  updateUserJournalControls(getUserJournalMaxPage());
}

function renderUserJournalPage(nextPage) {
  const maxPage = getUserJournalMaxPage();
  const targetPage = Math.max(0, Math.min(Number(nextPage) || 0, maxPage));
  const journal = document.querySelector("#user-journal-book");
  if (!journal) return;
  if (targetPage === 0 && userJournalOpen) setUserJournalOpen(false, { focus: false });
  if (targetPage > 0 && !userJournalOpen) setUserJournalOpen(true, { focus: false });

  if (userJournalIsTurning) finishUserJournalTurn();
  if (targetPage === userJournalPage || reduceMotion) {
    userJournalPage = targetPage;
    userJournalTurnTarget = targetPage;
    journal.dataset.page = String(userJournalPage);
    finishUserJournalTurn();
    return;
  }

  const direction = targetPage > userJournalPage ? "forward" : "backward";
  const currentSpread = document.querySelector(`[data-user-journal-spread="${userJournalPage}"]`);
  const targetSpread = document.querySelector(`[data-user-journal-spread="${targetPage}"]`);
  if (!currentSpread || !targetSpread) return;

  const leafTurn = createUserJournalLeafTurn(currentSpread, targetSpread, direction);

  document.querySelectorAll("[data-user-journal-spread]").forEach((spread) => {
    spread.classList.remove("is-current", "is-turning-forward", "is-turning-backward", "is-turn-under");
    spread.setAttribute("aria-hidden", "true");
  });

  userJournalPage = targetPage;
  userJournalTurnTarget = targetPage;
  userJournalIsTurning = true;
  journal.dataset.page = String(targetPage);
  journal.classList.add("is-turning", `is-turning-${direction}`);

  targetSpread.classList.add("is-current");
  targetSpread.setAttribute("aria-hidden", "false");
  if (direction === "forward") {
    currentSpread.classList.add("is-turning-forward");
  } else {
    currentSpread.classList.add("is-turn-under");
    targetSpread.classList.add("is-turning-backward");
  }

  updateUserJournalControls(maxPage);
  userJournalTurnTimer = window.setTimeout(finishUserJournalTurn, leafTurn ? 540 : 500);
}

async function startAiJourney() {
  const wasActive = body.classList.contains("is-ai-travelling");
  const confirmButton = document.querySelector("#confirm-ai-journey");
  if (confirmButton) {
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-busy", "true");
  }
  try {
    window.localStorage.setItem(AI_JOURNEY_STORAGE_KEY, "true");
  } catch {
    // 无持久化权限时仍允许本次旅行继续。
  }
  body.classList.add("is-ai-travelling");
  travelPaused = false;
  setUserJournalStatus("阿镜正在贵州旅行");
  const clockState = document.querySelector(".travel-running-mark small");
  if (clockState) clockState.textContent = "旅程进行中";
  const mapCompactStatus = document.querySelector("#map-compact-status");
  if (mapCompactStatus) mapCompactStatus.textContent = "实时位置 · 镜头跟随中";
  syncTravelClock();
  closeTravelSettings();
  renderTravelPosition(travelProgressValue);
  try {
    if (!wasActive) {
      personalJourney = null;
      personalJourneyHydration = null;
      try { window.localStorage.removeItem(PERSONAL_JOURNEY_ID_STORAGE_KEY); } catch { /* noop */ }
      await createPersonalJourney();
    } else {
      await ensurePersonalJourney();
    }
    const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(personalJourney.id)}/start`, {
      method: "POST",
      body: "{}"
    });
    personalJourney = data.journey;
    renderPersonalJourney(personalJourney, { focusLatest: true });
    startJourneyPolling();
  } catch (error) {
    const fallback = personalJourney || { entries: [], generation: {} };
    fallback.generation.guiyang = { status: "failed", error: error.message };
    renderPersonalJourney(fallback, { focusLatest: true });
    showTravelToast("旅程已经开始，但第一批手账内容暂未生成，可以在手账中重试");
  } finally {
    if (confirmButton) {
      confirmButton.disabled = false;
      confirmButton.removeAttribute("aria-busy");
    }
  }
  window.setTimeout(() => {
    travelMap?.resize();
    recenterTravelMap(true);
    document.querySelector("#user-journal-next")?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 360);
}

function openTravelSettings() {
  if (!travelSettings) return;
  body.classList.add("is-settings-open");
  travelSettings.classList.add("is-open");
  travelSettings.setAttribute("aria-hidden", "false");
  travelSettings.inert = false;
  window.setTimeout(() => travelSettings.querySelector("button")?.focus(), reduceMotion ? 0 : 260);
}

function closeTravelSettings() {
  if (!travelSettings) return;
  body.classList.remove("is-settings-open");
  travelSettings.classList.remove("is-open");
  travelSettings.setAttribute("aria-hidden", "true");
  travelSettings.inert = true;
}

function setOnsiteSources(sources = []) {
  onsiteStorySources = sources;
  const results = document.querySelector("#onsite-source-results");
  if (!results) return;
  results.replaceChildren();
  for (const source of sources) {
    const url = safeJournalUrl(source.url);
    const item = url ? document.createElement("a") : document.createElement("span");
    if (url) {
      item.href = url;
      item.target = "_blank";
      item.rel = "noreferrer noopener";
    }
    item.textContent = source.title || "未命名来源";
    results.append(item);
  }
  results.hidden = !sources.length;
}

function renderOnsiteStory(topic, options = {}) {
  const story = ONSITE_STORIES[topic] || ONSITE_STORIES.past;
  document.querySelectorAll("[data-onsite-topic]").forEach((button) => {
    const active = button.dataset.onsiteTopic === topic;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const type = document.querySelector("#onsite-story-type");
  const title = document.querySelector("#onsite-story-title");
  const copy = document.querySelector("#onsite-story-copy");
  const source = document.querySelector("#onsite-story-source");
  if (type) type.textContent = options.type || story.type;
  if (title) title.textContent = options.title || story.title;
  if (copy) copy.textContent = options.copy || story.copy;
  if (source) source.querySelectorAll("span").forEach((element, index) => {
    element.textContent = options.source?.[index] || story.source[index] || "";
  });
  if (!options.keepSources) setOnsiteSources([]);
}

async function searchOnsiteStory(topic, customQuestion = "") {
  const story = ONSITE_STORIES[topic] || ONSITE_STORIES.past;
  const card = document.querySelector(".onsite-story-card");
  const copy = document.querySelector("#onsite-story-copy");
  card?.setAttribute("data-source-state", "searching");
  if (copy) copy.textContent = "我去找找这个地方的访谈、地方记录和老一辈留下的讲法。等我把几个版本对一对，再慢慢讲给你。";
  const question = customQuestion || (topic === "elders"
    ? "请搜索并核对海龙屯当地老一辈、村民访谈或地方记忆中流传的讲法，像朋友讲故事一样转述，但标明来源和不确定性。"
    : "请搜索并核对海龙屯流传的地方故事和民间传说，像朋友一样慢慢讲，同时分清传说与史实。");
  try {
    const data = await requestJournalApi("/api/ai/ask", {
      method: "POST",
      body: JSON.stringify({ question, locationId: "hailongtun" }),
      timeoutMs: 30000
    });
    const webResultCount = Number(data.meta?.searchResultCount || 0);
    renderOnsiteStory(topic, {
      copy: data.answer,
      type: webResultCount > 0 ? story.type : "检索结果 · 暂无口述来源",
      title: webResultCount > 0 ? story.title : "这次，我先不替老一辈开口",
      source: [webResultCount > 0 ? "已命中公开网络" : "未找到可核对的口述来源", `${data.sources?.length || 0} 条相关资料可展开`],
      keepSources: true
    });
    setOnsiteSources(data.sources || []);
  } catch {
    renderOnsiteStory(topic, {
      copy: `${story.copy}\n\n当前公开网络检索没有返回，所以我先不把某个传说讲成定论。`,
      source: ["网络检索暂未返回", "保留待核对"]
    });
  } finally {
    card?.setAttribute("data-source-state", "ready");
  }
}

function openOnsiteCompanion() {
  if (!onsiteCompanion) return;
  body.classList.add("is-onsite-open");
  onsiteCompanion.classList.add("is-open");
  onsiteCompanion.setAttribute("aria-hidden", "false");
  onsiteCompanion.inert = false;
  renderOnsiteStory("past");
  window.setTimeout(() => document.querySelector("#close-onsite-companion")?.focus(), reduceMotion ? 0 : 260);
}

function closeOnsiteCompanion() {
  if (!onsiteCompanion) return;
  window.speechSynthesis?.cancel();
  body.classList.remove("is-onsite-open");
  onsiteCompanion.classList.remove("is-open");
  onsiteCompanion.setAttribute("aria-hidden", "true");
  onsiteCompanion.inert = true;
  document.querySelector("#open-onsite-companion")?.focus({ preventScroll: true });
}

function recognizeOnsitePhoto(file) {
  if (!file || !onsitePhotoPreview) return;
  if (onsitePhotoUrl) URL.revokeObjectURL(onsitePhotoUrl);
  onsitePhotoUrl = URL.createObjectURL(file);
  onsitePhotoPreview.src = onsitePhotoUrl;
  onsitePhotoPreview.alt = "用户刚刚选择的旅行现场照片";
  const conversation = document.querySelector("#onsite-conversation");
  const status = document.querySelector("#onsite-photo-status");
  const place = document.querySelector("#onsite-photo-place");
  conversation?.setAttribute("data-state", "recognizing");
  if (status) status.textContent = "正在结合照片与位置辨认";
  if (place) place.textContent = "请稍候…";
  window.setTimeout(() => {
    conversation?.setAttribute("data-state", "ready");
    if (status) status.textContent = "识别候选 · 请确认";
    if (place) place.textContent = "遵义 · 海龙屯";
    showTravelToast("样机已用海龙屯演示识别，请确认地点");
  }, reduceMotion ? 0 : 900);
}

function syncTravelClock() {
  const clock = document.querySelector("#travel-clock");
  if (!clock) return;
  if (!body.classList.contains("is-ai-travelling")) {
    clock.textContent = "静候启程";
    return;
  }
  const now = new Date();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
  clock.textContent = `DAY 01 · ${time}`;
}

const FALLBACK_COMMERCE_DISCOVERY = {
  id: "guiyang-maojian-travel-tin",
  locationId: "guiyang",
  kind: "physical",
  title: "都匀毛尖 · 旅行小罐",
  origin: "贵州黔南",
  discoveryHeading: "沿贵州茶事，翻到都匀毛尖",
  moment: "都匀毛尖是贵州代表性绿茶之一。这张卡先把它收作地方物产线索，具体饮用感受留到真正遇见以后。",
  question: "要不要先记下它？以后真正到访或选购时，再去核对产地、商家和当日价格。",
  image: "/prototype/assets/culture/FOD-029.jpeg",
  imageAlt: "贵州都匀毛尖茶园里的采茶场景",
  fulfillment: "由第三方平台购买与配送",
  priceLabel: "价格以平台页面为准",
  verification: "人工整理入口 · 不代表商家背书",
  offers: [
    {
      platform: "taobao",
      platformLabel: "淘宝",
      actionLabel: "在淘宝查找",
      href: "https://s.taobao.com/search?q=%E9%83%BD%E5%8C%80%E6%AF%9B%E5%B0%96",
      note: "平台检索结果 · 购买前请核对产地与商家",
      linkType: "search",
      verifiedAt: "2026-08-29"
    }
  ],
  disclosure: {
    message: "非商业的第三方信息入口。支付、收货地址、订单、物流和退款均由所选平台处理；云游四方不读取支付信息。"
  }
};

function readCommerceStorage(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeCommerceStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 本地存储不可用时，不阻断本次发现与平台跳转。
  }
}

function recordCommerceAction(action, platform = null) {
  if (!activeCommerceDiscovery) return;
  const actions = readCommerceStorage(COMMERCE_ACTIONS_STORAGE_KEY);
  actions.push({
    discoveryId: activeCommerceDiscovery.id,
    locationId: activeCommerceDiscovery.locationId,
    kind: activeCommerceDiscovery.kind,
    action,
    platform,
    at: new Date().toISOString()
  });
  writeCommerceStorage(COMMERCE_ACTIONS_STORAGE_KEY, actions.slice(-50));
}

function savedCommerceIds() {
  return new Set(readCommerceStorage(COMMERCE_SAVED_STORAGE_KEY));
}

function setCommerceSaved(discoveryId, saved) {
  const ids = savedCommerceIds();
  if (saved) ids.add(discoveryId);
  else ids.delete(discoveryId);
  writeCommerceStorage(COMMERCE_SAVED_STORAGE_KEY, [...ids]);
}

function renderCommerceOffers(discovery) {
  const container = document.querySelector("#journey-discovery-offers");
  if (!container) return;
  container.replaceChildren();
  for (const offer of discovery.offers || []) {
    const href = safeJournalUrl(offer.href);
    if (!href) continue;
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer noopener";
    link.dataset.platform = offer.platform || "platform";
    const label = document.createElement("span");
    label.textContent = offer.platformLabel || "第三方平台";
    const copy = document.createElement("span");
    const action = document.createElement("b");
    action.textContent = offer.actionLabel || "去平台看看";
    const note = document.createElement("small");
    note.textContent = offer.note || "在第三方平台查看详情";
    copy.append(action, note);
    const arrow = document.createElement("i");
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    link.append(label, copy, arrow);
    link.addEventListener("click", () => recordCommerceAction("platform_handoff", offer.platform || null));
    container.append(link);
  }
}

function renderCommerceDiscovery(discovery) {
  if (!discovery) return;
  activeCommerceDiscovery = discovery;
  commerceDiscoveryLocationId = discovery.locationId;
  const localFind = document.querySelector(".ajing-local-find");
  if (localFind) localFind.hidden = false;
  const bindings = {
    "#journey-discovery-title": discovery.discoveryHeading,
    "#journey-discovery-moment": discovery.moment,
    "#journey-discovery-name": discovery.title,
    "#journey-discovery-question": discovery.question,
    "#journey-discovery-origin": discovery.origin,
    "#journey-discovery-fulfillment": discovery.fulfillment,
    "#journey-discovery-price": discovery.priceLabel,
    "#journey-discovery-verification": discovery.verification,
    "#journey-discovery-disclosure": discovery.disclosure?.message
  };
  for (const [selector, value] of Object.entries(bindings)) {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  }
  const image = document.querySelector("#journey-discovery-image");
  const imageUrl = safeJournalUrl(discovery.image);
  if (image && imageUrl) {
    image.src = imageUrl;
    image.alt = discovery.imageAlt || discovery.title;
  }
  setTouristMomentText("#ajing-find-title", discovery.title);
  setTouristMomentText("#ajing-find-copy", discovery.question);
  const findImage = document.querySelector("#ajing-find-image");
  if (findImage && imageUrl) {
    findImage.src = imageUrl;
    findImage.alt = discovery.imageAlt || discovery.title;
  }
  const save = document.querySelector("#journey-discovery-save");
  const isSaved = savedCommerceIds().has(discovery.id);
  save?.setAttribute("aria-pressed", String(isSaved));
  if (save) save.textContent = isSaved ? "已夹进手账" : "夹进手账";
  const purchase = document.querySelector("#journey-discovery-purchase");
  const open = document.querySelector("#journey-discovery-open");
  if (purchase) purchase.hidden = true;
  open?.setAttribute("aria-expanded", "false");
  if (open) open.textContent = discovery.kind === "ticket" ? "看看日期" : "想尝尝";
  renderCommerceOffers(discovery);
}

function revealCommerceDiscovery({ focus = false } = {}) {
  const shell = document.querySelector("#journey-discovery");
  if (!shell || !activeCommerceDiscovery) return;
  shell.hidden = false;
  shell.classList.remove("is-arriving");
  window.requestAnimationFrame(() => shell.classList.add("is-arriving"));
  recordCommerceAction("discovery_view");
  if (focus) window.setTimeout(() => document.querySelector("#journey-discovery-open")?.focus(), reduceMotion ? 0 : 220);
}

async function loadCommerceDiscovery({ reveal = false, focus = false } = {}) {
  const locationId = currentAiLocationId();
  try {
    const response = await fetch(`/api/commerce/discoveries?location=${encodeURIComponent(locationId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.discovery) {
      activeCommerceDiscovery = null;
      commerceDiscoveryLocationId = locationId;
      const shell = document.querySelector("#journey-discovery");
      if (shell) shell.hidden = true;
      const localFind = document.querySelector(".ajing-local-find");
      if (localFind) localFind.hidden = true;
      return null;
    }
    renderCommerceDiscovery(data.discovery);
  } catch (error) {
    console.info("场景交易服务尚未连接，使用本地样品。", error);
    renderCommerceDiscovery({ ...FALLBACK_COMMERCE_DISCOVERY, locationId });
  }
  if (reveal) revealCommerceDiscovery({ focus });
  return activeCommerceDiscovery;
}

function initializeCommerceDiscovery() {
  const shell = document.querySelector("#journey-discovery");
  const open = document.querySelector("#journey-discovery-open");
  const purchase = document.querySelector("#journey-discovery-purchase");
  const save = document.querySelector("#journey-discovery-save");
  const dismiss = document.querySelector("#journey-discovery-dismiss");
  if (!shell || !open || !purchase || !save || !dismiss) return;

  // 手机工作台会裁切各模块内容；把交易抽屉暂时挂到 body，确保它真正浮在手账之上。
  const shellHome = shell.parentNode;
  const shellMarker = document.createComment("journey-discovery-home");
  const compactCommerceQuery = window.matchMedia("(max-width: 899px)");
  shellHome.insertBefore(shellMarker, shell);
  const syncCommerceShellHost = () => {
    if (compactCommerceQuery.matches) {
      if (shell.parentNode !== document.body) document.body.append(shell);
      return;
    }
    if (shell.parentNode === document.body && shellMarker.parentNode) shellMarker.after(shell);
  };
  syncCommerceShellHost();
  compactCommerceQuery.addEventListener?.("change", syncCommerceShellHost);

  open.addEventListener("click", () => {
    const expanding = purchase.hidden;
    purchase.hidden = !expanding;
    open.setAttribute("aria-expanded", String(expanding));
    open.textContent = expanding ? "收起购买入口" : (activeCommerceDiscovery?.kind === "ticket" ? "看看日期" : "想尝尝");
    if (expanding) {
      recordCommerceAction("purchase_options_opened");
      window.setTimeout(() => purchase.querySelector("a")?.focus(), reduceMotion ? 0 : 260);
    }
  });

  save.addEventListener("click", () => {
    if (!activeCommerceDiscovery) return;
    const next = save.getAttribute("aria-pressed") !== "true";
    save.setAttribute("aria-pressed", String(next));
    save.textContent = next ? "已夹进手账" : "夹进手账";
    setCommerceSaved(activeCommerceDiscovery.id, next);
    recordCommerceAction(next ? "saved" : "unsaved");
    showTravelToast(next ? `${activeCommerceDiscovery.title}已夹进旅行手账` : `${activeCommerceDiscovery.title}已从手账取下`);
  });

  dismiss.addEventListener("click", () => {
    shell.hidden = true;
    recordCommerceAction("dismissed");
    showTravelToast("这次先不带，旅程继续");
  });

  document.querySelectorAll("[data-commerce-intent]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!activeCommerceDiscovery || commerceDiscoveryLocationId !== currentAiLocationId()) {
        await loadCommerceDiscovery();
      }
      revealCommerceDiscovery();
    });
  });

  // 旅途发现只在用户主动跟随现场线索时展开；不因旅程开始而自动弹出商品。
  const shouldReveal = pageParams.get("commerce") === "1";
  window.setTimeout(() => loadCommerceDiscovery({ reveal: shouldReveal }), shouldReveal && !reduceMotion ? 720 : 0);
}

function currentAiLocationId() {
  if (personalJourney?.state?.currentLocationId) return personalJourney.state.currentLocationId;
  return "guiyang";
}

function setAiToolStatus(state, label) {
  const status = document.querySelector("#ai-tool-status");
  if (!status) return;
  status.dataset.state = state;
  status.lastChild.textContent = label;
}

function renderAiLocalFallback() {
  const time = document.querySelector("#ai-local-time");
  const weather = document.querySelector("#ai-live-weather");
  if (time) {
    time.textContent = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(new Date());
  }
  if (weather) weather.textContent = "需启动工具服务";
}

function formatWeatherSummary(weather) {
  if (!weather?.available) return "实时天气暂不可用";
  const temperature = Number.isFinite(weather.temperatureC) ? `${Math.round(weather.temperatureC)}℃` : "";
  return [weather.condition, temperature].filter(Boolean).join(" · ");
}

async function loadAiToolContext() {
  const time = document.querySelector("#ai-local-time");
  const weather = document.querySelector("#ai-live-weather");
  if (!time || !weather) return;
  renderAiLocalFallback();
  setAiToolStatus("loading", "连接中");
  try {
    const response = await fetch(`/api/ai/context?location=${encodeURIComponent(currentAiLocationId())}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const localText = data.localTime?.localText || "";
    const clockMatch = localText.match(/\d{2}:\d{2}/);
    time.textContent = `${data.localTime?.period || "当地"} ${clockMatch?.[0] || localText}`.trim();
    weather.textContent = formatWeatherSummary(data.weather);
    setAiToolStatus("ready", data.weather?.available ? "实时数据已接入" : "知识与时间可用");
  } catch (error) {
    console.info("远方现场服务尚未连接；保留静态原型体验。", error);
    setAiToolStatus("offline", "本地静态模式");
  }
}

function renderAiAnswerSources(sources) {
  const container = document.querySelector("#journey-ai-sources");
  if (!container) return;
  container.replaceChildren();
  for (const source of sources || []) {
    let element;
    try {
      const url = new URL(source.url);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported protocol");
      element = document.createElement("a");
      element.href = url.href;
      element.target = "_blank";
      element.rel = "noreferrer noopener";
    } catch {
      element = document.createElement("span");
    }
    element.textContent = `[${source.id}] ${source.title}`;
    container.append(element);
  }
}

function showAiAnswer(payload) {
  const shell = document.querySelector("#journey-ai-answer");
  const copy = document.querySelector("#journey-ai-answer-copy");
  const kind = document.querySelector("#journey-ai-answer-kind");
  const time = document.querySelector("#journey-ai-answer-time");
  if (!shell || !copy || !kind || !time) return;
  shell.hidden = false;
  copy.textContent = payload.answer;
  kind.textContent = payload.meta?.answerKind === "journey-state"
    ? "阿镜 · 此刻回应"
    : payload.meta?.degraded ? "阿镜 · 依据暂不完整" : "阿镜 · 回应";
  time.textContent = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  renderAiAnswerSources(payload.sources);
}

async function askJourneyAi(question) {
  const input = document.querySelector("#journey-ai-question");
  const submit = document.querySelector("#journey-ai-submit");
  const normalized = String(question || input?.value || "").trim();
  if (normalized.length < 2) {
    input?.focus();
    showTravelToast("先写下你想对阿镜说的话");
    return;
  }
  if (input) input.value = normalized;
  if (submit) {
    submit.disabled = true;
    submit.querySelector("span").textContent = "寄送中";
  }
  setAiToolStatus("loading", "正在调用工具");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 65000);
  try {
    const response = await fetch("/api/ai/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: normalized, locationId: currentAiLocationId(), journeyId: personalJourney?.id || null }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error?.message || `HTTP ${response.status}`);
    showAiAnswer(data);
    if (data.recommendation) {
      renderCommerceDiscovery(data.recommendation);
      revealCommerceDiscovery();
    }
    if (input) input.value = "";
    if (data.context?.weather) {
      const weather = document.querySelector("#ai-live-weather");
      if (weather) weather.textContent = formatWeatherSummary(data.context.weather);
    }
    setAiToolStatus("ready", data.meta?.degraded ? "已使用降级资料" : "回答已寄回");
  } catch (error) {
    const message = error.name === "AbortError"
      ? "这次等得有点久，但旅程没有中断。你可以稍后再问。"
      : "我刚才没有接到这句话。等旅程重新连上，再说给我听。";
    showAiAnswer({ answer: message, sources: [], meta: { degraded: true } });
    setAiToolStatus("offline", "工具暂不可用");
  } finally {
    window.clearTimeout(timeout);
    if (submit) {
      submit.disabled = false;
      submit.querySelector("span").textContent = "寄出";
    }
  }
}

function initializeAiToolPanel() {
  const form = document.querySelector("#journey-ai-form");
  const input = document.querySelector("#journey-ai-question");
  if (!form || !input) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    askJourneyAi(input.value);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      askJourneyAi(input.value);
    }
  });
  document.querySelectorAll("[data-ai-question]").forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.aiQuestion || "";
      askJourneyAi(input.value);
    });
  });
  loadAiToolContext();
}

function setMapLoadState(message, isError = false) {
  const state = document.querySelector("#map-load-state");
  if (!state) return;
  state.textContent = message;
  state.classList.toggle("is-error", isError);
  state.hidden = !message;
}

function travelTrackingZoom() {
  if (travelMapExpanded) return mobileQuery.matches ? 12 : 13;
  return mobileQuery.matches ? 10.75 : 11.5;
}

function travelPreviewTrackingZoom() {
  // 比原视角放大半级，同时为城外高速保留足够的道路与地形参照。
  return mobileQuery.matches ? 13.5 : 14.5;
}

function setTravelMapPreviewReady(ready) {
  travelMapPreviewShell?.classList.toggle("is-map-ready", ready);
}

async function initializeTravelMapPreview(routingStops) {
  if (!realTravelMapPreview || !routingStops.length) return;
  if (travelMapPreview) {
    travelMapPreview.resize?.();
    return travelMapPreview;
  }
  if (travelMapPreviewInitialization) return travelMapPreviewInitialization;

  const start = travelAgentLatLng
    || window.CloudWayfarerMapRuntime.point(routingStops[0].lat, routingStops[0].lng);
  setTravelMapPreviewReady(false);
  const previewContainer = document.createElement("div");
  previewContainer.className = "workspace-mini-map-canvas real-map";
  realTravelMapPreview.replaceChildren(previewContainer);

  const initialization = window.CloudWayfarerMapRuntime.create({
    container: previewContainer,
    route: [start, start],
    stops: [],
    routingStops: [],
    hideFutureRoute: true,
    showControls: false,
    mode: travelMode,
    onReady: () => {},
    onError: () => {},
    onProviderFallback: (error) => console.info("地图预览切换到备用底图", error),
    onDrag: () => {},
    onStopClick: () => setTravelMapExpanded(true)
  }).then((preview) => {
    travelMapPreview = preview;
    preview.setProgress(start, [start]);
    preview.setView(start, travelPreviewTrackingZoom(), false);
    travelPreviewFollowLastUpdate = Date.now();
    preview.resize?.();
    window.requestAnimationFrame(() => setTravelMapPreviewReady(true));
    return preview;
  }).catch((error) => {
    previewContainer.remove();
    setTravelMapPreviewReady(false);
    throw error;
  }).finally(() => {
    if (travelMapPreviewInitialization === initialization) {
      travelMapPreviewInitialization = null;
    }
  });
  travelMapPreviewInitialization = initialization;
  return initialization;
}

function updateTravelMapFollowUi() {
  if (!followTravelAgentButton) return;
  followTravelAgentButton.setAttribute("aria-pressed", String(travelMapFollowing));
  followTravelAgentButton.innerHTML = travelMapFollowing
    ? '<span aria-hidden="true">●</span> 正在跟随阿镜'
    : '<span aria-hidden="true">◎</span> 重新跟随阿镜';
  followTravelAgentButton.classList.toggle("is-paused", !travelMapFollowing);
}

function recenterTravelMap(animate = true) {
  if (!travelMap || !travelAgentLatLng) return;
  travelMap.setView(travelAgentLatLng, travelTrackingZoom(), animate && !reduceMotion);
  travelMapPreview?.setView(travelAgentLatLng, travelPreviewTrackingZoom(), false);
  travelFollowLastUpdate = Date.now();
  travelPreviewFollowLastUpdate = travelFollowLastUpdate;
}

function setTravelMapExpanded(expanded) {
  if (!travelMapStage || travelMapExpanded === expanded) return;
  travelMapExpanded = expanded;
  travelMapFollowing = true;
  travelMapStage.classList.toggle("is-expanded", expanded);
  body.classList.toggle("is-map-expanded", expanded);
  expandTravelMapButton?.setAttribute("aria-expanded", String(expanded));
  agentMapPreviewButton?.setAttribute("aria-expanded", String(expanded));
  if (expanded) {
    travelMapStage.setAttribute("aria-hidden", "false");
    travelMapStage.inert = false;
  } else {
    if (body.dataset.workspaceModule === "map") body.dataset.workspaceModule = workspaceModuleBeforeMap || "journal";
    syncWorkspaceModuleAccessibility();
  }
  updateTravelMapFollowUi();
  window.setTimeout(() => {
    travelMap?.resize();
    recenterTravelMap(true);
    if (expanded) collapseTravelMapButton?.focus();
    else agentMapPreviewButton?.focus({ preventScroll: true });
  }, reduceMotion ? 0 : 430);
}

function buildTravelRouteMetrics(segments = travelRouteSegments, fallbackStops = TRAVEL_STOPS) {
  travelRouteLatLngs = [];
  travelRouteDistances = [0];
  travelRouteStopDistances = [0];
  travelRouteDistance = 0;
  if (!segments.length) {
    const first = fallbackStops[0];
    if (first) travelRouteLatLngs = [window.CloudWayfarerMapRuntime.point(first.lat, first.lng)];
    return;
  }
  segments.forEach((segment, segmentIndex) => {
    const points = segment.points || [];
    points.forEach((entry, pointIndex) => {
      if (segmentIndex > 0 && pointIndex === 0) return;
      const previous = travelRouteLatLngs[travelRouteLatLngs.length - 1];
      travelRouteLatLngs.push(entry);
      if (!previous) return;
      travelRouteDistance += window.CloudWayfarerMapRuntime.distanceBetween(previous, entry);
      travelRouteDistances.push(travelRouteDistance);
    });
    travelRouteStopDistances.push(travelRouteDistance);
  });
  if (travelRouteDistances.length !== travelRouteLatLngs.length) {
    travelRouteDistances = travelRouteLatLngs.map((_, index) => index ? travelRouteDistances[index] : 0);
  }
}

function routeProgressForStopIndex(index) {
  if (!Number.isInteger(index) || index < 0) return null;
  if (!travelRouteDistance) return index === 0 ? 0 : null;
  const distance = travelRouteStopDistances[index];
  return Number.isFinite(distance) ? distance / travelRouteDistance : null;
}

function syncTravelProgressBoundary() {
  const currentIndex = personalJourney?.state?.currentStopIndex || 0;
  const currentProgress = routeProgressForStopIndex(currentIndex);
  const nextProgress = routeProgressForStopIndex(currentIndex + 1);
  travelProgressSegmentStart = Number.isFinite(currentProgress) ? currentProgress : 0;
  travelProgressValue = travelProgressSegmentStart;
  travelProgressCap = Number.isFinite(nextProgress) ? nextProgress : travelProgressValue;
}

function journeyTravelStops(journey = personalJourney) {
  const routeIds = journey?.route?.length ? journey.route : ["guiyang"];
  const currentIndex = journey?.state?.currentStopIndex || 0;
  return routeIds.map((id, index) => {
    const location = EXPLORATION_LOCATIONS[id] || EXPLORATION_LOCATIONS.guiyang;
    return {
      ...location,
      id,
      state: index < currentIndex ? "visited" : index === currentIndex ? "current" : "future",
      direction: index % 2 ? "right" : "left"
    };
  });
}

function getTravelRouteSegmentCache() {
  if (travelRouteSegmentCache) return travelRouteSegmentCache;
  travelRouteSegmentCache = new Map();
  try {
    const stored = JSON.parse(window.localStorage.getItem(ROUTE_SEGMENT_CACHE_STORAGE_KEY) || "[]");
    stored.forEach((entry) => {
      if (!entry?.key || !Array.isArray(entry.points) || entry.points.length < 2) return;
      travelRouteSegmentCache.set(entry.key, {
        ...entry,
        points: entry.points.map(([lat, lng]) => window.CloudWayfarerMapRuntime.point(lat, lng))
      });
    });
  } catch {
    travelRouteSegmentCache.clear();
  }
  return travelRouteSegmentCache;
}

function routeSegmentCacheKey(from, to, mode) {
  return [
    mode,
    from.id || from.name,
    Number(from.lat).toFixed(5),
    Number(from.lng).toFixed(5),
    to.id || to.name,
    Number(to.lat).toFixed(5),
    Number(to.lng).toFixed(5)
  ].join("|");
}

function persistTravelRouteSegment(key, segment) {
  if (!segment.available || segment.source === "unavailable") return;
  const cache = getTravelRouteSegmentCache();
  cache.set(key, { ...segment, key, cachedAt: new Date().toISOString() });
  try {
    const serialized = [...cache.values()].slice(-36).map((entry) => ({
      ...entry,
      points: entry.points.map((point) => [Number(point.lat.toFixed(6)), Number(point.lng.toFixed(6))])
    }));
    window.localStorage.setItem(ROUTE_SEGMENT_CACHE_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // 缓存不可用不影响本次路线，历史段只在当前页面会话内保持冻结。
  }
}

async function fetchJourneyRouteSegments(stops, mode = travelMode) {
  if (stops.length < 2) return [];
  const cache = getTravelRouteSegmentCache();
  return Promise.all(stops.slice(0, -1).map(async (from, index) => {
    const to = stops[index + 1];
    const key = routeSegmentCacheKey(from, to, mode);
    let segment = cache.get(key);
    if (!segment) {
      segment = await window.CloudWayfarerMapRuntime.planRouteSegment(
        window.CloudWayfarerMapRuntime.point(from.lat, from.lng),
        window.CloudWayfarerMapRuntime.point(to.lat, to.lng),
        mode
      );
      persistTravelRouteSegment(key, segment);
    }
    return { ...segment, key, fromId: from.id, toId: to.id };
  }));
}

async function syncActiveJourneyRouteTiming(journey, segmentMeta) {
  const state = journey?.state;
  const realDurationSeconds = Math.round(Number(segmentMeta?.durationSeconds));
  if (!journey?.id || state?.phase !== "travelling") return journey;
  if (!Number.isFinite(realDurationSeconds) || realDurationSeconds <= 0) return journey;
  const fromLocationId = journey.route?.[state.currentStopIndex];
  const toLocationId = journey.route?.[state.currentStopIndex + 1];
  if (!fromLocationId || !toLocationId) return journey;
  if (state.segmentTimingSource?.startsWith("road-route")
    && Number(state.segmentRealDurationSeconds) === realDurationSeconds) return journey;
  const data = await requestJournalApi(`/api/journeys/${encodeURIComponent(journey.id)}/commands`, {
    method: "POST",
    body: JSON.stringify({
      action: "sync_route_timing",
      fromLocationId,
      toLocationId,
      realDurationSeconds,
      routeAvailable: segmentMeta?.available !== false
    })
  });
  const latestState = personalJourney?.state;
  if (personalJourney?.id === journey.id
    && latestState?.currentLocationId === state.currentLocationId
    && latestState?.nextLocationId === state.nextLocationId) {
    personalJourney = data.journey;
    renderPersonalJourney(personalJourney);
  }
  return data.journey;
}

function liveJourneySegmentProgress(state, timestamp = Date.now()) {
  const reported = Math.max(0, Math.min(1, Number(state?.segmentProgress) || 0));
  if (state?.phase !== "travelling") return reported;
  const startedAt = Date.parse(state.segmentStartedAt || "");
  const duration = Number(state.segmentDurationMs);
  if (!Number.isFinite(startedAt) || !Number.isFinite(duration) || duration <= 0) return reported;
  return Math.max(0, Math.min(1, (timestamp - startedAt) / duration));
}

function renderJourneyMapProgress(journey = personalJourney, timestamp = Date.now()) {
  if (!journey?.state || (!travelMap && !travelMapPreview)) return;
  if (!travelRouteDistance) {
    travelProgressSegmentStart = 0;
    travelProgressValue = 0;
    travelProgressCap = 0;
    renderTravelPosition(0);
    return;
  }
  const state = journey.state;
  const start = routeProgressForStopIndex(state.currentStopIndex);
  const end = routeProgressForStopIndex(state.currentStopIndex + 1);
  travelProgressSegmentStart = Number.isFinite(start) ? start : 0;
  let progress = travelProgressSegmentStart;
  if (state.phase === "travelling" && travelActiveRouteAvailable && Number.isFinite(end)) {
    progress += (end - progress) * liveJourneySegmentProgress(state, timestamp);
  }
  travelProgressValue = Math.max(0, Math.min(1, progress));
  travelProgressCap = Number.isFinite(end) ? end : travelProgressValue;
  renderTravelPosition(travelProgressValue);
}

function syncTravelMapWithJourney(journey) {
  const signature = `${(journey?.route || ["guiyang"]).join(",")}|${journey?.state?.currentStopIndex || 0}|${journey?.state?.nextLocationRevealed ? "shown" : "hidden"}|${travelMode}`;
  if (signature === travelMapSignature || signature === travelMapPendingSignature) return;
  travelMapPendingSignature = signature;
  initializeTravelMap(journey)
    .catch((error) => console.info("探索地图暂时无法更新", error))
    .finally(() => {
      if (travelMapPendingSignature === signature) travelMapPendingSignature = "";
    });
}

function travelPointAt(progress) {
  if (!travelRouteLatLngs.length) return null;
  const clamped = Math.max(0, Math.min(progress, 1));
  const targetDistance = travelRouteDistance * clamped;
  const travelled = [travelRouteLatLngs[0]];

  for (let index = 1; index < travelRouteLatLngs.length; index += 1) {
    const currentDistance = travelRouteDistances[index];
    const previousDistance = travelRouteDistances[index - 1];
    if (currentDistance <= targetDistance) {
      travelled.push(travelRouteLatLngs[index]);
      continue;
    }

    const segmentDistance = Math.max(1, currentDistance - previousDistance);
    const segmentProgress = (targetDistance - previousDistance) / segmentDistance;
    const previous = travelRouteLatLngs[index - 1];
    const current = travelRouteLatLngs[index];
    const point = window.CloudWayfarerMapRuntime.point(
      previous.lat + (current.lat - previous.lat) * segmentProgress,
      previous.lng + (current.lng - previous.lng) * segmentProgress
    );
    travelled.push(point);
    return { point, travelled };
  }

  return {
    point: travelRouteLatLngs[travelRouteLatLngs.length - 1],
    travelled: [...travelRouteLatLngs]
  };
}

function updateMapAttribution(provider) {
  const attribution = document.querySelector("#map-attribution");
  if (!attribution) return;
  if (provider === "amap") {
    attribution.innerHTML = '地图、地点与位置服务 <a href="https://lbs.amap.com/" target="_blank" rel="noreferrer">高德开放平台</a>';
    return;
  }
  attribution.innerHTML = '地图 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap 贡献者</a> · 路线 <a href="https://project-osrm.org/" target="_blank" rel="noreferrer">OSRM</a>';
}

async function initializeTravelMap(journey = personalJourney) {
  if (!realTravelMap || !window.CloudWayfarerMapRuntime) {
    setMapLoadState("真实地图组件没有载入，请检查网络后刷新。", true);
    return;
  }
  const buildToken = ++travelMapBuildToken;
  const routingStops = journeyTravelStops(journey);
  const currentIndex = journey?.state?.currentStopIndex || 0;
  const hidesTarget = Boolean(journey?.state?.phase === "travelling" && !journey?.state?.nextLocationRevealed);
  const visibleStops = hidesTarget ? routingStops.slice(0, currentIndex + 1) : routingStops;
  const signature = `${routingStops.map((stop) => stop.id).join(",")}|${currentIndex}|${hidesTarget ? "hidden" : "shown"}|${travelMode}`;
  const previewInitialization = initializeTravelMapPreview(routingStops)
    .catch(() => setTravelMapPreviewReady(false));
  const segmentRequest = fetchJourneyRouteSegments(routingStops, travelMode);
  const nextRouteSegments = await segmentRequest;
  await previewInitialization;
  if (buildToken !== travelMapBuildToken) return;
  travelRouteSegments = nextRouteSegments;
  travelActiveSegmentMeta = travelRouteSegments[currentIndex] || null;
  travelActiveRouteAvailable = travelActiveSegmentMeta?.available !== false;
  syncActiveJourneyRouteTiming(journey, travelActiveSegmentMeta)
    .catch((error) => console.info("真实道路时间暂时没有同步", error));
  TRAVEL_STOPS = routingStops;
  buildTravelRouteMetrics(travelRouteSegments, routingStops);
  try {
    travelMap?.destroy?.();
    realTravelMap.replaceChildren();
    travelMap = await window.CloudWayfarerMapRuntime.create({
      container: realTravelMap,
      route: travelRouteLatLngs,
      stops: visibleStops,
      routeMeta: travelActiveSegmentMeta,
      // 完整道路几何只用于内部定位。前台只画到阿镜此刻的位置，避免泄露下一站。
      hideFutureRoute: true,
      mode: travelMode,
      onReady: () => setMapLoadState(""),
      onError: (message) => setMapLoadState(message, true),
      onProviderFallback: () => setMapLoadState("高德地图暂未连接，已保留现有真实地图。"),
      onDrag: () => {
        if (!travelMapExpanded) return;
        travelMapFollowing = false;
        updateTravelMapFollowUi();
      },
      onStopClick: (stop) => showTravelToast(`${stop.name} · ${stop.detail}`)
    });
    if (buildToken !== travelMapBuildToken) {
      travelMap?.destroy?.();
      return;
    }
    travelMapSignature = signature;
    syncTravelProgressBoundary();
    travelMapPreview?.setRoute?.(travelRouteLatLngs, true);
    updateMapAttribution(travelMap.provider);
    const routeSourceMode = document.querySelector("#route-source-mode");
    if (routeSourceMode) {
      if (journey?.state?.phase !== "travelling") {
        routeSourceMode.textContent = "只显示已经发生的轨迹";
      } else if (!travelActiveRouteAvailable) {
        routeSourceMode.textContent = `${travelMode}路线暂不可用 · 未用直线冒充道路`;
      } else {
        routeSourceMode.textContent = hidesTarget
          ? "只显示已经发生的轨迹 · 下一段未公开"
          : "已按当前交通方式匹配真实道路";
      }
    }
    renderJourneyMapProgress(journey);
    const initialPosition = travelPointAt(travelProgressValue);
    travelAgentLatLng = initialPosition?.point || travelRouteLatLngs[0];
    if (initialPosition) travelMap.setProgress(initialPosition.point, initialPosition.travelled);
    travelMap.setView(travelAgentLatLng, travelTrackingZoom(), false);
    if (travelMapPreview) {
      if (initialPosition) travelMapPreview.setProgress(initialPosition.point, [initialPosition.point]);
      travelMapPreview.setView(travelAgentLatLng, travelPreviewTrackingZoom(), false);
      window.setTimeout(() => travelMapPreview?.resize?.(), 0);
    }
  } catch (error) {
    setMapLoadState("真实地图组件没有载入，请检查网络后刷新。", true);
  }
}

function formatRouteDuration(seconds) {
  const minutes = Math.max(1, Math.round(Number(seconds) / 60));
  if (!Number.isFinite(minutes)) return "待确认";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}

function formatRouteDistance(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value) || value <= 0) return "";
  if (value < 1000) return `${Math.round(value)} 米`;
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} 公里`;
}

function formatTravelPace(state, pace = personalJourney?.settings?.pace) {
  if (pace === "自定义") return "自定义节奏";
  const multiplier = Number(state?.segmentSpeedMultiplier);
  if (Number.isFinite(multiplier) && multiplier > 1) return `${multiplier}× 加速`;
  if (Number.isFinite(multiplier) && multiplier === 1) return "实时同行";
  return TRAVEL_PACE_PROFILES[pace]?.summary || "道路时间同步中";
}

function renderTravelPosition(progress) {
  const clamped = Math.max(0, Math.min(progress, 1));
  const routePosition = travelPointAt(clamped);
  if (routePosition) {
    travelAgentLatLng = routePosition.point;
    // 缩略图只保留当前位置，不绘制已经走过的轨迹。
    travelMapPreview?.setProgress(routePosition.point, [routePosition.point]);
    const now = Date.now();
    const previewNearEdge = travelMapPreview?.isPointNearViewportEdge?.(routePosition.point, 0.3) || false;
    if (travelMapPreview && now - travelPreviewFollowLastUpdate >= 600 && previewNearEdge) {
      travelMapPreview.panTo(routePosition.point, !reduceMotion);
      travelPreviewFollowLastUpdate = now;
    }
    if (travelMap && now - travelMapLastRenderAt >= 80) {
      travelMap.setProgress(routePosition.point, routePosition.travelled);
      travelMapLastRenderAt = now;
      const mainNearEdge = travelMap.isPointNearViewportEdge?.(
        routePosition.point,
        travelMapExpanded ? 0.18 : 0.28
      ) || false;
      if (travelMapFollowing && now - travelFollowLastUpdate > 1100 && mainNearEdge) {
        travelMap.panTo(routePosition.point, !reduceMotion);
        travelFollowLastUpdate = now;
      }
    }
  }
  const eta = document.querySelector("#travel-eta");
  const simulatedEta = document.querySelector("#travel-sim-eta");
  const routeDetail = document.querySelector("#travel-route-detail");
  if (eta) {
    if (personalJourney?.state) {
      const state = personalJourney.state;
      const remainingMs = Date.parse(state.nextEventAt || "") - Date.now();
      const segmentRatio = state.phase === "travelling" ? liveJourneySegmentProgress(state, Date.now()) : 0;
      const realDuration = Number(travelActiveSegmentMeta?.durationSeconds);
      if (state.phase === "travelling" && !travelActiveRouteAvailable) {
        eta.textContent = "路线暂不可用";
        if (simulatedEta) simulatedEta.textContent = "位置保持在上一站";
        if (routeDetail) routeDetail.textContent = `${travelMode} · 未用直线冒充真实道路`;
      } else if (state.phase === "travelling") {
        eta.textContent = Number.isFinite(realDuration)
          ? `按道路约 ${formatRouteDuration(realDuration * Math.max(0, 1 - segmentRatio))}`
          : "道路时间待确认";
        if (simulatedEta) simulatedEta.textContent = Number.isFinite(remainingMs)
          ? `本次云游剩余 ${Math.max(1, Math.ceil(remainingMs / 60000))} 分钟 · ${formatTravelPace(state)}`
          : "云游进度同步中";
        if (routeDetail) {
          const distance = formatRouteDistance(travelActiveSegmentMeta?.distanceMeters);
          routeDetail.textContent = [travelActiveSegmentMeta?.mode || travelMode, distance, "真实道路"].filter(Boolean).join(" · ");
        }
      } else {
        eta.textContent = state.phase === "waiting_decision" ? "此刻停留中" : phaseLabel(state.phase);
        if (simulatedEta) simulatedEta.textContent = state.phase === "waiting_decision" ? "等待阿镜决定下一步" : "";
        if (routeDetail) routeDetail.textContent = "只展示已经发生的轨迹";
      }
    } else {
      const segmentRatio = Math.max(0, (travelProgressCap - clamped) / (travelProgressCap - TRAVEL_PROGRESS_START));
      const remainingToXiuwen = Math.max(1, Math.round(travelSegmentDurationMinutes * segmentRatio));
      eta.textContent = clamped < travelProgressCap ? `云游剩余 ${remainingToXiuwen} 分钟` : "即将抵达";
      if (simulatedEta) simulatedEta.textContent = "演示旅程";
      if (routeDetail) routeDetail.textContent = `${travelMode} · 真实道路`;
    }
  }
  const location = document.querySelector("#travel-location");
  if (location) {
    if (personalJourney?.state) {
      const state = personalJourney.state;
      const currentName = JOURNEY_LOCATION_NAMES[state.currentLocationId] || state.currentLocationId;
      const nextName = JOURNEY_LOCATION_NAMES[state.nextLocationId] || state.nextLocationId;
      location.textContent = state.phase === "travelling"
        ? state.nextLocationRevealed ? `${currentName} → ${nextName}` : `从${currentName}出发 · 下一站未公开`
        : currentName;
    } else if (clamped < 0.03) location.textContent = "贵阳市区 · 北向出发";
    else if (clamped < 0.1) location.textContent = "贵阳北郊 · G75 北向";
    else if (clamped < 0.17) location.textContent = "修文县南 · 龙场方向";
    else location.textContent = "修文龙场 · 阳明洞街道";
  }
  if (
    !personalJourney?.state
    &&
    body.classList.contains("is-ai-travelling")
    && clamped >= travelProgressCap - 0.0005
    && !journalArrivalTriggered
    && !journalGenerationInFlight.has("xiuwen")
  ) {
    journalArrivalTriggered = true;
    generatePersonalJourneyStop("xiuwen", { focusLatest: false });
  }
}

function animateTravelMap(timestamp) {
  if (!travelLastFrame) travelLastFrame = timestamp;
  const delta = Math.min(timestamp - travelLastFrame, 100);
  travelLastFrame = timestamp;
  const serverJourneyTravelling = personalJourney?.state?.phase === "travelling";
  const localJourneyTravelling = !personalJourney?.state && body.classList.contains("is-ai-travelling");
  // “减少动态效果”只关闭镜头过渡，不应冻结代表真实旅程状态的车辆位置。
  if (!travelPaused && body.dataset.view === "travel" && (serverJourneyTravelling || localJourneyTravelling)) {
    if (serverJourneyTravelling && travelActiveRouteAvailable) {
      const segmentProgress = liveJourneySegmentProgress(personalJourney.state, Date.now());
      travelProgressValue = travelProgressSegmentStart
        + (travelProgressCap - travelProgressSegmentStart) * segmentProgress;
      renderTravelPosition(travelProgressValue);
    } else if (!personalJourney?.state) {
      const segmentRate = (travelProgressCap - TRAVEL_PROGRESS_START) / (travelSegmentDurationMinutes * 60 * 1000);
      travelProgressValue = Math.min(travelProgressCap, travelProgressValue + delta * segmentRate);
      renderTravelPosition(travelProgressValue);
    }
  }
  travelAnimationFrame = window.requestAnimationFrame(animateTravelMap);
}

async function toggleTravelPause() {
  if (personalJourney?.id) {
    try {
      await sendJourneyCommand(personalJourney.state?.phase === "paused" ? "resume" : "pause");
    } catch (error) {
      showTravelToast("旅程状态暂时没有同步，请稍后重试");
    }
    return;
  }
  travelPaused = !travelPaused;
  body.classList.toggle("is-travel-paused", travelPaused);
}

function selectTravelOption(button, attribute, outputSelector) {
  const group = button.closest(".travel-option-row");
  group?.querySelectorAll("button").forEach((candidate) => {
    const selected = candidate === button;
    candidate.classList.toggle("is-selected", selected);
    candidate.setAttribute("aria-pressed", String(selected));
  });
  const value = button.dataset[attribute];
  const output = document.querySelector(outputSelector);
  if (output && value) output.textContent = value;
  if (attribute === "mode" && value) {
    travelMode = value;
    travelMap?.setMode?.(travelMode);
    travelMapPreview?.setMode?.(travelMode);
    const routeSourceMode = document.querySelector("#route-source-mode");
    if (routeSourceMode) {
      routeSourceMode.textContent = value === "自驾"
        ? "当前展示：真实自驾道路"
        : `当前选择：${value} · 地图暂保留已核实的自驾道路`;
    }
    const message = value === "自驾"
      ? "已切回自驾，地图展示真实道路路线"
      : `已选择${value}；原型暂保留已核实的自驾道路，正式版将按方式重新算路`;
    syncIdleJourneySummary();
    showTravelToast(message);
    return;
  }
  if (attribute === "pace" && value) {
    const customControl = document.querySelector("#custom-pace-control");
    const isCustom = value === "自定义";
    if (customControl) customControl.hidden = !isCustom;
    if (!isCustom) travelSegmentDurationMinutes = TRAVEL_PACE_PROFILES[value]?.fallbackMinutes || 30;
    syncIdleJourneySummary();
    renderTravelPosition(travelProgressValue);
    showTravelToast(isCustom
      ? `自定义当前路段时长：${travelSegmentDurationMinutes} 分钟`
      : `旅程已调整为：${value} · ${TRAVEL_PACE_PROFILES[value]?.summary || "按道路时间推进"}`);
    return;
  }
  if (attribute === "theme" && value) {
    showTravelToast(`阿镜会从“${value}”开始理解这趟贵州`);
    return;
  }
  showTravelToast(value ? `旅程已调整为：${value}` : "旅程设置已更新");
}

function syncIdleJourneySummary() {
  const mode = document.querySelector("[data-mode].is-selected")?.dataset.mode || travelMode;
  const pace = document.querySelector("[data-pace].is-selected")?.dataset.pace || "沉浸节奏";
  const duration = pace === "自定义"
    ? `约 ${travelSegmentDurationMinutes} 分钟`
    : (TRAVEL_PACE_PROFILES[pace]?.summary || "按道路时间计算");
  const modeOutput = document.querySelector("#idle-travel-mode");
  const paceOutput = document.querySelector("#idle-travel-pace");
  const durationOutput = document.querySelector("#idle-travel-duration");
  const summary = document.querySelector(".journey-primary-action span");
  if (modeOutput) modeOutput.textContent = mode;
  if (paceOutput) paceOutput.textContent = pace;
  if (durationOutput) durationOutput.textContent = duration;
  if (summary) summary.textContent = `贵州随机起点 · 出发后公布下一站 · ${mode} · ${pace}`;
}

document.querySelector("#open-province-journal")?.addEventListener("click", openCityJournalLibrary);
document.querySelector("#open-first-journal")?.addEventListener("click", openCityJournalLibrary);
document.querySelector("#return-to-travel")?.addEventListener("click", () => setProductView("travel"));
document.querySelector("#return-to-city-library")?.addEventListener("click", openCityJournalLibrary);
document.querySelectorAll(".travel-brand, .workspace-home-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showCloudJourneyHome();
  });
});
document.querySelector("#start-cloud-journey")?.addEventListener("click", () => enterCloudJourney(true));
document.querySelector("#plan-ai-journey")?.addEventListener("click", openTravelSettings);
document.querySelector("#edit-ai-journey")?.addEventListener("click", openTravelSettings);
document.querySelector("#open-onsite-companion")?.addEventListener("click", openOnsiteCompanion);
document.querySelector("#close-onsite-companion")?.addEventListener("click", closeOnsiteCompanion);
document.querySelector("[data-close-onsite]")?.addEventListener("click", closeOnsiteCompanion);
onsitePhotoInput?.addEventListener("change", (event) => {
  const file = event.currentTarget.files?.[0];
  if (file) recognizeOnsitePhoto(file);
  event.currentTarget.value = "";
});
document.querySelectorAll("[data-onsite-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    const topic = button.dataset.onsiteTopic;
    renderOnsiteStory(topic);
    if (["elders", "legend"].includes(topic)) searchOnsiteStory(topic);
  });
});
document.querySelector("#confirm-onsite-place")?.addEventListener("click", (event) => {
  event.currentTarget.setAttribute("aria-pressed", "true");
  showTravelToast("已确认是海龙屯，阿镜会继续沿这个地方讲");
});
document.querySelector("#onsite-story-source button")?.addEventListener("click", () => {
  const results = document.querySelector("#onsite-source-results");
  if (!results) return;
  results.hidden = !results.hidden;
  if (!onsiteStorySources.length) showTravelToast("这一段当前使用云游四方知识库，网络检索结果会在这里展开");
});
document.querySelector("#listen-onsite-story")?.addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    showTravelToast("当前浏览器暂不支持语音播放");
    return;
  }
  window.speechSynthesis.cancel();
  const copy = document.querySelector("#onsite-story-copy")?.textContent || currentOnsiteStory().copy;
  const utterance = new SpeechSynthesisUtterance(copy);
  utterance.lang = "zh-CN";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
  showTravelToast("阿镜正在讲这一段");
});
document.querySelector("#save-onsite-story")?.addEventListener("click", () => {
  const page = getUserJournalMaxPage() + 1;
  const appendedPage = appendJournalSpread(createOnsiteJournalPage(page), `我的现场 · ${journalPageNumber(page)}`);
  if (appendedPage == null) return;
  const appended = document.querySelector(`[data-user-journal-spread="${appendedPage}"]`);
  if (appended) {
    appended.dataset.onsiteJournal = "true";
    delete appended.dataset.generatedJournal;
  }
  setUserJournalStatus("已收进一页现场记忆");
  closeOnsiteCompanion();
  renderUserJournalPage(page);
  showTravelToast("你的照片和这段讲述已经夹进旅行手帐");
});
document.querySelector("#onsite-question-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#onsite-question-input");
  const question = input?.value.trim() || "";
  if (!question) return;
  let topic = "culture";
  if (/爷爷|奶奶|外公|外婆|祖先|老人|长辈|以前的人/.test(question)) topic = "elders";
  else if (/传说|流传|故事|怎么讲/.test(question)) topic = "legend";
  else if (/以前|当年|旧时|四百/.test(question)) topic = "past";
  renderOnsiteStory(topic);
  const companionCopy = document.querySelector("#onsite-companion-copy");
  if (companionCopy) companionCopy.textContent = `你问“${question}”。我去公开资料和网络记录里找找，先把几个版本对一对，再像朋友讲故事一样说给你听。`;
  input.value = "";
  await searchOnsiteStory(topic, `请搜索并核对海龙屯相关的公开记录，回答用户的问题“${question}”。请像朋友慢慢讲故事，同时标明来源，分清史实、传说和推测。`);
});
document.querySelector("#confirm-ai-journey")?.addEventListener("click", startAiJourney);
document.querySelector("#travel-pause")?.addEventListener("click", toggleTravelPause);
document.querySelectorAll("[data-journey-command]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.journeyCommand;
    button.disabled = true;
    try {
      await sendJourneyCommand(action, action === "linger" ? { minutes: 5 } : {});
    } catch (error) {
      showTravelToast("这一句暂时没有送到阿镜那里，请稍后再试");
    } finally {
      button.disabled = false;
    }
  });
});
document.querySelector("#ajing-clue-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#ajing-clue-input");
  const note = input?.value.trim() || "";
  if (!note) {
    input?.focus();
    showTravelToast("先留下一句希望她在远方继续想的事");
    return;
  }
  try {
    await sendJourneyCommand("commission", { note });
    input.value = "";
  } catch (error) {
    showTravelToast("这枚线索暂时没有送达，请稍后再试");
  }
});
document.querySelector("#open-travel-settings")?.addEventListener("click", openTravelSettings);
document.querySelector("#close-travel-settings")?.addEventListener("click", closeTravelSettings);
document.querySelector("#user-journal-prev")?.addEventListener("click", () => renderUserJournalPage(userJournalPage - 1));
document.querySelector("#user-journal-next")?.addEventListener("click", () => renderUserJournalPage(userJournalPage + 1));
document.querySelector("#user-journal-book")?.addEventListener("click", (event) => {
  const cover = event.target.closest(".user-journal-cover");
  if (cover && !userJournalOpen) {
    openUserJournalFromCover();
    return;
  }
  const retry = event.target.closest("[data-journal-retry]");
  if (retry) {
    generatePersonalJourneyStop(retry.dataset.locationId || "guiyang", { focusLatest: true });
    return;
  }
  // The paper leaves live in a 3D stacking context, so a transformed page can
  // receive the pointer even when the transparent edge button has a higher
  // z-index. Resolve page-edge clicks from the book coordinates instead.
  if (event.target.closest(".user-journal-edge, button, a, input, textarea, select, summary, [role='button']")) return;
  const book = event.currentTarget;
  const bounds = book.getBoundingClientRect();
  const edgeWidth = Math.max(44, bounds.width * 0.18);
  if (event.clientX >= bounds.right - edgeWidth) {
    renderUserJournalPage(userJournalPage + 1);
  } else if (event.clientX <= bounds.left + edgeWidth) {
    renderUserJournalPage(userJournalPage - 1);
  }
});
document.querySelector(".user-journal-cover")?.addEventListener("keydown", (event) => {
  if (userJournalOpen || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openUserJournalFromCover();
});
document.querySelector("#user-journal-book")?.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  userJournalSwipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
}, { passive: true });
document.querySelector("#user-journal-book")?.addEventListener("touchend", (event) => {
  if (!userJournalSwipeStart) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const dx = touch.clientX - userJournalSwipeStart.x;
  const dy = touch.clientY - userJournalSwipeStart.y;
  userJournalSwipeStart = null;
  if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy)) return;
  renderUserJournalPage(userJournalPage + (dx < 0 ? 1 : -1));
}, { passive: true });
expandTravelMapButton?.addEventListener("click", () => setTravelMapExpanded(true));
agentMapPreviewButton?.addEventListener("click", () => setTravelMapExpanded(true));
collapseTravelMapButton?.addEventListener("click", () => setTravelMapExpanded(false));
followTravelAgentButton?.addEventListener("click", () => {
  travelMapFollowing = true;
  updateTravelMapFollowUi();
  recenterTravelMap(true);
  showTravelToast("地图镜头已经重新跟随阿镜");
});
document.querySelector("#enter-live-map")?.addEventListener("click", () => setTravelMapExpanded(true));

document.querySelectorAll("[data-open-culture]").forEach((button) => {
  button.addEventListener("click", () => openCanvasCulture(button.dataset.openCulture));
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => selectTravelOption(button, "mode", "#travel-mode-label"));
});

document.querySelectorAll("[data-pace]").forEach((button) => {
  button.addEventListener("click", () => selectTravelOption(button, "pace", "#travel-pace-label"));
});

document.querySelectorAll("[data-theme]").forEach((button) => {
  button.addEventListener("click", () => selectTravelOption(button, "theme"));
});
document.querySelectorAll(".travel-option-row button").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("is-selected")));
});

document.querySelector("#custom-travel-duration")?.addEventListener("input", (event) => {
  travelSegmentDurationMinutes = Number(event.currentTarget.value) || 30;
  const output = document.querySelector("#custom-duration-value");
  if (output) output.textContent = `${travelSegmentDurationMinutes} 分钟`;
  syncIdleJourneySummary();
  renderTravelPosition(travelProgressValue);
});

document.querySelector("#custom-travel-duration")?.addEventListener("change", () => {
  showTravelToast(`当前路段将按 ${travelSegmentDurationMinutes} 分钟推进`);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && body.classList.contains("is-onsite-open")) {
    closeOnsiteCompanion();
    return;
  }
});

syncIdleJourneySummary();
initializeTravelMap();
renderTravelPosition(travelProgressValue);
syncTravelClock();
window.setInterval(syncTravelClock, 30000);
if (body.classList.contains("is-ai-travelling")) startJourneyPolling();
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && personalJourney?.id) refreshPersonalJourney().catch(() => {});
});
travelAnimationFrame = window.requestAnimationFrame(animateTravelMap);

cover.addEventListener("click", () => {
  if (body.dataset.state === "closed") openBook();
});
cover.addEventListener("keydown", (event) => {
  if (body.dataset.state !== "closed" || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  openBook();
});
document.querySelector("#page-next").addEventListener("click", nextNode);
document.querySelector("#mobile-story-next").addEventListener("click", nextNode);
document.querySelector("#page-prev").addEventListener("click", previousNode);
document.querySelector("#mobile-visual-prev").addEventListener("click", previousNode);

document.querySelector("#bookmark-button").addEventListener("click", () => {
  if (!currentNode) return;
  if (bookmarks.has(currentNode.id)) {
    bookmarks.delete(currentNode.id);
    showToast(`已从夹页中取下：${currentNode.name}`);
  } else {
    bookmarks.add(currentNode.id);
    showToast(`已夹住这一页：${currentNode.name}`);
  }
  saveBookmarks();
  updatePage(currentNode);
});

document.querySelector("#photo-close")?.addEventListener("click", closePanels);
document.querySelector("#confirm-hailongtun")?.addEventListener("click", () => {
  const hailongtun = nodeById.get("HIS-102") || nodeById.get("HIS-005");
  if (!hailongtun) return;
  if (body.dataset.state === "closed") openBook(hailongtun);
  else insertAndOpen(hailongtun, "next");
  showToast("海龙屯已经夹进书里，正在翻到它的来处");
});
document.querySelector("#photo-input")?.addEventListener("change", (event) => {
  if (!event.target.files.length) return;
  const hailongtun = nodeById.get("HIS-102") || nodeById.get("HIS-005");
  if (body.dataset.state === "closed") openBook(hailongtun);
  else insertAndOpen(hailongtun, "next");
  event.target.value = "";
  showToast("照片只在本机读取；样机用海龙屯模拟识别结果");
});

document.querySelector("#narrate-page").addEventListener("click", narrateCurrent);
document.querySelector("#audio-stop").addEventListener("click", stopNarration);

document.querySelector("#open-source-note").addEventListener("click", () => openPanel(sourceSlip, "#source-close"));
document.querySelector("#source-close").addEventListener("click", closePanels);

spread.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || event.target.closest("button, a, input, textarea, select, [role='button']")) return;
  swipeStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId, moved: false };
  spread.setPointerCapture?.(event.pointerId);
});

spread.addEventListener("pointermove", (event) => {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
    swipeStart.moved = true;
    spread.classList.add("is-page-dragging");
    event.preventDefault();
  }
});

spread.addEventListener("pointerup", (event) => {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  const dx = event.clientX - swipeStart.x;
  const dy = event.clientY - swipeStart.y;
  swipeStart = null;
  spread.classList.remove("is-page-dragging");
  spread.releasePointerCapture?.(event.pointerId);
  if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy)) return;
  if (dx < 0) nextNode();
  else previousNode();
});

spread.addEventListener("pointercancel", (event) => {
  if (!swipeStart || swipeStart.pointerId !== event.pointerId) return;
  swipeStart = null;
  spread.classList.remove("is-page-dragging");
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && body.classList.contains("is-journey-management-open")) {
    setJourneyManagementPanelOpen(false);
    document.querySelector("#journey-management-trigger")?.focus();
    return;
  }
  if (event.key === "Escape" && body.classList.contains("is-history-footprint-open")) {
    setHistoryFootprintPanelOpen(false);
    document.querySelector("#history-footprint-trigger")?.focus();
    return;
  }
  if (event.key === "Escape" && travelSettings?.classList.contains("is-open")) {
    closeTravelSettings();
    document.querySelector("#open-travel-settings")?.focus();
    return;
  }
  if (event.key === "Escape" && travelMapExpanded) {
    setTravelMapExpanded(false);
    return;
  }
  if (event.key === "Escape" && body.dataset.pageMode === "index") {
    closeChapterIndex();
    return;
  }
  if (event.key === "Escape") {
    closePanels();
    stopNarration();
    return;
  }
  if (body.dataset.state !== "open" || [photoPocket, sourceSlip].some((panel) => panel.classList.contains("is-open"))) return;
  if (body.dataset.pageMode === "index") return;
  if (event.key === "ArrowRight" || event.key === "PageDown") {
    event.preventDefault();
    nextNode();
  }
  if (event.key === "ArrowLeft" || event.key === "PageUp") {
    event.preventDefault();
    previousNode();
  }
});

mobileQuery.addEventListener("change", () => {
  body.dataset.mobileLeaf = "visual";
  window.setTimeout(() => {
    travelMap?.resize();
    if (travelMapFollowing) recenterTravelMap(false);
  }, 0);
});

window.addEventListener("beforeunload", () => {
  stopNarration();
  leafAudioContext?.close?.();
  if (travelAnimationFrame) window.cancelAnimationFrame(travelAnimationFrame);
});

async function loadNodes() {
  try {
    const [cultureResponse, attractionResponse, supplementResponse, catalogResponse, heritageResponse] = await Promise.all([
      fetch("../knowledge-base/culture-nodes.json"),
      fetch("../knowledge-base/attraction-nodes.json"),
      fetch("../knowledge-base/city-supplement.json"),
      fetch("../knowledge-base/city-catalog.json"),
      fetch("../knowledge-base/heritage-catalog.json")
    ]);
    if (!cultureResponse.ok || !attractionResponse.ok || !supplementResponse.ok || !catalogResponse.ok || !heritageResponse.ok) {
      throw new Error(`HTTP ${cultureResponse.status}/${attractionResponse.status}/${supplementResponse.status}/${catalogResponse.status}/${heritageResponse.status}`);
    }
    const [cultureData, attractionData, supplementData, catalogData, heritageData] = await Promise.all([
      cultureResponse.json(),
      attractionResponse.json(),
      supplementResponse.json(),
      catalogResponse.json(),
      heritageResponse.json()
    ]);
    return [
      ...attractionData.nodes.map((node) => ({ ...node, contentKind: "attractions", contentDepth: "deep" })),
      ...cultureData.nodes.map((node) => ({ ...node, contentKind: "culture", contentDepth: "deep" })),
      ...supplementData.nodes.map((node) => ({ ...node, contentKind: node.contentKind || contentKindFor(node), contentDepth: "brief" })),
      ...catalogData.nodes.map((node) => ({ ...node, contentKind: node.contentKind || contentKindFor(node), contentDepth: "catalog" })),
      ...heritageData.nodes.map((node) => ({ ...node, contentKind: "culture", contentDepth: "catalog" }))
    ].map(normalizeNode);
  } catch (error) {
    console.info("完整贵州城市指南尚未载入；通过项目本地服务器打开可载入全部内容。", error);
    return FALLBACK_NODES.map((node, index) => normalizeNode({ ...node, contentKind: "culture", contentDepth: "deep" }, index));
  }
}

async function loadDetails() {
  try {
    const [cultureResponse, attractionResponse, supplementResponse, catalogResponse, heritageResponse] = await Promise.all([
      fetch("../knowledge-base/culture-details.json"),
      fetch("../knowledge-base/attraction-details.json"),
      fetch("../knowledge-base/city-supplement.json"),
      fetch("../knowledge-base/city-catalog.json"),
      fetch("../knowledge-base/heritage-catalog.json")
    ]);
    if (!cultureResponse.ok || !attractionResponse.ok || !supplementResponse.ok || !catalogResponse.ok || !heritageResponse.ok) {
      throw new Error(`HTTP ${cultureResponse.status}/${attractionResponse.status}/${supplementResponse.status}/${catalogResponse.status}/${heritageResponse.status}`);
    }
    const [cultureDetails, attractionDetails, supplementData, catalogData, heritageData] = await Promise.all([
      cultureResponse.json(),
      attractionResponse.json(),
      supplementResponse.json(),
      catalogResponse.json(),
      heritageResponse.json()
    ]);
    const lightweightNodes = [
      ...(supplementData.nodes || []).map((node) => ({ ...node, contentDepth: "brief" })),
      ...(catalogData.nodes || []).map((node) => ({ ...node, contentDepth: "catalog" })),
      ...(heritageData.nodes || []).map((node) => ({ ...node, contentDepth: "catalog" }))
    ];
    const lightweightRecords = Object.fromEntries(lightweightNodes.map((node) => [node.id, lightweightDetailFor(node)]));
    return {
      records: { ...attractionDetails.records, ...cultureDetails.records, ...lightweightRecords },
      sources: { ...attractionDetails.sources, ...cultureDetails.sources, ...(supplementData.sources || {}), ...(catalogData.sources || {}), ...(heritageData.sources || {}) },
      coverage: {
        bound: Object.keys(attractionDetails.records || {}).length
          + Object.keys(cultureDetails.records || {}).length
          + Object.keys(lightweightRecords).length
      }
    };
  } catch (error) {
    console.info("详细贵州城市指南尚未载入，使用节点摘要作为临时内容。", error);
    return { records: {}, sources: {}, coverage: { bound: nodes.length } };
  }
}

async function loadSpectrum() {
  return nodes.map((node) => ({
    id: node.id,
    name: node.name,
    domain: node.domain,
    contentKind: node.contentKind,
    context: node.canvas?.entryObject || node.name
  }));
}

async function init() {
  applyEditionCopy();
  nodes = await loadNodes();
  const [details, spectrum] = await Promise.all([loadDetails(), loadSpectrum()]);
  detailRecords = details.records || {};
  sourceCatalog = details.sources || {};
  catalogEntries = spectrum.length ? spectrum : nodes;
  nodeById = new Map(nodes.map((node) => [node.id, node]));
  applyEditionCopy();
  renderChapterTabs();
  saveBookmarks();
  if (REQUESTED_VIEW === "journal") {
    setJournalMode(pageParams.has("city") ? "book" : "library");
    if (pageParams.get("open") === "1") openBook();
  }
}

initializeHistoryFootprints();
initializeJourneyManagement();
initializeWorkspaceModules();
setProductView(REQUESTED_VIEW || "travel");
initializeAiToolPanel();
initializeCommerceDiscovery();
init();
