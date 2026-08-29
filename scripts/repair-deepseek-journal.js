#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const journeyId = "6681f2f3-a73b-43e6-ae6d-1638db4d3c32";
const journeyPath = path.resolve(__dirname, "..", "data", "journeys", journeyId, "journey.json");
const backupPath = path.join("/private/tmp", `${journeyId}-before-deepseek-rewrite.json`);

const copyById = {
  "5c2d55a5-a823-4426-b7e9-0baad472c865": {
    headline: "贵阳上午，雨还在路上",
    deck: "湿热先贴到皮肤上，脚步也跟着慢了半拍。",
    observation: "上午十点，贵阳是23.7°C，体感已经到了25.8°C。湿度七成多，薄长袖穿着嫌热，拿下来又得一直搭在手臂上。我来回整理了两次袖口，最后索性让它松松垂着。下午有八成概率会下雨，空气像提前替那场雨占了位置。身体并不累，只是有一点黏，做什么都不太想急。我原本想一到贵阳就赶紧认识这座城，真到了这里，却发现身体比好奇心慢。路边音乐会、甲秀楼、青岩古镇和丝娃娃，都可以成为认识贵阳的入口；但这一个上午，我更想先承认自己的迟钝。不是每一次抵达都要立刻发生故事。有时只是站稳、适应湿度，让呼吸和脚步慢慢落到同一个节拍里，一页旅行才真正开始。",
    cultureTitle: "贵阳路边音乐会：日常也能成为舞台",
    cultureBody: "贵阳的路边音乐会把公共文化放回街角与日常。专业表演者、普通居民和游客都可能参与其中，观看与表演之间没有很高的门槛。它让一座城市被认识的方式，不只剩下地标，也包括人们如何一起度过一个普通夜晚。",
    letterTitle: "贵阳上午，先不急着认识整座城",
    letterBody: "上午十点，贵阳的湿热已经先到了。温度不算高，体感却比数字更黏一些。薄长袖穿着热，脱下来又得搭在手臂上，我来回整理袖口，像是在替刚抵达的自己找一个合适的位置。\n\n下午有八成概率会下雨。我本来应该趁雨来以前多走一点，可身体没有立刻配合那份急切。它只是很诚实地说：先慢一点，先把呼吸调匀，再决定今天要去哪里。\n\n贵阳有许多响亮的名字，路边音乐会、甲秀楼、青岩古镇，还有一口包着很多味道的丝娃娃。但我不想把这些名字匆匆打卡以后，就假装自己已经懂了这座城。今天这一页，可以先只写湿度、袖口，以及一个人刚到陌生地方时那点说不清的拘谨。\n\n我想把这份不完整也留下来。等雨真的落下，也许脚步会有新的方向；即使没有，至少此刻的迟疑是真实的。",
    postcardLine: "雨还没落下来，我先让身体跟上了贵阳。"
  },
  "d7f5193e-c21c-4e1b-a1ae-53ba366f4448": {
    headline: "龙场上午，先让身体慢下来",
    deck: "雨意悬着，胃还没醒，答案也不必急着出现。",
    observation: "上午十点多，修文龙场比贵阳热了约半度，湿度也更高。雨还没有落下来，身体却已经先感到黏。薄长袖搭在手臂上，胃像仍停在刚醒来的那一刻，不饿，也没有真正安稳。我原本以为到了龙场，思绪会自然变得清明；可身体给出的答案很普通：先缓一缓。王阳明在困顿中重新安置自己的经历，让龙场有了后来被反复讲述的意义。可对一个刚到这里的人来说，所谓安置也许不一定宏大。它可能只是承认此刻不舒服，允许胃慢慢醒来，也允许一个问题暂时没有答案。湿热没有因此消失，但脚步不再催促自己，心里反而松开了一点。",
    cultureTitle: "龙场悟道：困顿中的重新安置",
    cultureBody: "王阳明被贬谪至龙场，在艰难处境中形成心学思想的重要转折。后人常用“龙场悟道”概括这段经历。它令人反复回望的，不只是一个哲学结论，也是一个人在失意与困顿中，如何重新确认自己能够依靠什么。",
    letterTitle: "在龙场，先不急着得到答案",
    letterBody: "龙场的上午比贵阳更热一点，湿气也更重。雨还没落，身体已经有了被潮气包住的感觉。薄长袖搭在手臂上，胃还没有完全醒，我忽然不想急着做任何决定。\n\n来到一个以“悟道”闻名的地方，很容易期待自己也想明白一点什么。可真实的我没有顿悟，只有黏腻、迟钝，还有一点想停下来的念头。说出来似乎不够漂亮，却比勉强写一句道理更接近这一刻。\n\n王阳明在困顿中重新安置自己的经历，让我想到：人也许不是先想通，才有力气继续走；有时恰恰是先照顾好当下的身体，心才慢慢腾出地方。今天我能做的，只是把速度降下来，不催胃口，也不催答案。\n\n雨什么时候来，我不知道。此刻我愿意先等一等，让这份没有结论的安静，多停留一会儿。",
    postcardLine: "雨还没落，答案也可以再等一会儿。"
  },
  "df5be798-e82d-421b-97bf-58e8d7ac9f9b": {
    headline: "遵义上午，热意停在雨前",
    deck: "风吹不散闷热，胃和脚步都在提醒我别逞强。",
    observation: "上午十点半，遵义晴，体感温度已经超过30°C。风速只有6.8公里每小时，走了五分钟，薄长袖就一次次从手臂上滑下来。胃有些空，身体却被热意压得没有胃口。下午降雨概率约92%，空气里像悬着一个迟早会发生的变化。我一面想趁雨前继续，一面又很清楚，空着胃硬走只会让情绪先坏掉。遵义会议之所以重要，是因为一条已经走得艰难的路在这里被重新判断。把这样的历史放回自己身上，当然不能轻易类比；但“什么时候该停下来重新决定”这个问题，忽然变得具体。我的决定很小：先把脚步放慢，不拿赶路证明什么。等身体缓过来，再看下一段路。",
    cultureTitle: "遵义：一段被重新决定的路",
    cultureBody: "1935年1月召开的遵义会议，是长征进程中的重要转折。它发生在一段异常艰难的行程里，改变了此后的领导与行军方向。今天回望遵义，不只是记住一栋会址建筑，也是在理解：一条路如何在压力中被重新判断。",
    letterTitle: "雨还没来，脚步先慢了一点",
    letterBody: "遵义上午很热。体感温度超过30°C，风并没有把闷意吹散。走了五分钟，薄长袖就从手臂上滑下来，我重新搭好，它又慢慢往下掉；这样一个小动作重复几次，人也跟着烦躁起来。\n\n胃有些空，可热得没有立刻想吃东西。下午降雨概率约92%，我一边担心雨来得太快，一边又盼着它把空气降下来一点。想继续走，身体却在提醒我：空腹和闷热都是真的，不需要假装轻松。\n\n遵义让人想到一段被重新决定的路。我没有资格把自己的小犹豫和那段历史并在一起，只是在这一刻更能理解，继续向前并不总等于咬牙不变。有时候，停下来重新判断，也是在认真对待前面的路。\n\n所以我先把脚步放慢。等胃口回来一点，等热意松开一点，再决定往哪里走。这个决定很小，却让我重新舒服地呼吸了一次。",
    postcardLine: "雨还没来，我先承认自己需要慢一点。"
  },
  "2cf340fd-d0f7-40c5-a5f4-a97da1bb88c9": {
    headline: "海龙屯，山脊把路抬高",
    deck: "热意和低云一起压下来，今天更需要稳稳判断。",
    observation: "上午十点四十八分，海龙屯晴，26.5°C，体感却接近30°C。低云和很重的雨意，让“是否继续上行”不再只是行程安排。薄长袖、防滑步行鞋和遮阳帽都准备好了，身体仍然保持着警觉。我喜欢山路给人的专注感，也知道这种喜欢很容易变成逞强。海龙屯依山脊构筑，军事防御、地方权力与山地建造叠在同一处遗址里；地形从来不只是背景，它会直接决定人的行动。想到这一点，我不愿把谨慎写成退缩。真正稳妥的决定，要同时听天气、装备和身体，而不是只听“既然来了”的冲动。现在还没有答案，我先把想往前的劲收住一点。",
    cultureTitle: "一条山脊里的土司制度",
    cultureBody: "海龙屯是播州土司文化的重要遗址，也是世界文化遗产“土司遗址”的组成部分。遗址依山脊构筑，把军事防御、政治秩序和山地营造结合在一起。它留下的不只是建筑遗存，也是中央王朝与西南地方社会长期互动的物证。",
    letterTitle: "想往前，也可以先不逞强",
    letterBody: "海龙屯的上午看起来是晴天，体感却已经接近30°C。低云压着雨意，薄长袖、防滑步行鞋和遮阳帽都在身上。我本来有一点急，觉得既然到了，就应该继续向前；可身体始终没有完全放松。\n\n我喜欢人在山地里变得专注的感觉。鞋、呼吸、每一次重心变化，都会比平地更清楚。可我也知道，喜欢并不能替天气作保证，装备也不能把所有风险变成勇敢。\n\n海龙屯依山脊构筑，过去的防御与权力都借助了地形。想到这里，我反而更愿意尊重眼前的条件。谨慎不是把路放弃，而是承认这条路有自己的尺度，不会因为一个人不甘心就变得容易。\n\n我还是想继续，只是不想靠逞强继续。先等一会儿，看低云和身体会不会给出更清楚的信号；如果没有，今天停在这里也可以。",
    postcardLine: "想继续是真的，不愿逞强也是真的。"
  },
  "e9b91af5-432c-4512-a2d5-1a118ed0ef25": {
    headline: "赤水河谷，雨把时间放慢",
    deck: "上午十一点，小雨落着，94%的湿度先贴到了皮肤上。",
    observation: "上午十一点，赤水河谷落着小雨。24.2°C并不算高，体感却到了28.7°C；相对湿度94%，风速6.9公里每小时。数字读起来并不诗意，落到身体上却很具体：薄长袖搭在手臂上，空气贴着皮肤，呼吸和动作都比平时慢一点。雨水在帽檐上慢慢聚起来，偶尔沿着边缘落下一滴；树叶挂着水，路面也被润得发亮。防滑步行鞋让人安心，也让我更留意每一步是否放稳。能量还有68，舒适度只有58，不至于疲惫，却很难轻快。我原本想借着刚到时的兴奋继续往前，小雨没有真正拦住我，身体里的谨慎却慢慢冒了出来。当天降雨概率是100%，停下来不一定能等到放晴，继续走也不必用逞强证明决心。赤水河把盐运、酿酒、长征和今天的河谷生活串在一起；丹霞被雨水压深了颜色，许多不同的时间像在潮气里靠近。我反而更愿意认真对待眼前这个很小的选择。",
    cultureTitle: "一条河，几段不同的时间",
    cultureBody: "赤水河连接盐运、酿酒、长征与今天的河谷生活。四渡赤水是其中最为人熟知的一段历史，河流也长期支撑沿岸交通与酿造。赤水丹霞作为世界自然遗产“中国丹霞”的组成部分，又让地质时间与人的历史在同一片河谷相遇。",
    letterTitle: "雨里的赤水河谷，我还没决定要不要继续",
    letterBody: "我想把这一刻慢慢告诉你。现在是上午十一点，赤水河谷正下着小雨。24.2°C听起来凉快，体感却有28.7°C；94%的湿度贴在皮肤上，薄长袖搭在手臂，连呼吸都像被调慢了一点。雨水在帽檐上聚成小滴，手背也不时被轻轻点一下。\n\n雨并不大，只有0.5毫米，风也不强。树叶挂着水，路面被润得发亮，防滑步行鞋踩上去让人安心，也让我更留意自己有没有把每一步放稳。能量还有68，舒适度只有58，不算累，也谈不上舒服。最真实的感受不是狼狈，而是清醒：我确实想往前，也确实不想拿身体去证明什么。\n\n赤水河把盐运、酿酒、长征和河谷生活牵在一起。丹霞在雨里颜色更深，那些名字也像被潮气拉近了，仿佛许多段不同的时间都在这里停过。如果你此刻也在，我大概不会急着讲一串历史，只会请你先看一会儿雨，等它把原本很硬的念头慢慢泡软。\n\n当天降雨概率是100%。停下来，未必能等到雨停；继续走，也不是唯一值得肯定的选择。我还没有决定。也许再过一会儿，身体会给我一个更清楚的答案；也许不会，我就先允许这个犹豫留在这里。",
    postcardLine: "雨没有替我作决定，它只是让我听见了犹豫。"
  }
};

