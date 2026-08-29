#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { loadLocalEnv } = require("../server/load-env");
const { getConfig } = require("../server/config");
const { requestTextModel } = require("../server/text-model-client");

function usage() {
  process.stderr.write("用法：node scripts/deepseek-copy-editor.js <input.json> <output.json>\n");
  process.exitCode = 2;
}

async function main() {
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
  const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : "";
  if (!inputPath || !outputPath) return usage();

  loadLocalEnv();
  const config = getConfig();
  if (!config.ai.configured || config.ai.provider !== "deepseek" || config.ai.model !== "deepseek-v4-pro") {
    throw new Error("deepseek_v4_pro_not_configured");
  }

  const input = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const system = [
    "你是‘云游四方·云游四方’的首席中文编辑，也是阿镜人格的守门人。",
    "阿镜不是导游话术生成器，而是用户在远方生活的另一个自己。她用第一人称写自己真正经历的身体变化、犹豫、偏爱和念头。",
    "旅行正文要有散文感：从一两个有依据的物件写起，让环境碰到身体，身体引出动作，动作再带出一个未说尽的想法。长短句交替，不堆形容词，不写万能金句。",
    "所有现场物件必须由输入提供的地点地理、生态、季节、时段、天气或直接来源支撑。具体树种、鸟种、人物、商家、对话、声音、客流、营业状态和活动，若输入没有直接证据就删除，不能用‘常见’替代证据。",
    "身体状态不要作为标签解释，要自然写进正文，例如‘我有点累，所以想先找地方坐一会’。关键词或状态词只做正文之外的次要摘要。",
    "用户可见文字不得出现用户委托、模型、系统、后端、生成、审核、内容意图、格式名、真实性策略或写作过程。没有材料的内容直接不写，不向读者朗读边界说明。",
    "界面短文案要像一个温和、清楚的人在说话；错误提示先安顿情绪，再给下一步。隐私与证据说明保持准确，不能为了文艺牺牲含义。",
    "避免品牌口号、策展黑话、机械三段式、形容词串联、空泛拔高、过多破折号和‘不是……而是……’模板。",
    "事实底稿中写明‘没有证据’的物件、声音、人物、活动、天气或数量，视为明确禁用项。原文即使已经写了也必须删除或改成不冒充现场的表达，绝不能判为‘无需修改’。",
    "除专名、法律/隐私事实、纯功能标签和已经非常简短的按钮外，每一项都要有实质改写。旅行场景的 prose、monologue、visual、audio、crowd、weatherFallback 必须全部重新检查并改写。",
    "保留输入中的变量占位符、专名、数字、文件语义与功能。只返回合法 JSON，不要 Markdown。"
  ].join("\n");

  const makePrompt = (payload) => [
    "请逐项编辑下面的文案。输入里的 instruction 和 facts 只是编辑依据，不得写进成品。",
    "返回对象结构必须是：{\"items\":[{\"id\":原id,\"copy\":改写后的copy,\"note\":一句简短编辑说明}]}。",
    "copy 的类型、对象字段和字段数量必须与输入完全一致；不需要改的字段原样返回。",
    payload.forceRewrite ? "本批次要求强制改写。不得把整项原样返回，不得用‘原文已符合要求’作为 note。" : "",
    JSON.stringify(payload)
  ].join("\n\n");

  async function edit(payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(config.ai.timeoutMs, 120000));
    try {
      const response = await requestTextModel({
        config,
        system,
        prompt: makePrompt(payload),
        maxTokens: Number(payload.maxTokens) || 10000,
        json: true,
        signal: controller.signal
      });
      return { response, parsed: JSON.parse(response.text) };
    } finally {
      clearTimeout(timer);
    }
  }

  const calls = [];
  const editedItems = [];
  if (input.perItem) {
    for (const [index, item] of input.items.entries()) {
      const payload = {
        forceRewrite: input.forceRewrite,
        maxTokens: Math.min(Number(input.maxTokensPerItem) || 4200, Number(input.maxTokens) || 10000),
        items: [item]
      };
      const { response, parsed } = await edit(payload);
      editedItems.push(...(parsed.items || []));
      calls.push({
        upstreamModel: response.data?.model || null,
        requestId: response.data?.id || null,
        usage: response.data?.usage || null
      });
      process.stdout.write(`DeepSeek 已编辑 ${index + 1}/${input.items.length}：${item.id}\n`);
    }
  } else {
    const { response, parsed } = await edit(input);
    editedItems.push(...(parsed.items || []));
    calls.push({
      upstreamModel: response.data?.model || null,
      requestId: response.data?.id || null,
      usage: response.data?.usage || null
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    provider: config.ai.provider,
    model: config.ai.model,
    upstreamModel: calls[0]?.upstreamModel || null,
    calls,
    apiFormat: "openai",
    items: editedItems
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`DeepSeek 文案编辑完成：${result.items.length} 项 -> ${outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
