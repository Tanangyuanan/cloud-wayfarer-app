"use strict";

const sourceRegistry = require("../data/ajing-world/data-sources.json");
const inferenceRules = require("../data/ajing-world/inference-rules.json");

const WORLD_SCHEMA_VERSION = "1.0.0";

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function expiresAfter(observedAt, minutes) {
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp + minutes * 60 * 1000).toISOString() : null;
}

function slugTime(value) {
  return String(value || "now").replace(/[^0-9A-Za-z]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
}

function clockMinute(value) {
  const match = String(value || "").match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function dailyMinute(value) {
  const matches = [...String(value || "").matchAll(/(\d{1,2}):(\d{2})/g)];
  if (!matches.length) return null;
  const match = matches[matches.length - 1];
  return Number(match[1]) * 60 + Number(match[2]);
}

function circularMinuteDistance(a, b) {
  const delta = Math.abs(a - b);
  return Math.min(delta, 1440 - delta);
}

function buildWorldSnapshot({ location, localTime, season, weather, airQuality, publicWorldData, observedAt }) {
  const at = observedAt || new Date().toISOString();
  const observations = [];
  const events = [];
  const sources = new Set(["cloud_wayfarer_server_clock", "cloud_wayfarer_location_graph"]);
  const degradedSources = [];
  const unconfiguredSources = [];
  const disabledSources = [];

  function addObservation({ dimension, metric, value, unit = null, sourceId, evidenceMode, confidence = 0.9, expiresMinutes = null }) {
    if (value == null || (typeof value === "number" && !Number.isFinite(value))) return null;
    const id = `${location.id}:${metric}:${slugTime(at)}`;
    observations.push({
      id,
      dimension,
      metric,
      value,
      unit,
      sourceId,
      evidenceMode,
      confidence,
      observedAt: at,
      expiresAt: expiresMinutes == null ? null : expiresAfter(at, expiresMinutes)
    });
    sources.add(sourceId);
    return id;
  }

  function addEvent({ type, subject, verb, title, evidenceMode, confidence, knowledgeMode, firstPersonBoundary, affects, basisObservationIds, expiresMinutes = 90, ruleId = null, attentionScore = 50 }) {
    events.push({
      id: `${location.id}:${type}:${slugTime(at)}`,
      type,
      subject,
      verb,
      title,
      evidenceMode,
      confidence,
      knowledgeMode,
      firstPersonBoundary,
      affects,
      basisObservationIds: basisObservationIds.filter(Boolean),
      expiresAt: expiresAfter(at, expiresMinutes),
      ruleId,
      attentionScore
    });
  }

  addObservation({ dimension: "时空", metric: "local_period", value: localTime?.period || "未知", sourceId: "cloud_wayfarer_server_clock", evidenceMode: "direct", confidence: 1 });
  addObservation({ dimension: "时空", metric: "season", value: season || "未知", sourceId: "cloud_wayfarer_server_clock", evidenceMode: "calculated", confidence: 0.95 });
  addObservation({ dimension: "时空", metric: "latitude", value: location.latitude, unit: "degree", sourceId: "cloud_wayfarer_location_graph", evidenceMode: "direct", confidence: 1 });
  addObservation({ dimension: "时空", metric: "longitude", value: location.longitude, unit: "degree", sourceId: "cloud_wayfarer_location_graph", evidenceMode: "direct", confidence: 1 });

  const weatherObservationIds = {};
  if (weather?.available) {
    sources.add("open_meteo_forecast");
    const weatherFields = [
      ["condition", "天气", weather.condition, null],
      ["temperature_c", "身体", finite(weather.temperatureC), "°C"],
      ["apparent_temperature_c", "身体", finite(weather.apparentTemperatureC), "°C"],
      ["relative_humidity_percent", "身体", finite(weather.relativeHumidityPercent), "%"],
      ["precipitation_mm", "天气", finite(weather.precipitationMm), "mm"],
      ["wind_kph", "天气", finite(weather.windKph), "km/h"],
      ["wind_direction_deg", "天气", finite(weather.windDirectionDeg), "degree"],
      ["wind_gust_kph", "天气", finite(weather.windGustKph), "km/h"],
      ["cloud_cover_percent", "天空", finite(weather.cloudCoverPercent), "%"],
      ["visibility_m", "天空", finite(weather.visibilityM), "m"],
      ["surface_pressure_hpa", "身体", finite(weather.surfacePressureHpa), "hPa"],
      ["is_day", "光线", typeof weather.isDay === "boolean" ? weather.isDay : null, null],
      ["model_elevation_m", "地形", finite(weather.modelElevationM), "m"]
    ];
    for (const [metric, dimension, value, unit] of weatherFields) {
      weatherObservationIds[metric] = addObservation({
        dimension,
        metric,
        value,
        unit,
        sourceId: "open_meteo_forecast",
        evidenceMode: "modelled_observation",
        confidence: 0.85,
        expiresMinutes: 90
      });
    }

    const raining = Number(weather.precipitationMm) > 0 || /雨|雪|雷/.test(String(weather.condition || ""));
    if (raining) {
      addEvent({
        type: "active_precipitation",
        subject: `${location.name}的天气`,
        verb: "开始或持续降水",
        title: `${location.name}此刻有${weather.condition || "降水"}`,
        evidenceMode: "modelled_observation",
        confidence: 0.9,
        knowledgeMode: "direct_experience",
        firstPersonBoundary: "可以写降水怎样落到身体和露天环境；不能凭天气模型补写具体人物、鸟兽或店铺活动。",
        affects: ["身体", "衣着", "路线", "拍摄"],
        basisObservationIds: [weatherObservationIds.condition, weatherObservationIds.precipitation_mm],
        ruleId: "active_precipitation",
        attentionScore: 82
      });
      addEvent({
        type: "wet_ground_risk",
        subject: `${location.name}的露天路面`,
        verb: "可能变湿滑",
        title: "露天路面可能因降水变湿",
        evidenceMode: "derived",
        confidence: 0.7,
        knowledgeMode: "inference_only",
        firstPersonBoundary: "只能作为选鞋和减速依据，不能断言某一级台阶或室内地面已经湿滑。",
        affects: ["鞋具", "速度", "路线"],
        basisObservationIds: [weatherObservationIds.condition, weatherObservationIds.precipitation_mm],
        ruleId: "wet_ground_risk",
        attentionScore: 74
      });
    }

    if (/雾/.test(String(weather.condition || ""))) {
      addEvent({
        type: "confirmed_fog",
        subject: `${location.name}的空气`,
        verb: "出现雾",
        title: `${location.name}当前天气为有雾`,
        evidenceMode: "modelled_observation",
        confidence: 0.88,
        knowledgeMode: "direct_experience",
        firstPersonBoundary: "可以写雾对观看范围、湿感和路线的影响；具体山峰是否消失仍需影像或能见度佐证。",
        affects: ["能见度", "路线", "光线", "停留"],
        basisObservationIds: [weatherObservationIds.condition, weatherObservationIds.visibility_m],
        ruleId: "confirmed_fog",
        attentionScore: 86
      });
    }

    if (finite(weather.visibilityM) != null && Number(weather.visibilityM) < 3000) {
      addEvent({
        type: "low_visibility",
        subject: `${location.name}的可见范围`,
        verb: "缩短",
        title: `当前能见度约${Math.round(Number(weather.visibilityM))}米`,
        evidenceMode: "modelled_observation",
        confidence: 0.86,
        knowledgeMode: "tool_known",
        firstPersonBoundary: "可影响安全和观看范围；不能由区域模型断言某个具体景物完全不可见。",
        affects: ["安全", "路线", "观看范围"],
        basisObservationIds: [weatherObservationIds.visibility_m],
        ruleId: "low_visibility",
        attentionScore: 88
      });
    }

    const humidity = finite(weather.relativeHumidityPercent);
    const apparent = finite(weather.apparentTemperatureC ?? weather.temperatureC);
    if (humidity != null && humidity >= 85) {
      const load = apparent != null && apparent >= 27 ? "闷热负担" : apparent != null && apparent <= 16 ? "潮冷负担" : "湿感负担";
      addEvent({
        type: "humid_body_load",
        subject: "阿镜的身体",
        verb: "受到湿度影响",
        title: `高湿度可能带来${load}`,
        evidenceMode: "derived",
        confidence: 0.72,
        knowledgeMode: "inference_only",
        firstPersonBoundary: "这是身体推演候选；只有结合衣着、活动量和连续状态后才能写成阿镜的实际感受。",
        affects: ["舒适度", "衣着", "休息", "行走速度"],
        basisObservationIds: [weatherObservationIds.relative_humidity_percent, weatherObservationIds.apparent_temperature_c],
        ruleId: "humid_body_load",
        attentionScore: 70
      });
    }

    const nowMinute = clockMinute(localTime?.localText);
    const sunriseMinute = dailyMinute(weather.today?.sunrise);
    const sunsetMinute = dailyMinute(weather.today?.sunset);
    if (nowMinute != null && ((sunriseMinute != null && circularMinuteDistance(nowMinute, sunriseMinute) <= 60) || (sunsetMinute != null && circularMinuteDistance(nowMinute, sunsetMinute) <= 60))) {
      const nearSunrise = sunriseMinute != null && circularMinuteDistance(nowMinute, sunriseMinute) <= 60;
      addEvent({
        type: "golden_hour_window",
        subject: `${location.name}的自然光`,
        verb: `接近${nearSunrise ? "日出" : "日落"}`,
        title: `当前接近${nearSunrise ? "日出" : "日落"}光线窗口`,
        evidenceMode: "calculated",
        confidence: 0.92,
        knowledgeMode: "inference_only",
        firstPersonBoundary: "只能说明太阳时段；云层、山体和建筑遮挡可能使金色光线不可见。",
        affects: ["光线注意", "拍摄", "停留"],
        basisObservationIds: [weatherObservationIds.is_day],
        ruleId: "golden_hour_window",
        attentionScore: 68
      });
    }
  } else {
    degradedSources.push("open_meteo_forecast");
  }

  const airObservationIds = {};
  if (airQuality?.available) {
    sources.add("open_meteo_air_quality");
    const airFields = [
      ["us_aqi", airQuality.usAqi, "index"],
      ["pm2_5", airQuality.pm25, "μg/m³"],
      ["pm10", airQuality.pm10, "μg/m³"],
      ["ozone", airQuality.ozone, "μg/m³"],
      ["nitrogen_dioxide", airQuality.nitrogenDioxide, "μg/m³"],
      ["sulphur_dioxide", airQuality.sulphurDioxide, "μg/m³"],
      ["carbon_monoxide", airQuality.carbonMonoxide, "μg/m³"]
    ];
    for (const [metric, value, unit] of airFields) {
      airObservationIds[metric] = addObservation({
        dimension: "空气",
        metric,
        value: finite(value),
        unit,
        sourceId: "open_meteo_air_quality",
        evidenceMode: "modelled_observation",
        confidence: 0.75,
        expiresMinutes: 180
      });
    }
    if (finite(airQuality.usAqi) != null && Number(airQuality.usAqi) >= 100) {
      addEvent({
        type: "air_quality_load",
        subject: "阿镜的户外活动",
        verb: "需要降低强度",
        title: `空气质量指数为${Math.round(Number(airQuality.usAqi))}，户外活动需要更克制`,
        evidenceMode: "derived",
        confidence: 0.75,
        knowledgeMode: "tool_known",
        firstPersonBoundary: "这是区域空气模型带来的活动建议，不等同于阿镜已经出现呼吸症状。",
        affects: ["活动强度", "路线", "停留"],
        basisObservationIds: [airObservationIds.us_aqi, airObservationIds.pm2_5],
        ruleId: "air_quality_load",
        attentionScore: 92
      });
    }
  } else if (airQuality) {
    degradedSources.push("open_meteo_air_quality");
  }

  const publicSourceMap = {
    elevation: "open_meteo_elevation",
    history: "open_meteo_history",
    flood: "open_meteo_flood",
    gbif: "gbif_occurrence_api",
    inaturalist: "inaturalist_observations",
    earthquakes: "usgs_earthquake_feed",
    fires: "nasa_firms",
    orbital: "celestrak_gp",
    aviation: "opensky_live"
  };
  for (const [key, result] of Object.entries(publicWorldData || {})) {
    const sourceId = publicSourceMap[key];
    if (!sourceId || result?.available) continue;
    if (String(result?.reason || "").startsWith("missing_")) unconfiguredSources.push(sourceId);
    else if (result?.reason === "disabled") disabledSources.push(sourceId);
    else degradedSources.push(sourceId);
  }

  const elevation = publicWorldData?.elevation;
  if (elevation?.available) {
    addObservation({
      dimension: "地形", metric: "terrain_elevation_m", value: finite(elevation.elevationM), unit: "m",
      sourceId: "open_meteo_elevation", evidenceMode: "modelled_observation", confidence: 0.94, expiresMinutes: 43_200
    });
  }

  const history = publicWorldData?.history;
  const historyObservationIds = {};
  if (history?.available) {
    const fields = [
      ["historical_normal_max_temperature_c", history.normalMaxTemperatureC, "°C"],
      ["historical_normal_min_temperature_c", history.normalMinTemperatureC, "°C"],
      ["historical_normal_precipitation_mm", history.normalPrecipitationMm, "mm/day"],
      ["historical_precipitation_p90_mm", history.precipitationP90Mm, "mm/day"],
      ["historical_precipitation_p95_mm", history.precipitationP95Mm, "mm/day"],
      ["historical_sample_days", history.sampleDays, "days"]
    ];
    for (const [metric, value, unit] of fields) {
      historyObservationIds[metric] = addObservation({
        dimension: "历史基线", metric, value: finite(value), unit,
        sourceId: "open_meteo_history", evidenceMode: "reanalysis", confidence: 0.82, expiresMinutes: 10_080
      });
    }
    const forecastMax = finite(weather?.today?.maxTemperatureC);
    const normalMax = finite(history.normalMaxTemperatureC);
    if (forecastMax != null && normalMax != null && Math.abs(forecastMax - normalMax) >= 5) {
      const warmer = forecastMax > normalMax;
      addEvent({
        type: "temperature_departure_from_history",
        subject: `${location.name}今天的最高气温`, verb: warmer ? "显著高于历史同期" : "显著低于历史同期",
        title: `今天预计最高温比历史同期${warmer ? "高" : "低"}约${Math.abs(forecastMax - normalMax).toFixed(1)}℃`,
        evidenceMode: "derived", confidence: 0.78, knowledgeMode: "inference_only",
        firstPersonBoundary: "这是预报与再分析历史样本的比较，不是站点极值纪录，也不能直接写成身体已经感到异常。",
        affects: ["身体准备", "衣着", "理解季节", "事件记忆"],
        basisObservationIds: [weatherObservationIds.temperature_c, historyObservationIds.historical_normal_max_temperature_c],
        ruleId: "event_rarity", expiresMinutes: 720, attentionScore: 72
      });
    }
  }

  const flood = publicWorldData?.flood;
  if (flood?.available) {
    const currentId = addObservation({
      dimension: "水", metric: "modelled_river_discharge_m3s", value: finite(flood.currentDischargeM3s), unit: "m³/s",
      sourceId: "open_meteo_flood", evidenceMode: "modelled_observation", confidence: 0.62, expiresMinutes: 360
    });
    const forecastMaxId = addObservation({
      dimension: "水", metric: "modelled_seven_day_discharge_max_m3s", value: finite(flood.sevenDayForecastMaxM3s), unit: "m³/s",
      sourceId: "open_meteo_flood", evidenceMode: "modelled_observation", confidence: 0.58, expiresMinutes: 360
    });
    const current = finite(flood.currentDischargeM3s);
    const forecastMax = finite(flood.sevenDayForecastMaxM3s);
    if (current != null && forecastMax != null && current > 0 && forecastMax >= current * 1.5 && forecastMax - current >= 10) {
      addEvent({
        type: "modelled_river_rise", subject: `${location.name}附近约5公里水文网格`, verb: "未来七日流量模型上升",
        title: `全球河流模型提示附近网格流量可能由${current}升至${forecastMax}m³/s`,
        evidenceMode: "derived", confidence: 0.58, knowledgeMode: "tool_known",
        firstPersonBoundary: "这是GloFAS约5公里网格中最大河流的模拟，不代表具体景点、溪流或水文站实测，安全判断必须核验贵州官方信息。",
        affects: ["水边安全", "路线", "瀑布关注", "地方理解"], basisObservationIds: [currentId, forecastMaxId],
        expiresMinutes: 360, attentionScore: 84
      });
    }
  }

  const gbif = publicWorldData?.gbif;
  if (gbif?.available) {
    addObservation({
      dimension: "生命", metric: "nearby_gbif_occurrences",
      value: { radiusKmApprox: gbif.radiusKmApprox, total: gbif.totalInBoundingBox, records: gbif.records },
      sourceId: "gbif_occurrence_api", evidenceMode: "reported_observation", confidence: 0.68, expiresMinutes: 360
    });
  }

  const inaturalist = publicWorldData?.inaturalist;
  if (inaturalist?.available) {
    const observationId = addObservation({
      dimension: "生命", metric: "nearby_inaturalist_observations",
      value: { radiusKm: inaturalist.radiusKm, total: inaturalist.total, records: inaturalist.records },
      sourceId: "inaturalist_observations", evidenceMode: "reported_observation", confidence: 0.72, expiresMinutes: 60
    });
    const recentCutoff = Date.parse(at) - 30 * 86_400_000;
    const recent = (inaturalist.records || []).filter((record) => Date.parse(record.observedOn || 0) >= recentCutoff);
    if (recent.length) {
      addEvent({
        type: "recent_nature_reports", subject: `${location.name}附近的自然观察者`, verb: "提交近期物种记录",
        title: `附近近30天有${recent.length}条可查询的自然观察`,
        evidenceMode: "reported_observation", confidence: 0.7, knowledgeMode: "tool_known",
        firstPersonBoundary: "只能说有人在附近提交过记录；坐标可能模糊，鉴定可能更新，绝不能改写成阿镜亲眼看见。",
        affects: ["自然注意", "探索方向", "地方理解"], basisObservationIds: [observationId],
        expiresMinutes: 360, attentionScore: 52
      });
    }
  }

  const earthquakes = publicWorldData?.earthquakes;
  if (earthquakes?.available) {
    const observationId = addObservation({
      dimension: "地质", metric: "nearby_earthquakes_7d",
      value: { radiusKm: earthquakes.radiusKm, events: earthquakes.events },
      sourceId: "usgs_earthquake_feed", evidenceMode: "reported_observation", confidence: 0.88, expiresMinutes: 15
    });
    const notable = (earthquakes.events || []).find((event) => Number(event.magnitude) >= 3.5);
    if (notable) {
      addEvent({
        type: "nearby_earthquake_report", subject: `${notable.distanceKm}公里外的地层`, verb: "发生地震事件",
        title: `USGS记录到附近M${notable.magnitude}地震（距当前位置约${notable.distanceKm}公里）`,
        evidenceMode: "reported_observation", confidence: 0.86, knowledgeMode: "tool_known",
        firstPersonBoundary: "这是地震目录事件，不表示阿镜所在地一定有震感；中国境内应继续核验中国地震台网正式信息。",
        affects: ["安全", "路线", "地质理解"], basisObservationIds: [observationId],
        expiresMinutes: 60, attentionScore: Math.min(99, 70 + Number(notable.magnitude) * 5)
      });
    }
  }

  const fires = publicWorldData?.fires;
  if (fires?.available) {
    const observationId = addObservation({
      dimension: "生态安全", metric: "nearby_satellite_thermal_detections_2d",
      value: { radiusKmApprox: fires.radiusKmApprox, detections: fires.detections },
      sourceId: "nasa_firms", evidenceMode: "modelled_observation", confidence: 0.78, expiresMinutes: 30
    });
    if ((fires.detections || []).length) {
      addEvent({
        type: "nearby_thermal_detection", subject: `${location.name}周边卫星像元`, verb: "出现热异常探测",
        title: `NASA FIRMS在周边记录到${fires.detections.length}个热异常点`,
        evidenceMode: "modelled_observation", confidence: 0.78, knowledgeMode: "tool_known",
        firstPersonBoundary: "卫星热异常不自动等于森林火灾；只能作为安全核查线索，需结合应急和林业部门信息确认。",
        affects: ["安全", "路线", "生态关注"], basisObservationIds: [observationId],
        expiresMinutes: 30, attentionScore: 95
      });
    }
  }

  const orbital = publicWorldData?.orbital;
  if (orbital?.available) {
    const observationId = addObservation({
      dimension: "天空", metric: "iss_passes_next_24h",
      value: { elementEpoch: orbital.elementEpoch, passes: orbital.passes },
      sourceId: "celestrak_gp", evidenceMode: "calculated", confidence: 0.8, expiresMinutes: 360
    });
    if (orbital.nextVisiblePass) {
      const pass = orbital.nextVisiblePass;
      addEvent({
        type: "possible_visible_iss_pass", subject: "国际空间站", verb: "可能从当前位置上空可见",
        title: `国际空间站可能在${pass.startAt}后经过，最高仰角约${pass.maxElevationDeg}°`,
        evidenceMode: "calculated", confidence: 0.8, knowledgeMode: "inference_only",
        firstPersonBoundary: "可见性由轨道、太阳高度和地影计算，仍可能受云、山体、建筑和轨道更新误差影响；看见前不能写成目击。",
        affects: ["天空注意", "停留", "共同观看", "事件记忆"], basisObservationIds: [observationId],
        expiresMinutes: 360, attentionScore: 76
      });
    }
  }

  const aviation = publicWorldData?.aviation;
  if (aviation?.available) {
    const observationId = addObservation({
      dimension: "天空", metric: "nearby_aircraft_states",
      value: { radiusKmApprox: aviation.radiusKmApprox, observedAt: aviation.observedAt, aircraft: aviation.aircraft },
      sourceId: "opensky_live", evidenceMode: "reported_observation", confidence: 0.76, expiresMinutes: 10
    });
    if ((aviation.aircraft || []).length) {
      addEvent({
        type: "aircraft_in_nearby_airspace", subject: `${location.name}周边空域`, verb: "存在被接收站捕获的航空器",
        title: `OpenSky当前捕获到周边${aviation.aircraft.length}架航空器`,
        evidenceMode: "reported_observation", confidence: 0.72, knowledgeMode: "tool_known",
        firstPersonBoundary: "仅代表OpenSky接收站覆盖到的ADS-B/Mode S状态，不能推断完整航班、乘客、出发地或实际可见性。",
        affects: ["天空注意", "交通理解"], basisObservationIds: [observationId],
        expiresMinutes: 10, attentionScore: 42
      });
    }
  }

  events.sort((a, b) => b.attentionScore - a.attentionScore || b.confidence - a.confidence);
  return {
    schemaVersion: WORLD_SCHEMA_VERSION,
    observedAt: at,
    location: {
      id: location.id,
      name: location.name,
      region: location.region || null,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      modelElevationM: finite(elevation?.elevationM ?? weather?.modelElevationM)
    },
    observations,
    events,
    sources: [...sources],
    maintenance: {
      sourceRegistryVersion: sourceRegistry.meta.version,
      inferenceRulesVersion: inferenceRules.meta.version,
      degradedSources: [...new Set(degradedSources)],
      unconfiguredSources: [...new Set(unconfiguredSources)],
      disabledSources: [...new Set(disabledSources)]
    }
  };
}

function validateWorldSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== "object") return { valid: false, errors: ["snapshot_missing"] };
  if (snapshot.schemaVersion !== WORLD_SCHEMA_VERSION) errors.push("schema_version_invalid");
  if (!snapshot.location?.id || !Number.isFinite(snapshot.location?.latitude) || !Number.isFinite(snapshot.location?.longitude)) errors.push("location_invalid");
  if (!Array.isArray(snapshot.observations)) errors.push("observations_invalid");
  if (!Array.isArray(snapshot.events)) errors.push("events_invalid");
  if (!Array.isArray(snapshot.sources)) errors.push("sources_invalid");
  for (const event of snapshot.events || []) {
    if (!event.id || !event.type || !event.evidenceMode || !event.knowledgeMode) errors.push(`event_invalid:${event?.id || "unknown"}`);
    if (!Array.isArray(event.affects) || !event.affects.length) errors.push(`event_without_effect:${event?.id || "unknown"}`);
    if (!Array.isArray(event.basisObservationIds)) errors.push(`event_without_basis:${event?.id || "unknown"}`);
  }
  return { valid: errors.length === 0, errors };
}

function dataCatalogSummary() {
  const counts = {};
  for (const source of sourceRegistry.sources) counts[source.integrationStatus] = (counts[source.integrationStatus] || 0) + 1;
  return {
    sourceRegistryVersion: sourceRegistry.meta.version,
    inferenceRulesVersion: inferenceRules.meta.version,
    sourceCounts: counts,
    implementedRules: inferenceRules.rules.filter((rule) => rule.status === "implemented").map((rule) => rule.id)
  };
}

module.exports = {
  WORLD_SCHEMA_VERSION,
  buildWorldSnapshot,
  validateWorldSnapshot,
  dataCatalogSummary,
  sourceRegistry,
  inferenceRules
};
