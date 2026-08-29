"use strict";

// 这些地点不是预设路线，而是 Agent 当前可核验、可落图的探索锚点。
// 路线由 Agent 在运行时逐站长出；新增知识和坐标后，可以继续扩充这里。
const LOCATIONS = {
  guiyang: {
    id: "guiyang",
    name: "贵阳",
    latitude: 26.571358,
    longitude: 106.719721,
    timezone: "Asia/Shanghai",
    region: "贵阳",
    focus: "省城水岸、街巷与当代公共生活",
    tags: ["城市", "日常", "美食"],
    visit: {
      name: "甲秀楼",
      district: "贵阳 · 南明区",
      focus: "甲秀楼、浮玉桥与南明河水岸的城市日常",
      knowledgeIds: ["CTY-003", "IHC-GY-006", "FOD-GY-01", "CON-006"],
      wander: "先以甲秀楼和浮玉桥为锚点，再沿南明河岸、翠微巷与周边街巷慢慢游走。"
    }
  },
  qingyan: { id: "qingyan", name: "青岩古镇", latitude: 26.331095, longitude: 106.686834, timezone: "Asia/Shanghai", region: "贵阳", focus: "石城街巷、山势排水与古镇生活", tags: ["古镇", "建筑", "日常"] },
  xiuwen: { id: "xiuwen", name: "修文龙场", latitude: 26.8389, longitude: 106.594, timezone: "Asia/Shanghai", region: "贵阳", focus: "龙场悟道，以及困境中的知与行", tags: ["思想", "历史", "书院"] },
  anshun: { id: "anshun", name: "安顺老城", latitude: 26.2537, longitude: 105.9476, timezone: "Asia/Shanghai", region: "安顺", focus: "屯堡、城巷与黔中生活", tags: ["城市", "屯堡", "美食"] },
  huangguoshu: { id: "huangguoshu", name: "黄果树", latitude: 25.9907, longitude: 105.6664, timezone: "Asia/Shanghai", region: "安顺", focus: "瀑布群、水汽与喀斯特河流", tags: ["山水", "瀑布", "地质"] },
  zhijin: { id: "zhijin", name: "织金洞", latitude: 26.748, longitude: 105.87, timezone: "Asia/Shanghai", region: "毕节", focus: "地下喀斯特、洞穴尺度与地质时间", tags: ["山水", "洞穴", "地质"] },
  bijie: { id: "bijie", name: "毕节", latitude: 27.2985, longitude: 105.305, timezone: "Asia/Shanghai", region: "毕节", focus: "乌蒙山地、城市生活与多民族交往", tags: ["城市", "山地", "日常"] },
  weining: { id: "weining", name: "威宁草海", latitude: 26.8562, longitude: 104.2782, timezone: "Asia/Shanghai", region: "毕节", focus: "高原湿地、候鸟与湖畔生活", tags: ["生态", "湿地", "候鸟"] },
  liupanshui: { id: "liupanshui", name: "六盘水", latitude: 26.5927, longitude: 104.8304, timezone: "Asia/Shanghai", region: "六盘水", focus: "高原气候、工业城市与社区生活", tags: ["城市", "工业", "日常"] },
  xingyi: { id: "xingyi", name: "兴义万峰林", latitude: 25.0881, longitude: 104.958, timezone: "Asia/Shanghai", region: "黔西南", focus: "峰林、田坝与布依族村寨生活", tags: ["山水", "村寨", "布依族"] },
  libo: { id: "libo", name: "荔波", latitude: 25.411, longitude: 107.8877, timezone: "Asia/Shanghai", region: "黔南", focus: "喀斯特森林、水系与社区共生", tags: ["山水", "生态", "水"] },
  duyun: { id: "duyun", name: "都匀", latitude: 26.2594, longitude: 107.5187, timezone: "Asia/Shanghai", region: "黔南", focus: "剑江、毛尖茶与城市日常", tags: ["城市", "茶", "日常"] },
  kaili: { id: "kaili", name: "凯里", latitude: 26.5669, longitude: 107.981, timezone: "Asia/Shanghai", region: "黔东南", focus: "区域市场、酸食与苗侗文化交汇", tags: ["城市", "美食", "非遗"] },
  xijiang: { id: "xijiang", name: "西江千户苗寨", latitude: 26.5025, longitude: 108.1747, timezone: "Asia/Shanghai", region: "黔东南", focus: "苗寨聚落、节庆展示与当代生活", tags: ["村寨", "苗族", "非遗"] },
  zhenyuan: { id: "zhenyuan", name: "镇远古城", latitude: 27.0493, longitude: 108.4297, timezone: "Asia/Shanghai", region: "黔东南", focus: "㵲阳河、山地城镇与交通史", tags: ["古城", "河流", "历史"] },
  tongren: { id: "tongren", name: "铜仁", latitude: 27.7315, longitude: 109.1896, timezone: "Asia/Shanghai", region: "铜仁", focus: "锦江、黔东门户与城市生活", tags: ["城市", "河流", "日常"] },
  fanjingshan: { id: "fanjingshan", name: "梵净山", latitude: 27.8959, longitude: 108.6969, timezone: "Asia/Shanghai", region: "铜仁", focus: "山地生态、佛教文化与自然保护", tags: ["山水", "生态", "宗教"] },
  zunyi: { id: "zunyi", name: "遵义老城", latitude: 27.7257, longitude: 106.9272, timezone: "Asia/Shanghai", region: "遵义", focus: "遵义会议、老城街巷与历史转折", tags: ["城市", "红色文化", "历史"] },
  hailongtun: { id: "hailongtun", name: "海龙屯", latitude: 27.8148, longitude: 106.8227, timezone: "Asia/Shanghai", region: "遵义", focus: "土司遗址、山地权力与防御工程", tags: ["遗址", "土司", "历史"] },
  maotai: { id: "maotai", name: "茅台镇", latitude: 27.8547, longitude: 106.3717, timezone: "Asia/Shanghai", region: "遵义", focus: "赤水河、酿造产业与河谷城镇", tags: ["酒", "工业", "河流"] },
  chishui: { id: "chishui", name: "赤水河谷", latitude: 28.5906, longitude: 105.6975, timezone: "Asia/Shanghai", region: "遵义", focus: "丹霞、渡口、酿造与河谷生活", tags: ["山水", "河流", "日常"] }
};

