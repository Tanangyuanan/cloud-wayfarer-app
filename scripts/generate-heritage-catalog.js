"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUTPUT = path.join(ROOT, "knowledge-base", "heritage-catalog.json");

const SOURCE_SIXTH = "R-GZ-FY-06";
const SOURCE_THIRD = "R-GZ-FY-03";
const SOURCE_NATIONAL = "R-GZ-FY-NAT";

const cityCodes = {
  guiyang: "GY",
  zunyi: "ZY",
  anshun: "AS",
  liupanshui: "LPS",
  bijie: "BJ",
  tongren: "TR",
  qiandongnan: "QDN",
  qiannan: "QN",
  qianxinan: "QXN"
};

const cityNames = {
  guiyang: "贵阳",
  zunyi: "遵义",
  anshun: "安顺",
  liupanshui: "六盘水",
  bijie: "毕节",
  tongren: "铜仁",
  qiandongnan: "黔东南",
  qiannan: "黔南",
  qianxinan: "黔西南"
};

const entries = [];

function add(cityId, name, officialName, category, location, options = {}) {
  entries.push({
    cityId,
    name,
    officialName: officialName || name,
    category,
    location,
    theme: options.theme,
    sourceId: options.sourceId || SOURCE_SIXTH,
    level: options.level || "省级",
    batch: options.batch || "贵州省第六批"
  });
}

// 贵阳：口述传统、传统音乐、技艺与民俗。
add("guiyang", "红军长征过贵阳的故事", null, "民间文学", "贵阳市");
add("guiyang", "贵州广陵派古琴艺术", null, "传统音乐", "贵阳市云岩区");
add("guiyang", "清镇姊妹箫", "姊妹箫", "传统音乐", "贵阳市清镇市");
add("guiyang", "清镇地戏", "地戏", "传统戏剧", "贵阳市清镇市");
add("guiyang", "傩仪刀技", null, "传统体育、游艺与杂技", "贵阳市云岩区");
add("guiyang", "贵阳剪纸", "剪纸", "传统美术", "贵阳市");
add("guiyang", "观山湖蜡染", "蜡染技艺", "传统技艺", "贵阳市观山湖区");
add("guiyang", "乌当枫香印染", "枫香印染技艺", "传统技艺", "贵阳市乌当区");
add("guiyang", "清镇地戏面具制作", "地戏面具制作技艺", "传统技艺", "贵阳市清镇市");
add("guiyang", "贵阳布依族服饰", "布依族服饰", "民俗", "贵阳市");
add("guiyang", "清镇苗族跳场", "苗族跳场", "民俗", "贵阳市清镇市");
add("guiyang", "清镇水龙节", "水龙节", "民俗", "贵阳市清镇市");

// 遵义：仡佬族音乐、地方戏、诗会、酿造与饮食技艺。
add("zunyi", "仡佬族吹打乐", null, "传统音乐", "遵义市道真仡佬族苗族自治县");
add("zunyi", "沙滩文化九月九诗会", null, "民俗", "遵义市新蒲新区");
add("zunyi", "茅台镇重阳祭水习俗", null, "民俗", "遵义市仁怀市");
add("zunyi", "绥阳花灯戏", "花灯戏", "传统戏剧", "遵义市绥阳县");
add("zunyi", "道真仡佬族剪纸", "剪纸（仡佬族剪纸）", "传统美术", "遵义市道真仡佬族苗族自治县");
add("zunyi", "黔北咂酒酿造技艺", "酿造酒传统制作技艺（黔北咂酒酿造技艺）", "传统技艺", "遵义市正安县", { theme: "food" });
add("zunyi", "珍酒酿造技艺", "蒸馏酒传统酿造技艺（珍酒酿造技艺）", "传统技艺", "遵义市汇川区", { theme: "food" });
add("zunyi", "习水酱香型白酒传统酿造技艺", "蒸馏酒传统酿造技艺（习水酱香型白酒传统酿造技艺）", "传统技艺", "遵义市习水县", { theme: "food" });
add("zunyi", "尚嵇豆腐皮制作技艺", "豆制品制作技艺（尚嵇豆腐皮制作技艺）", "传统技艺", "遵义市播州区", { theme: "food" });
add("zunyi", "赤水泉水豆花制作技艺", "豆制品制作技艺（赤水泉水豆花制作技艺）", "传统技艺", "遵义市赤水市", { theme: "food" });
add("zunyi", "道真油茶制作技艺", "油茶制作技艺", "传统技艺", "遵义市道真仡佬族苗族自治县", { theme: "food" });
add("zunyi", "遵义鸡蛋糕制作技艺", null, "传统技艺", "遵义市汇川区", { theme: "food" });

