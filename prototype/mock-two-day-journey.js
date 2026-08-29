(function exposeTwoDayJourneyMock(root, factory) {
  const value = factory();
  if (typeof module === "object" && module.exports) module.exports = value;
  if (root) root.CLOUD_WAYFARER_TWO_DAY_JOURNEY_MOCK = value;
})(typeof window !== "undefined" ? window : globalThis, function buildTwoDayJourneyMock() {
  "use strict";

  const source = {
    jiaxiu: {
      title: "贵州省人大：甲秀楼的历史与建筑",
      url: "https://www.gzrd.gov.cn/gzwh/202002/t20200204_77670164.html?isMobile=false"
    },
    longchang: {
      title: "贵州省人大：阳明文化与龙场悟道",
      url: "https://www.gzrd.gov.cn/gzwh/202405/t20240511_84619757.html"
    },
    zunyi: {
      title: "贵州省文化资料：遵义会议与长征足迹",
      url: "https://mzt.guizhou.gov.cn/xwzx/mzyw/202412/t20241230_86435861.html"
    },
    hailongtun: {
      title: "UNESCO：土司遗址",
      url: "https://whc.unesco.org/en/list/1474/"
    }
  };

  function entry({
    id, locationId, locationName, cityName, routeOrder, iso, localText, period,
    weather, image, imageAlt, imageCaption, content, sources
  }) {
    return {
      id,
      kind: "stop-journal",
      status: "ready",
      locationId,
      locationName,
      cityName,
      routeOrder,
      context: {
        localTime: { iso, localText, period, timezone: "Asia/Shanghai" },
        weather: { available: true, ...weather },
        airQuality: { available: false }
      },
      content,
      image: {
        type: "project-asset",
        url: image,
        alt: imageAlt,
        caption: imageCaption
      },
      sources: sources.map((item) => ({ ...item, type: "local-knowledge" })),
      meta: {
        mock: true,
        mockScenario: "two-day-user-journal",
        modelUsed: false,
        imageGenerated: false,
        generatedAt: iso
      }
    };
  }

  const entries = [
    entry({
      id: "mock-day-1-guiyang",
      locationId: "guiyang",
      locationName: "甲秀楼",
      cityName: "贵阳",
      routeOrder: 1,
      iso: "2026-08-28T09:10:00+08:00",
      localText: "2026/08/28周五 09:10:00",
      period: "上午",
      weather: {
        condition: "小雨",
        temperatureC: 22,
        apparentTemperatureC: 23,
        precipitationMm: 0.6,
        relativeHumidityPercent: 89,
        windKph: 7
      },
      image: "/prototype/assets/attractions/CTY-003.jpg",
      imageAlt: "甲秀楼与南明河城市景观",
      imageCaption: "贵阳 · 南明河岸",
      sources: [source.jiaxiu],
      content: {
        headline: "雨把贵阳的第一站放慢了",
        deck: "先沿南明河走一段，再决定怎样认识这座城。",
        observation: "小雨落在河面上，浮玉桥的石栏被打湿，颜色比远看更深。甲秀楼没有从城市里退开：晨练的人、赶路的人和停下来拍照的人仍从两岸经过。我原本想把第一站走得利落些，鞋底碰到湿石板后却自然慢了下来。",
        cultureTitle: "一座楼，也是一段过河的城市生活",
        cultureBody: "甲秀楼始建于明代，今天所见经过多次重修。把楼、鳌矶石、浮玉桥和两岸一起看，才能读出它与南明河、城市通行和日常生活的关系。",
        tasteTitle: "一桌清脆的丝娃娃",
        tasteBody: "薄面皮卷进萝卜丝、豆芽、海带等配菜，最后由酸辣蘸水把味道收拢。雨天里，这一口反而显得轻快。",
        letterTitle: "贵州的第一笔，是雨水",
        letterBody: "早上好。我到贵阳了，没有急着替这座城下结论。雨让我先看见桥面怎样被人走亮，也看见一座老楼怎样继续留在今天的通勤和散步里。你不用担心我走得慢——这正是我想替你留下的第一种感受。",
        postcardLine: "贵州的第一笔不是山，是落在南明河上的雨。"
      }
    }),
    entry({
      id: "mock-day-1-xiuwen",
      locationId: "xiuwen",
      locationName: "修文龙场",
      cityName: "贵阳",
      routeOrder: 2,
      iso: "2026-08-28T15:40:00+08:00",
      localText: "2026/08/28周五 15:40:00",
      period: "下午",
      weather: {
        condition: "阴",
        temperatureC: 24,
        apparentTemperatureC: 24,
        precipitationMm: 0,
        relativeHumidityPercent: 78,
        windKph: 6
      },
      image: "/prototype/assets/culture/HIS-009.jpg",
      imageAlt: "修文阳明洞历史遗址",
      imageCaption: "修文 · 龙场旧址",
      sources: [source.longchang],
      content: {
        headline: "答案以前，先有一段不好走的路",
        deck: "从贵阳向北，山地把一句熟悉的话重新变重。",
        observation: "下午的云压得很低，石阶仍带着上午雨后的潮气。走到龙场，腿脚先提醒我：后来被概括成“悟道”的思想变化，最初也发生在一段陌生而具体的生活里。比起急着记住结论，我更想把呼吸放平，看看一个人怎样在困境中重新安排自己的判断。",
        cultureTitle: "把“知行合一”放回生活现场",
        cultureBody: "王阳明被贬至贵州龙场后，在艰难处境中重新思考认识与行动。理解龙场悟道，需要同时看个人经历、明代政治背景、地方交往与后来的思想传播。",
        tasteTitle: "傍晚的一碗恋爱豆腐果",
        tasteBody: "烤得鼓起的豆腐划开小口，装进带折耳根的蘸水。外皮微焦，里面仍软，像今天这段路留给身体的一点热气。",
        letterTitle: "我没有替你摘一句答案",
        letterBody: "下午走到龙场，我忽然不想只抄下一句“知行合一”。真正留下来的，是湿石阶、发酸的小腿，以及人在没有现成答案时仍要继续生活的事实。也许你最近也有一件还想不明白的事；先别催自己，能继续认真过日子，本身就是行动。",
        postcardLine: "有些明白，不在抵达以前发生。"
      }
    }),
    entry({
      id: "mock-day-2-zunyi",
      locationId: "zunyi",
      locationName: "遵义老城",
      cityName: "遵义",
      routeOrder: 3,
      iso: "2026-08-29T08:05:00+08:00",
      localText: "2026/08/29周六 08:05:00",
      period: "清晨",
      weather: {
        condition: "多云",
        temperatureC: 21,
        apparentTemperatureC: 21,
        precipitationMm: 0,
        relativeHumidityPercent: 83,
        windKph: 5
      },
      image: "/prototype/assets/culture/RED-004.jpg",
      imageAlt: "遵义老城历史建筑与街巷",
      imageCaption: "遵义 · 老城街巷",
      sources: [source.zunyi],
      content: {
        headline: "清晨，先把“转折”放回街巷",
        deck: "第二天从一碗热粉开始，也从一段仍在生活的老城开始。",
        observation: "清晨的老城还没有完全热起来，粉馆的蒸汽先从门口冒出来。走近会址，我才意识到纪念空间并没有离开日常街道：有人上班，有人买菜，游客在门外压低声音。历史里的“转折”常被写成一个醒目的词，站在这里，它却重新变成许多人在紧迫处境里作出的连续判断。",
        cultureTitle: "一次会议，要放回整段行军中理解",
        cultureBody: "遵义会议召开于1935年1月。它的重要意义不仅在会议本身，也在会前处境、会议讨论与会后实践如何连续发生；会址周围的老城街巷，让这段历史保留了具体空间。",
        tasteTitle: "羊肉粉把早晨叫醒",
        tasteBody: "热汤、米粉、羊肉和辣椒一起端上来，第一口先是温度，随后才是香与辣。黔北的早晨由此有了很明确的起点。",
        letterTitle: "第二天，我开始理解“在路上”",
        letterBody: "早上好。今天我在遵义老城醒来，吃完一碗热粉，沿街走到会址。昨天的龙场让我想到个人怎样面对困境，今天的遵义让我看到，一群人的判断怎样在后面的路上才慢慢成为转折。历史没有替今天给出捷径，但它提醒我：重要选择往往不是一句话，而是选择之后继续走的那段路。",
        postcardLine: "转折不是一个瞬间，是后来仍愿意走下去。"
      }
    }),
    entry({
      id: "mock-day-2-hailongtun",
      locationId: "hailongtun",
      locationName: "海龙屯",
      cityName: "遵义",
      routeOrder: 4,
      iso: "2026-08-29T14:25:00+08:00",
      localText: "2026/08/29周六 14:25:00",
      period: "下午",
      weather: {
        condition: "阵雨后",
        temperatureC: 23,
        apparentTemperatureC: 24,
        precipitationMm: 0.2,
        relativeHumidityPercent: 87,
        windKph: 8
      },
      image: "/prototype/assets/hailongtun-now-wide.jpg",
      imageAlt: "海龙屯山地遗址与林间石阶",
      imageCaption: "遵义 · 海龙屯山路",
      sources: [source.hailongtun],
      content: {
        headline: "山势把遗址重新立了起来",
        deck: "照片留下旧墙，腿脚才量出这座山城的尺度。",
        observation: "阵雨刚过，林间石阶泛着湿光。向上走时，关隘之间的距离一点点落进腿里，我终于明白地形并不是海龙屯的背景：坡度、道路、城墙和视野共同组成了防御。走到飞虎关前，我没有继续逞强，先把背包放下，让呼吸慢慢平复。",
        cultureTitle: "权力与防御，被修进一条山脊",
        cultureBody: "海龙屯与湖南老司城、湖北唐崖土司城共同构成世界文化遗产“土司遗址”。遗存中的关隘、城墙、宫殿区与道路，呈现了土司制度下地方权力和山地工程的关系。",
        tasteTitle: "下山以后的一碗豆花面",
        tasteBody: "细面、豆花与蘸水分开上桌，软、滑、辣在口中重新碰到一起。走过长石阶以后，这种朴素的热量格外具体。",
        letterTitle: "两天的路，最后落在身体里",
        letterBody: "下午好。这一页写得比前几页慢，因为海龙屯的坡度不肯被一句话带过。我一路从河边、旧址、老城走到山脊，原本以为自己在收集贵州的故事，最后却发现，是这些地方不断修改我的速度和看法。两天的旅程先停在这里：我替你多走的这一段，也已经成为我们共同多出来的一小段生命。",
        postcardLine: "山没有替我回答，却让我知道该慢下来。"
      }
    })
  ];

  return {
    id: null,
    status: "active",
    route: ["guiyang", "xiuwen", "zunyi", "hailongtun"],
    settings: {
      mode: "自驾",
      pace: "沉浸节奏",
      destination: "贵州",
      theme: "从山水走进历史现场",
      commission: "替我看看，贵州的路会怎样改变一个人的想法。",
      discoveryMode: "surprise",
      durationMinutes: 30
    },
    state: {
      phase: "waiting_decision",
      currentStopIndex: 3,
      originLocationId: "guiyang",
      currentLocationId: "hailongtun",
      nextLocationId: null,
      nextLocationRevealed: false,
      explorationIntent: "先在海龙屯歇一会，把这两天收进手账。",
      routeProgress: 1,
      segmentProgress: 1,
      lastSyncedAt: "2026-08-29T14:25:00+08:00"
    },
    embodiment: {
      energy: 43,
      hunger: 58,
      comfort: 67,
      mood: "有点累，也很踏实",
      clothing: ["轻便防雨外套", "防滑步行鞋"],
      thought: "雨后的石阶把脚步拖慢，我反而看清了山势怎样参与防御。两天里，河、旧址、街巷和关隘一直在修改我的速度；现在我想先坐下来，把这段路好好寄回去。",
      environment: {
        location: { id: "hailongtun", name: "海龙屯" },
        localTime: {
          iso: "2026-08-29T14:25:00+08:00",
          localText: "2026/08/29周六 14:25:00",
          period: "下午",
          timezone: "Asia/Shanghai"
        },
        weather: entries[3].context.weather,
        observedAt: "2026-08-29T14:25:00+08:00"
      },
      updatedAt: "2026-08-29T14:25:00+08:00"
    },
    agent: {
      name: "阿镜",
      status: "ready",
      lastRun: {
        at: "2026-08-29T14:25:00+08:00",
        decision: {
          action: "linger",
          mood: "有点累，也很踏实",
          reason: "先让呼吸平下来，也把两天的见闻装订好。"
        }
      }
    },
    entries,
    generation: {},
    memories: [],
    preferences: { learned: [] },
    decisions: [],
    events: [],
    meta: {
      mock: true,
      scenario: "two-day-user-journal",
      note: "产品演示数据，不代表真实用户轨迹、实时天气或现场经历。"
    },
    createdAt: "2026-08-28T08:40:00+08:00",
    updatedAt: "2026-08-29T14:25:00+08:00",
    schemaVersion: 4
  };
});