function neutralThought(locationName) {
  const thoughts = {
    遵义: "遵义上午体感已超过三十度，风吹不散闷热。先放慢脚步，让身体缓一缓，再决定接下来的行程。",
    海龙屯: "海龙屯体感接近三十度，低云和雨意让上行需要更谨慎。先看天气和身体状态，再决定是否继续。",
    赤水河谷: "赤水河谷湿度94%，小雨持续，舒适度降到了58。先把脚步放慢，再决定继续走还是停一会儿。"
  };
  return thoughts[locationName] || "先跟着当时的天气和身体状态走，不急着替这一站下结论。";
}

function main() {
  const original = fs.readFileSync(journeyPath, "utf8");
  const journey = JSON.parse(original);
  if (journey.id !== journeyId) throw new Error("journey_id_mismatch");
  fs.writeFileSync(backupPath, original);

  journey.settings.commission = "";
  journey.memories = (journey.memories || []).filter((memory) => memory.kind !== "user_clue");
  journey.decisions = (journey.decisions || []).filter((decision) => decision.action !== "commission");

  const generatedAt = new Date().toISOString();
  for (const entry of journey.entries || []) {
    const nextCopy = copyById[entry.id];
    if (!nextCopy) continue;
    entry.content = { ...entry.content, ...nextCopy };
    entry.meta = {
      ...entry.meta,
      modelUsed: true,
      model: "deepseek-v4-pro",
      modelReason: null,
      generatedAt
    };
    if (entry.delivery) {
      entry.delivery.whyForUser = `${entry.locationName}的天气改变了身体感受和行走判断，这一刻值得留进手账。`;
    }
    if (entry.agent) {
      entry.agent.contentIntent = `写清${entry.locationName}当时的天气如何落到身体上，以及阿镜尚未做完的判断。`;
      entry.agent.whyForUser = `${entry.locationName}的这一刻同时改变了身体和判断，值得留进手账。`;
    }
    if (entry.context?.embodiment) entry.context.embodiment.thought = neutralThought(entry.locationName);
  }

  const lastDecision = journey.agent?.lastRun?.decision;
  if (journey.agent?.lastRun) {
    journey.agent.lastRun.model = "deepseek-v4-pro";
    journey.agent.lastRun.reason = "刚刚抵达赤水河谷。结合实时环境与身体状态，决定此刻如何停留、写什么、下一步怎么走。";
  }
  if (lastDecision) {
    lastDecision.thought = neutralThought("赤水河谷");
    lastDecision.reason = "小雨、94%的湿度和较低舒适度都让继续行走需要更谨慎。";
    lastDecision.contentIntent = "写清小雨和高湿度如何改变身体感受，以及继续走还是先停下来的犹豫。";
    lastDecision.whyForUser = "赤水河谷的这一刻同时改变了身体和判断，值得留进手账。";
  }
  if (journey.embodiment) journey.embodiment.thought = neutralThought("赤水河谷");

  const eventSummaries = {
    贵阳: "贵阳上午湿度七成多，下午有较高降雨概率。先让身体适应湿热，再决定今天的速度。",
    遵义: neutralThought("遵义"),
    海龙屯: neutralThought("海龙屯"),
    赤水河谷: neutralThought("赤水河谷")
  };
  journey.events = (journey.events || []).filter((event) => event.type !== "user_clue");
  for (const event of journey.events) {
    if (event.type === "journey_created") {
      event.title = "0 号行旅站建立旅程";
      event.summary = `主题：${journey.settings.theme}`;
    } else if (event.type === "journey_started") {
      event.summary = `从贵阳开始，沿着${journey.settings.theme}慢慢认识贵州。`;
    } else if (event.type === "user_linger" && /委托|托付|湿鞋|线索/.test(event.summary || "")) {
      event.summary = "阿镜在贵阳多留了一会儿，继续感受当时的天气与身体状态。";
    } else if (event.type === "agent_decision") {
      const locationName = Object.keys(eventSummaries).find((name) => (event.summary || "").includes(name) || (event.at >= "2026-08-29T03:00" && name === "赤水河谷"));
      if (locationName) event.summary = eventSummaries[locationName];
    }
  }

  fs.writeFileSync(journeyPath, `${JSON.stringify(journey, null, 2)}\n`);
  process.stdout.write(`Rewrote ${Object.keys(copyById).length} entries with DeepSeek-reviewed copy. Backup: ${backupPath}\n`);
}

main();
