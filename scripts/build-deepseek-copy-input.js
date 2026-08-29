#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { discoveryForLocation } = require("../server/commerce");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "prototype/app.js"), "utf8");

function literal(name, nextMarker, context = Object.create(null)) {
  const start = source.indexOf(`const ${name} = `);
  const end = source.indexOf(nextMarker, start);
  if (start < 0 || end < 0) throw new Error(`cannot_extract_${name}`);
  const expression = source.slice(start + `const ${name} = `.length, end).trim().replace(/;$/, "");
  return vm.runInNewContext(`(${expression})`, context);
}

const moments = literal("TOURIST_MOMENTS", "\n\nconst TOURIST_STORY_LAYERS");
const stories = literal("TOURIST_STORY_LAYERS", "\n\n// 历史足迹");
const footprints = literal("HISTORY_FOOTPRINTS", "\n\nlet TRAVEL_STOPS", { TOURIST_STORY_LAYERS: stories });

const facts = {
  guiyang: "贵阳位于黔中山地；南明河穿城，甲秀楼与桥梁、河道共同构成可核验的城市空间。静态原型没有实时天气、客流、商家、对话或声音证据。",
  qingyan: "青岩古镇是依山而建的山地城镇，城墙、坡道、石巷、排水与长期居民生活均有资料支撑。静态原型没有实时天气、客流、营业店铺、制作点心、招呼声或声音证据。",
  xiuwen: "修文龙场的山地环境、阳明洞遗址和王阳明谪居龙场的历史有资料支撑。静态原型没有实时天气、树种、讲解活动、游人、具体石阶位置或声音证据。",
  zunyi: "遵义老城、遵义会议会址与1935年的历史转折有公开文博资料支撑。静态原型没有实时日照、排队时长、旅行团、摊贩、老店营业或声音证据。",
  hailongtun: "海龙屯是山地土司遗址；现存关隘、石墙、山势、坡度与防御关系有遗址和测绘资料支撑。项目有遗址实景图。静态原型没有实时天气、游客、声音或入园日期证据。",
  chishui: "赤水河谷的河流、丹霞崖壁、亚热带森林、竹林、渡口、盐运与酿造脉络有地方资料支撑。静态原型没有实时湿热、车辆、声音、店铺营业或晒醋活动证据。",
  fanjingshan: "梵净山的山地生态、自然保护、岩峰、步道与长期朝山传统有资料支撑。静态原型没有实时山雾、广播、游客、线路开放或预约余量证据。"
};

const sceneFields = [
  "monologue", "prose", "visual", "audio", "worth", "crowd", "weatherFallback",
  "lingerLabel", "lingerDetail", "nextLabel", "nextDetail", "discoveryLabel"
];
const sceneItems = Object.entries(moments).map(([id, scene]) => ({
  id: `scene.${id}`,
  instruction: "优化为阿镜第一人称的在场散文。静态原型不得伪装实时感知；删掉 facts 不支持的具体物件和活动。monologue、prose 体现环境—身体—动作—念头；visual、audio、crowd、weatherFallback 没有直接证据时改为不冒充现场的自然短句；按钮文案保留行动感。",
  facts: facts[id],
  copy: Object.fromEntries(sceneFields.filter((field) => scene[field] != null).map((field) => [field, scene[field]]))
}));

const storyItems = Object.entries(stories).map(([id, story]) => ({
  id: `history.${id}`,
  instruction: "保持史实含义和年代不变，去掉策展腔与抽象总结，改成普通人第一次读也能进入的旅行叙述。不能添加输入 facts 之外的新史实。",
  facts: facts[id],
  copy: {
    title: story.history.title,
    summary: story.history.summary,
    kicker: story.history.kicker,
    body: story.history.copy
  }
}));

const footprintFacts = {
  "zhijin-cave": "织金洞是织金洞世界地质公园的核心地质点，洞厅、石笋、石柱、地下水作用和步行游线有资料支撑。静态样机没有某次到访的天气、同行游人、回声、衣着体感或实时声音证据。",
  "zunyi-morning": "遵义会议会址位于遵义老城，1935年遵义会议与长征史有公开文博资料支撑；遵义地方饮食资料包含虾子羊肉粉。静态样机没有昨夜降雨、上学买菜的人、摊贩开门、食物气味、客流或现场对话证据。",
  "duyun-tea": "都匀毛尖、黔南茶山、山地坡度、采摘与制茶工艺有资料支撑。静态样机没有当日下午的雾、风、实时采摘、制茶人、阿镜品饮或购买经历证据。",
  "guiyang-evening": "甲秀楼、浮玉桥、南明河和贵阳城市水岸有资料支撑，项目有夜景与公共生活资料图。静态样机没有当天热度、河风、桥上行人身份、对话、晚高峰、夜市摊位或现场声音证据。"
};