// 安顺：屯堡生活、布依苗族歌谣、服饰与饮食技艺。
add("anshun", "丝头系腰制作技艺", null, "传统技艺", "安顺市西秀区");
add("anshun", "紫云布依族民歌", "布依族民歌", "传统音乐", "安顺市紫云苗族布依族自治县");
add("anshun", "紫云苗族民歌", "苗族民歌", "传统音乐", "安顺市紫云苗族布依族自治县");
add("anshun", "屯堡豆腐乳制作技艺", "豆制品制作技艺（屯堡豆腐乳制作技艺）", "传统技艺", "安顺市平坝区", { theme: "food" });
add("anshun", "屯堡鸡辣子", "辣子鸡制作技艺（屯堡鸡辣子）", "传统技艺", "安顺市西秀区", { theme: "food" });
add("anshun", "上关辣子鸡制作技艺", "辣子鸡制作技艺（上关辣子鸡）", "传统技艺", "安顺市关岭布依族苗族自治县", { theme: "food" });
add("anshun", "紫云布依族服饰", "布依族服饰", "民俗", "安顺市紫云苗族布依族自治县");
add("anshun", "平坝苗族婚俗", "苗族婚俗", "民俗", "安顺市平坝区");

// 六盘水：第六批项目之外，补入已在国家级或第三批省级名录中的代表项目。
add("liupanshui", "水城新街面塑", "新街面塑", "传统美术", "六盘水市水城区");
add("liupanshui", "水城花灯戏", "花灯戏", "传统戏剧", "六盘水市水城区");
add("liupanshui", "六枝苗绣", "苗绣", "传统美术", "六盘水市六枝特区");
add("liupanshui", "六枝斗纹布制作技艺", "布依族土布制作技艺（斗纹布制作技艺）", "传统技艺", "六盘水市六枝特区");
add("liupanshui", "盘州扎龙技艺", "彩扎（扎龙技艺）", "传统技艺", "六盘水市盘州市");
add("liupanshui", "岩脚面制作技艺", "传统面食制作技艺（岩脚面制作技艺）", "传统技艺", "六盘水市六枝特区", { theme: "food" });
add("liupanshui", "盘州苗医命蒂拔毒疗法", "苗医药（命蒂拔毒疗法）", "传统医药", "六盘水市盘州市");
add("liupanshui", "水城布依族婚俗", "布依族婚俗", "民俗", "六盘水市水城区");
add("liupanshui", "彝族铃铛舞", null, "传统舞蹈", "六盘水市", { sourceId: SOURCE_NATIONAL, level: "国家级", batch: "第二批国家级" });
add("liupanshui", "盘县砂陶制作技艺", "砂陶制作技艺", "传统技艺", "六盘水市盘州市", { sourceId: SOURCE_THIRD, batch: "贵州省第三批" });
add("liupanshui", "六枝仡佬族吃新节", "仡佬族吃新节", "民俗", "六盘水市六枝特区", { sourceId: SOURCE_THIRD, batch: "贵州省第三批" });
add("liupanshui", "水城苗族服饰", "苗族服饰", "民俗", "六盘水市水城区", { sourceId: SOURCE_THIRD, batch: "贵州省第三批" });