const START_LOCATION_ID = "guiyang";

// 首发起点池只收录已经具备稳定坐标、现场叙事与视觉素材的地点。
// 随机的是阿镜落脚的入口，不随机事实本身；后续可在内容验收后继续扩充。
const START_LOCATION_IDS = ["guiyang", "qingyan", "xiuwen", "zunyi", "hailongtun", "chishui", "fanjingshan"];

function pickStartLocation(random = Math.random) {
  const value = Number(random());
  const normalized = Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
  return resolveLocation(START_LOCATION_IDS[Math.floor(normalized * START_LOCATION_IDS.length)]);
}

function resolveLocation(value) {
  const id = String(value || START_LOCATION_ID).toLowerCase();
  return LOCATIONS[id] || LOCATIONS[START_LOCATION_ID];
}

function distanceKm(a, b) {
  const radians = (value) => value * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const latA = radians(a.latitude);
  const latB = radians(b.latitude);
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.min(1, Math.sqrt(value)));
}

function explorationCandidates({ currentLocationId, visited = [], theme = "", commission = "", limit = 12 } = {}) {
  const current = resolveLocation(currentLocationId);
  const visitedSet = new Set(visited);
  const intent = `${theme} ${commission}`.toLowerCase();
  const ranked = Object.values(LOCATIONS)
    .filter((location) => location.id !== current.id && !visitedSet.has(location.id))
    .map((location) => {
      const distance = distanceKm(current, location);
      const themeMatches = (location.tags || []).filter((tag) => intent.includes(tag.toLowerCase())).length;
      const distanceFit = distance >= 25 && distance <= 210 ? 3 : distance <= 320 ? 1 : -2;
      const regionNovelty = visited.some((id) => resolveLocation(id).region === location.region) ? 0 : 2;
      return { ...location, distanceKm: Math.round(distance), score: themeMatches * 5 + distanceFit + regionNovelty };
    })
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm || a.name.localeCompare(b.name, "zh-CN"));
  return ranked.slice(0, Math.max(1, Math.min(20, limit)));
}

function fallbackNextLocation(journey) {
  const candidates = explorationCandidates({
    currentLocationId: journey.state.currentLocationId,
    visited: journey.route,
    theme: journey.settings?.theme,
    commission: journey.settings?.commission,
    limit: 1
  });
  if (candidates[0]) return candidates[0];
  const previous = [...journey.route].reverse().find((id) => id !== journey.state.currentLocationId);
  return resolveLocation(previous || START_LOCATION_ID);
}

function describeJourneyRoute(currentLocationId, routeIds = [currentLocationId]) {
  const ids = Array.isArray(routeIds) && routeIds.length ? routeIds : [currentLocationId];
  const stops = ids.map((id, index) => ({ ...resolveLocation(id), order: index + 1 }));
  const currentIndex = Math.max(0, ids.lastIndexOf(resolveLocation(currentLocationId).id));
  return {
    stops,
    currentStop: stops[currentIndex] || { ...resolveLocation(currentLocationId), order: stops.length || 1 },
    routeText: stops.map((stop) => stop.name).join(" → "),
    editorialIntent: "这不是预先编排的游线。阿镜根据当下环境、身体、用户留下的线索与已经走过的地方，自主选择下一站；尚未抵达的地点不构成产品承诺。"
  };
}

module.exports = {
  LOCATIONS,
  START_LOCATION_ID,
  START_LOCATION_IDS,
  pickStartLocation,
  resolveLocation,
  distanceKm,
  explorationCandidates,
  fallbackNextLocation,
  describeJourneyRoute
};