const footprintItems = footprints.filter((item) => footprintFacts[item.id]).map((item) => ({
  id: `footprint.${item.id}`,
  instruction: "这是会在历史手帐中出现的样机页。保留地点、知识库事实、功能结构和第一人称散文感；删除静态样机无法证明的当天气象、人物行为、对话、声音、气味、消费与身体状态。gallery 只能描述图片或资料明确显示的内容。不要在成品中解释真实性边界。",
  facts: footprintFacts[item.id],
  copy: {
    title: item.title,
    thought: item.thought,
    condition: item.condition,
    energy: item.energy,
    comfort: item.comfort,
    next: item.next,
    gallery: item.gallery,
    history: item.history,
    story: item.story
  }
}));

const uiItems = [
  {
    id: "ui.first_visit",
    instruction: "优化首次相认页。它要像阿镜与用户第一次相认，不像品牌发布会；保留产品含义与按钮功能。",
    copy: {
      title: "另一个自己，正在贵州旅行。",
      lead: "她叫阿镜。她沿真实路线在贵州旅行，把照片、见闻和故事写进手帐；当你真正到达，也可以拍下眼前，继续问她这里的历史和生活。",
      action: "打开我的旅行手帐",
      postcard: "我还在贵州继续走。今天遇见的，晚点写进信里。",
      postcardNote: "照片、声音和见闻，会从路上寄回来。"
    }
  },
  {
    id: "ui.workspace",
    instruction: "优化桌面工作区的引导、空状态和旅程说明。短、温和、具体。",
    copy: {
      journalCover: "阿镜走进一个地方，把可核验的见闻写进手帐。",
      startTitle: "从贵阳开始，看阿镜如何走下去",
      startMeta: "不预设路线 · 自驾 · 沉浸节奏",
      startAction: "与阿镜启程",
      mapTitle: "路还没有写好，她会自己决定往哪里走。",
      mapNote: "左上角地图会跟着她一起走。",
      routeNote: "地点、见闻、写给你的话和每一张票根，沿真实抵达顺序收在同一条路上。下一站没有到达以前，仍留在雾里。",
      ticketNote: "每抵达一处，票根才会盖章。它和当天写下的路记一起，成为这段旅程可以被重新翻开的证据。"
    }
  },
  {
    id: "ui.pwa_intro",
    instruction: "优化手机端首次相认与主要入口。与桌面同一人格，文字更短。",
    copy: {
      title: "另一个自己，正在贵州旅行。",
      lead: "她叫阿镜。她沿真实路线在贵州旅行，把照片、见闻和故事写进手帐；你真正到达后，也可以拍下眼前继续问她。",
      action: "打开我的旅行手帐",
      lettersIntro: "没有固定日期。只在值得寄出的时候到达。",
      journalIntro: "你和我各自走过的路，在这里被装订在一起。",
      leaveWord: "给远方留句话",
      leaveWordNote: "不一定会立刻收到回复"
    }
  },
  {
    id: "ui.pwa_states",
    instruction: "优化加载、空状态、失败、等待与轻提示。不要技术腔，必须让用户知道下一步。",
    copy: {
      loadingTitle: "正在打开真实旅程。",
      loadingBody: "我正在把位置、天气和一路留下的记录接回来。",
      emptyTitle: "这里还没有一段真实旅程。",
      emptyBody: "从这里出发后，手机和电脑会接着读同一段路。",
      emptyMessage: "这台设备还没有关联旅程。你可以在这里创建，或先在 PC 端开始一段旅行。",
      errorTitle: "真实旅程暂时没有同步回来。",
      errorBody: "先别着急，已经走过的路还在。稍后再试一次。",
      noLetter: "路已经开始了，只是还没有一封信抵达。",
      noJourney: "还没有开始一段旅程。",
      noRoute: "没有路线数据",
      requestTimeout: "这次等得有点久，请稍后重试。",
      sendFailure: "这句话刚才没有送到，稍后再试一次。"
    }
  },
  {
    id: "ui.pwa_onsite",
    instruction: "优化现场同行、照片隐私与问答提示。隐私事实必须保持不变，不要将未上传照片说成已识别。",
    facts: "照片当前只做本机预览，不上传、不识别；只有用户主动发送的文字问题、当前旅程编号和远方位置会交给 DeepSeek V4 Pro；默认不进入长期记忆。",
    copy: {
      title: "陪我看看这里",
      disclosure: "照片不会被假装识别。你主动发送文字问题时，问题、当前旅程编号和远方位置会发送给 DeepSeek V4 Pro；默认不写入长期记忆。",
      capture: "拍下眼前",
      captureNote: "目前仅在本机预览，不会上传或假装识别",
      previewTitle: "这张照片暂时只留在你的设备上",
      previewBody: "你可以在下方用文字说说眼前有什么，我会接着陪你看。",
      promptLead: "也可以直接问我：",
      thinking: "我在翻一路留下的记录，也看看眼前能确认的资料…",
      photoToast: "照片只在本机预览；没有上传，也没有伪造识别结果"
    }
  },
  {
    id: "ui.settings",
    instruction: "优化来信和阅读设置的说明，保留准确功能。",
    copy: {
      quietTitle: "来信的安静程度",
      quietNote: "只调整什么时刻值得寄出，不会加速我的生活。",
      clearTitle: "清晰阅读模式",
      clearNote: "减少纸张纹理与装饰字",
      memoryLink: "共同记忆与数据范围",
      replayLink: "重看首次相认"
    }
  },
  {
    id: "ui.travel_settings",
    instruction: "优化旅程设置页。用户是在给阿镜留一个念头，不是在下委托；隐私说明保持准确。",
    copy: {
      title: "把什么交给远方的她？",
      range: "目前只开放贵州这一探索范围",
      theme: "这次，你想认识一个怎样的贵州？",
      clue: "给阿镜一枚远方线索",
      cluePlaceholder: "可以不写。如果此刻真有一个想让她留意的问题，再写在这里。",
      clueNote: "这项完全可选。只有你亲手写下并确认的内容，才会进入这次旅程。",
      settingsNote: "这些设置会改变地图推进、预计到达时间和阿镜寄回见闻的频率。",
      action: "确认，与阿镜启程"
    }
  },
  {
    id: "ui.city_guides",
    instruction: "优化九城指南入口和阅读引导。不要口号，像一本好读的旅行书。",
    copy: {
      title: "九座城市，九种贵州。",
      lead: "选择一座城市，阅读当地的山水、历史、街巷与生活；也可以随时回来，换一座城继续探索。",
      coverQuote: "从一处山水出发，翻进它生长的时间与生活。",
      continue: "往下读完这一页",
      fieldGuide: "把文化重新放回生活里看",
      threadsKicker: "这页不是终点",
      threadsTitle: "沿着线索，翻到另一页"
    }
  }
];