// 毕节：彝苗口述传统、音乐舞蹈、刺绣与乐器制作。
add("bijie", "金沙清池锣鼓", "清池锣鼓", "传统音乐", "毕节市金沙县");
add("bijie", "赫章苗族喊歌", "苗族喊歌", "传统音乐", "毕节市赫章县");
add("bijie", "彝族撒麻舞", null, "传统舞蹈", "毕节市七星关区");
add("bijie", "织金苗族悬羊击鼓", "苗族悬羊击鼓", "传统舞蹈", "毕节市织金县");
add("bijie", "黔西苗族米花叙情舞", "苗族米花叙情舞", "传统舞蹈", "毕节市黔西市");
add("bijie", "威宁彝族刺绣", "彝族刺绣", "传统美术", "毕节市威宁彝族回族苗族自治县");
add("bijie", "七星关留青竹刻", "留青竹刻", "传统技艺", "毕节市七星关区");
add("bijie", "威宁彝族古歌", "彝族古歌", "民间文学", "毕节市威宁彝族回族苗族自治县");
add("bijie", "赫章支嘎阿鲁", "支嘎阿鲁", "民间文学", "毕节市赫章县");
add("bijie", "黔西苗族多声部民歌", "苗族多声部民歌", "传统音乐", "毕节市黔西市");
add("bijie", "威宁彝族月琴制作技艺", "民间乐器制作技艺（彝族月琴制作技艺）", "传统技艺", "毕节市威宁彝族回族苗族自治县");
add("bijie", "赫章苗族服饰", "苗族服饰", "民俗", "毕节市赫章县");

// 铜仁：土家苗侗民俗、传统体育与生活技艺。
add("tongren", "松桃苗族八人秋", "苗族“八人秋”", "传统体育、游艺与杂技", "铜仁市松桃苗族自治县");
add("tongren", "万山朱砂制作工艺", "朱砂制作工艺", "传统技艺", "铜仁市万山区");
add("tongren", "沿河土家族哭嫁习俗", "土家族哭嫁习俗", "民俗", "铜仁市沿河土家族自治县");
add("tongren", "石阡平安会", "平安会", "民俗", "铜仁市石阡县");
add("tongren", "松桃傩戏", "傩戏", "传统戏剧", "铜仁市松桃苗族自治县");
add("tongren", "印江僰牌", "僰牌", "传统体育、游艺与杂技", "铜仁市印江土家族苗族自治县");
add("tongren", "思南魁榜醒狮", "舞狮（魁榜醒狮）", "传统体育、游艺与杂技", "铜仁市思南县");
add("tongren", "德江土家族剪纸", "剪纸（土家族剪纸）", "传统美术", "铜仁市德江县");
add("tongren", "思南藤编技艺", "藤编技艺", "传统技艺", "铜仁市思南县");
add("tongren", "印江油纸伞制作工艺", "油纸伞制作工艺", "传统技艺", "铜仁市印江土家族苗族自治县");
add("tongren", "沿河土家族服饰", "土家族服饰", "民俗", "铜仁市沿河土家族自治县");
add("tongren", "石阡起房造屋习俗", "起房造屋习俗", "民俗", "铜仁市石阡县");

// 黔东南：歌、舞、戏、节庆与手工技艺优先。
add("qiandongnan", "麻江瑶族舅爷歌", "瑶族舅爷歌", "民间文学", "黔东南州麻江县");
add("qiandongnan", "剑河侗族古歌", "侗族古歌", "民间文学", "黔东南州剑河县");
add("qiandongnan", "麻江畲族阿忙民歌", "畲族阿忙民歌", "传统音乐", "黔东南州麻江县");
add("qiandongnan", "岑巩思州战鼓", "思州战鼓", "传统音乐", "黔东南州岑巩县");
add("qiandongnan", "榕江水族斗牛舞", "水族斗牛舞", "传统舞蹈", "黔东南州榕江县");
add("qiandongnan", "剑河侗族踩虫舞", "侗族踩虫舞", "传统舞蹈", "黔东南州剑河县");
add("qiandongnan", "锦屏瑶白大戏", "瑶白大戏", "传统戏剧", "黔东南州锦屏县");
add("qiandongnan", "湾水苗族刀具制作技艺", null, "传统技艺", "黔东南州凯里市");
add("qiandongnan", "天柱滚山节", "滚山节", "民俗", "黔东南州天柱县");
add("qiandongnan", "锦屏大同堂皇歌会", "侗族歌会（大同堂皇歌会）", "民俗", "黔东南州锦屏县");
add("qiandongnan", "黄平苗族贾理", "苗族贾理", "民间文学", "黔东南州黄平县");
add("qiandongnan", "榕江苗族古瓢舞", "苗族古瓢舞", "传统舞蹈", "黔东南州榕江县");

