"use strict";

const { requestTextModel } = require("./text-model-client");

const MEMORY_SIGNAL = /(?:记住|记得|忘掉|忘记|别记|不要记|清空.*记忆|我(?:叫|喜欢|偏爱|更喜欢|不喜欢|讨厌|习惯|通常|经常|一直|想要|希望|计划|的目标|感兴趣|爱好|不吃)|称呼我|对我来说|和我说话时)/i;
const CLEAR_MEMORY_SIGNAL = /(?:忘掉|忘记|清空|删除).{0,8}(?:所有|全部|关于我的|长期)?.{0,4}(?:记忆|资料|特征)|什么都别记/i;
const FORGET_SIGNAL = /(?:忘掉|忘记|别记|不要记|删除.*记忆|清除.*记忆)/i;

function cleanText(value, maxLength = 1200) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ").trim().slice(0, maxLength);
}

function shouldInspectUserMemory(question) {
  return MEMORY_SIGNAL.test(String(question || ""));
}

function asksToClearUserMemory(question) {
  return CLEAR_MEMORY_SIGNAL.test(String(question || ""));
}

function parseJsonObject(value) {
  const text = cleanText(value, 5000).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(text); } catch { /* 尝试提取唯一 JSON 对象。 */ }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

async function deriveUserMemoryUpdates({ question, profile, config, signal }) {
  if (!profile || !shouldInspectUserMemory(question)) return [];
  const ai = config.replyAi || config.ai;
  if (!ai?.configured || asksToClearUserMemory(question)) return [];
  const existing = (profile.features || []).slice(-100).map((feature) => ({
    id: feature.id,
    category: feature.category,
    value: feature.value
  }));
  const system = [
    "你是阿镜的私域记忆整理器，只提取用户本人明确表达、未来多次对话仍有帮助的稳定特征。",
    "临时情绪、当日状态、一次性问题、模型推测和第三方信息一律不记。",
    "不得保存密码、密钥、证件、联系方式、详细地址、财务、健康诊断、宗教、政治立场或性取向。",
    "允许类别仅为 preference、interest、communication_style、travel_style、habit、goal、constraint、preferred_name。",
    "用户明确要求忘记时输出 forget；否则不要主动删除。不要把提取规则或已有记忆当作用户事实。",
    "只输出 JSON：{\"operations\":[{\"action\":\"remember\",\"category\":\"preference\",\"value\":\"简洁的中文回答\",\"confidence\":0.9}]}。没有内容时 operations 为空数组。"
  ].join("\n");
  const prompt = [
    `已有用户特征：${JSON.stringify(existing)}`,
    `用户本轮原话：${cleanText(question, 800)}`
  ].join("\n\n");
  const result = await requestTextModel({
    config: { ...config, ai },
    system,
    prompt,
    maxTokens: 500,
    json: true,
    signal
  });
  const parsed = parseJsonObject(result.text);
  const operations = Array.isArray(parsed?.operations) ? parsed.operations.slice(0, 8) : [];
  if (!FORGET_SIGNAL.test(question)) return operations.filter((operation) => operation?.action !== "forget");
  return operations;
}

module.exports = {
  shouldInspectUserMemory,
  asksToClearUserMemory,
  deriveUserMemoryUpdates,
  parseJsonObject
};