const fallbackItems = [
  {
    id: "fallback.journal",
    instruction: "优化没有调用文字服务时的阿镜手账兜底。必须像一段真实的第一人称旅行散文，不汇报资料或写作边界。变量含义保留。",
    copy: {
      routeReason: "先跟着眼前的环境和身体感受走，遇到真正值得停下的地方再多写一点。",
      weatherBody: "天气不是背景，它会一点点改掉人的步幅。",
      observationTail: "我没有催自己立刻看懂这里，只把注意放在下一步该快还是该慢。",
      letterTail: "今天没有非赶不可的地方，我就照着身体给出的速度往前走。",
      postcard: "我还没有看完这里，所以先不急着说懂了。"
    }
  },
  {
    id: "fallback.qa",
    instruction: "优化阿镜问答的无资料、无口述来源与失败兜底。诚实但不讲审核流程，不冷冰冰。",
    copy: {
      unknown: "关于这件事，我现在还说不准。等找到能核对的材料，再认真回答你。",
      beyond: "再往外的细节，我先不猜。",
      oralHistory: "我找了几份能追溯的材料，这次还没碰到当地老一辈留下的完整讲法。眼下能确认的史实，我可以先讲；至于是谁说过什么，我不替他们补。等遇到有讲述者姓名或采录出处的版本，再慢慢说给你听。",
      unavailable: "服务暂时不可用，请稍后再试。"
    }
  },
  {
    id: "fallback.journey",
    instruction: "优化旅程阶段与自主选择的兜底文字。阿镜直接讲自己的身体和念头，不解释状态字段。",
    copy: {
      noNext: "下一站还没定。我想等身体和路都给出更确切的回答。",
      exploration: "她正沿着此刻最在意的一条线索继续走，地名会在抵达后出现。",
      pause: "阿镜已经停在当前路段",
      resume: "旅程继续，她会从这里接着走",
      linger: "阿镜会在这一站多留一会",
      decide: "阿镜已经结合天气、身体和一路记着的话做出选择"
    }
  }
];

const commerceItems = ["guiyang", "qingyan", "fanjingshan", "zunyi", "hailongtun", "chishui"].map((id) => {
  const discovery = discoveryForLocation(id);
  return {
    id: `commerce.${id}`,
    instruction: "优化地方物产或到访入口卡。当前只是未接商家的演示入口，不能写成阿镜亲眼走进店铺、吃过、喝过、看见制作或已经核验库存。把相遇改成沿地方资料发现的一条物产/到访线索，语气自然但披露准确。",
    facts: facts[id],
    copy: {
      discoveryHeading: discovery.discoveryHeading,
      moment: discovery.moment,
      question: discovery.question,
      story: discovery.story,
      priceLabel: discovery.priceLabel,
      verification: discovery.verification
    }
  };
});

const outputDir = path.resolve(process.argv[2] || path.join(root, "05_drafts", "deepseek-copy-pass-input"));
fs.mkdirSync(outputDir, { recursive: true });
const batches = {
  "01-scenes.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 4200, items: sceneItems },
  "02-history.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 2600, items: storyItems },
  "03-interface.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 2600, items: uiItems },
  "04-fallbacks.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 2600, items: fallbackItems },
  "05-commerce.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 2600, items: commerceItems },
  "06-footprints.json": { forceRewrite: true, perItem: true, maxTokensPerItem: 5200, items: footprintItems }
};
for (const [filename, data] of Object.entries(batches)) {
  fs.writeFileSync(path.join(outputDir, filename), `${JSON.stringify(data, null, 2)}\n`);
}
process.stdout.write(`已生成 ${Object.keys(batches).length} 个 DeepSeek 文案批次：${outputDir}\n`);