// 黔南：水族、布依族、苗族的音乐舞蹈、医药与技艺。
add("qiannan", "长顺苗族牵羊舞", "苗族牵羊舞", "传统舞蹈", "黔南州长顺县");
add("qiannan", "都匀叶咔香制作技艺", "叶咔香制作技艺", "传统技艺", "黔南州都匀市");
add("qiannan", "荔波水族医药骨伤治疗", "水族医药（骨伤治疗）", "传统医药", "黔南州荔波县");
add("qiannan", "独山布依族民歌", "布依族民歌", "传统音乐", "黔南州独山县");
add("qiannan", "都匀苗族芦笙舞", "苗族芦笙舞", "传统舞蹈", "黔南州都匀市");
add("qiannan", "三都苗族跳月", "苗族跳月", "传统舞蹈", "黔南州三都水族自治县");
add("qiannan", "罗甸苗绣", "苗绣", "传统美术", "黔南州罗甸县");
add("qiannan", "长顺枫香印染", "枫香印染技艺", "传统技艺", "黔南州长顺县");
add("qiannan", "荔波竹编", "竹编", "传统技艺", "黔南州荔波县");
add("qiannan", "独山高寨贡茶制作技艺", "绿茶制作技艺（独山高寨贡茶制作技艺）", "传统技艺", "黔南州独山县", { theme: "food" });
add("qiannan", "惠水苗族银饰锻制技艺", "银饰锻制技艺（苗族银饰锻制技艺）", "传统技艺", "黔南州惠水县");
add("qiannan", "三都水族芦笙制作技艺", "民间乐器制作技艺（水族芦笙制作技艺）", "传统技艺", "黔南州三都水族自治县");

// 黔西南：布依族口述传统、音乐、礼俗与传统技艺。
add("qianxinan", "红军在北盘江红水河的传说", null, "民间文学", "黔西南州望谟县");
add("qianxinan", "张锳张之洞在贵州的传说", null, "民间文学", "黔西南州安龙县");
add("qianxinan", "布依族阿羞和弹妹的传说", "布依族“阿羞和弹妹的传说”", "民间文学", "黔西南州晴隆县");
add("qianxinan", "布依族史诗《安王与祖王》", "布依族史诗（安王与祖王）", "民间文学", "黔西南州望谟县");
add("qianxinan", "兴仁布依族铜鼓祭祀乐", "布依族铜鼓祭祀乐", "传统音乐", "黔西南州兴仁市");
add("qianxinan", "兴仁苗族四眼箫", "苗族四眼箫音乐艺术", "传统音乐", "黔西南州兴仁市");
add("qianxinan", "兴仁蚕丝织造技艺", "蚕丝织造技艺", "传统技艺", "黔西南州兴仁市");
add("qianxinan", "布依族舞狮脸谱制作技艺", null, "传统技艺", "黔西南州兴仁市");
add("qianxinan", "兴仁苗族八月八", "苗族八月八", "民俗", "黔西南州兴仁市");
add("qianxinan", "兴仁布依族官亭习俗", "布依族官亭习俗", "民俗", "黔西南州兴仁市");
add("qianxinan", "普安苗族口弦", "苗族口弦", "传统音乐", "黔西南州普安县");
add("qianxinan", "册亨阳戏", "阳戏", "传统戏剧", "黔西南州册亨县");

function domainFor(entry) {
  if (entry.theme === "food") return "饮食、茶与酒 · 非遗技艺";
  if (entry.category === "民间文学") return "非遗文化与口述传统";
  if (["传统音乐", "传统舞蹈", "传统戏剧", "曲艺"].includes(entry.category)) return "音乐、舞蹈与戏剧";
  if (entry.category === "民俗") return "节日、礼俗与信俗";
  if (entry.category === "传统医药") return "非遗文化与传统医药";
  if (entry.category === "传统体育、游艺与杂技") return "非遗文化与传统体育";
  return "手工艺、服饰与传统美术";
}

function summaryFor(entry) {
  const register = entry.level === "国家级" ? `${entry.batch}非遗代表性项目` : `${entry.batch}省级非遗代表性项目`;
  const subject = entry.officialName === entry.name ? entry.name : `${entry.name}（名录项目：${entry.officialName}）`;
  if (entry.theme === "food") {
    return `${subject}由${entry.location}申报，列入${register}。这条目录线索从原料、工具、火候与作坊传承进入地方味道，不把非遗只当成一道成品。`;
  }
  if (["传统音乐", "传统舞蹈", "传统戏剧", "曲艺"].includes(entry.category)) {
    return `${subject}由${entry.location}申报，列入${register}。这条目录线索关注声音、动作、演出场合与传习关系，后续将补入可听、可看的现场材料。`;
  }
  if (entry.category === "民间文学") {
    return `${subject}由${entry.location}申报，列入${register}。它把地方历史、族群记忆与口头讲述连在一起，适合从讲述者、版本和发生地继续深读。`;
  }
  if (entry.category === "民俗") {
    return `${subject}由${entry.location}申报，列入${register}。这条目录线索先记录参与者、时间、场所和共同体关系，避免把仍在发生的民俗压成一次表演。`;
  }
  if (entry.category === "传统医药") {
    return `${subject}由${entry.location}申报，列入${register}。本页只记录文化名录与传承线索，不提供诊疗建议；后续内容需同时完成医学边界和事实审核。`;
  }
  if (entry.category === "传统体育、游艺与杂技") {
    return `${subject}由${entry.location}申报，列入${register}。这条目录线索从身体动作、器具、规则和节庆场景进入当地仍在传承的技艺。`;
  }
  return `${subject}由${entry.location}申报，列入${register}。这条目录线索从材料、工具、制作步骤与传承人进入手艺，独立图像和深度正文将在核验后补齐。`;
}

const counters = new Map();
const nodes = entries.map((entry) => {
  const next = (counters.get(entry.cityId) || 0) + 1;
  counters.set(entry.cityId, next);
  const id = `IHC-${cityCodes[entry.cityId]}-${String(next).padStart(3, "0")}`;
  return {
    id,
    cityId: entry.cityId,
    contentKind: "culture",
    name: entry.name,
    domain: domainFor(entry),
    status: "A",
    summary: summaryFor(entry),
    sourceIds: [entry.sourceId],
    heritage: {
      officialName: entry.officialName,
      level: entry.level,
      batch: entry.batch,
      category: entry.category,
      location: entry.location,
      sourceId: entry.sourceId
    }
  };
});

const payload = {
  meta: {
    name: "云游四方九城非遗扩充目录",
    version: "1.0.0",
    updatedAt: "2026-08-29",
    note: "从贵州省政府公布的第六批省级非遗名录中选择适合旅行阅读的项目，并补入少量国家级及第三批省级代表项目。当前均为目录线索，不替代完整官方名录。",
    grain: "一个城市中的一个非遗代表性项目线索",
    selection: "优先口述传统、音乐舞蹈、戏剧、节庆、传统技艺与地方饮食；传统医药仅少量收录并明确内容边界。"
  },
  sources: {
    [SOURCE_SIXTH]: {
      title: "贵州省人民政府：第六批省级非物质文化遗产代表性项目名录",
      url: "https://www.guizhou.gov.cn/zwgk/zcfg/szfwj/qff/202501/t20250102_86447162.html"
    },
    [SOURCE_THIRD]: {
      title: "中国非物质文化遗产网：贵州第三批省级非物质文化遗产名录",
      url: "https://www.ihchina.cn/project_details/16923.html"
    },
    [SOURCE_NATIONAL]: {
      title: "贵州省非物质文化遗产保护中心：国家级代表性项目目录",
      url: "https://www.gzfwz.org.cn/gjml/gjj/depgy/"
    }
  },
  stats: {
    total: nodes.length,
    byCity: Object.fromEntries(Object.entries(cityNames).map(([cityId, name]) => [name, counters.get(cityId) || 0])),
    byDomain: Object.fromEntries([...new Set(nodes.map((node) => node.domain))].sort().map((domain) => [domain, nodes.filter((node) => node.domain === domain).length]))
  },
  nodes
};

const serialized = `${JSON.stringify(payload, null, 2)}\n`;
const temporary = `${OUTPUT}.${process.pid}.${Date.now()}.tmp`;
fs.writeFileSync(temporary, serialized);
fs.renameSync(temporary, OUTPUT);
console.log(`generated ${path.relative(ROOT, OUTPUT)} with ${nodes.length} nodes`);
