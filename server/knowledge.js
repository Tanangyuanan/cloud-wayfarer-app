"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const KNOWLEDGE_DIR = path.join(ROOT, "knowledge-base");
const NODE_FILES = ["culture-nodes.json", "attraction-nodes.json", "city-supplement.json", "city-catalog.json", "heritage-catalog.json"];
const DETAIL_FILES = ["culture-details.json", "attraction-details.json", "city-supplement.json", "city-catalog.json", "heritage-catalog.json"];

const STOP_WORDS = new Set([
  "一个", "一下", "为什么", "为什", "现在", "这里", "那里", "什么", "怎么", "如何", "可以", "是否",
  "贵阳", "贵州", "旅行", "云游", "路线", "这条", "先去", "告诉", "介绍", "回答", "结合", "资料", "云游四方",
  "值得", "体验", "推荐", "好玩", "意义"
]);

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(KNOWLEDGE_DIR, name), "utf8"));
}

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/[\s，。！？、；：“”‘’（）()【】\[\]·—_-]+/g, "");
}

function termsFor(query) {
  const raw = String(query || "").trim();
  const chunks = raw.split(/[\s，。！？、；：“”‘’（）()【】\[\]·—_-]+/).filter(Boolean);
  const terms = new Set(chunks.filter((item) => item.length > 1 && !STOP_WORDS.has(item)));
  const compact = normalizeText(raw);
  for (let index = 0; index < compact.length - 1; index += 1) {
    const pair = compact.slice(index, index + 2);
    if (!STOP_WORDS.has(pair)) terms.add(pair);
  }
  return [...terms].slice(0, 24);
}

function buildIndex() {
  const nodes = [];
  const records = {};
  const sources = {};

  for (const file of NODE_FILES) {
    const data = readJson(file);
    for (const node of data.nodes || []) nodes.push({ ...node, sourceFile: file });
    Object.assign(sources, data.sources || {});
  }
  for (const file of DETAIL_FILES) {
    const data = readJson(file);
    Object.assign(records, data.records || {});
    Object.assign(sources, data.sources || {});
  }

  const documents = nodes.map((node) => {
    const detail = records[node.id] || {};
    const sections = (detail.sections || []).map((section) => `${section.title || ""} ${section.body || ""}`).join(" ");
    const fieldGuide = (detail.fieldGuide || []).join(" ");
    const relationText = (node.relations || []).map((relation) => relation.reason || "").join(" ");
    const sourceIds = [...new Set([...(node.sourceIds || []), ...(detail.sourceIds || [])])];
    const sourceList = sourceIds.map((id) => ({ id, ...(sources[id] || {}) })).filter((item) => item.title || item.url);
    const text = [node.name, node.domain, node.summary, node.listen, ...(node.see || []), sections, fieldGuide, relationText].filter(Boolean).join(" ");
    return {
      id: node.id,
      title: node.name,
      domain: node.domain || "贵州文化",
      summary: node.summary || sections.slice(0, 220),
      status: node.status || "B",
      text,
      normalized: normalizeText(text),
      sources: sourceList
    };
  });

  return { documents, sources };
}

let cachedIndex;

function getIndex() {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

function scoreDocument(document, query, terms) {
  const compactQuery = normalizeText(query);
  const title = normalizeText(document.title);
  let score = 0;
  if (compactQuery && title.includes(compactQuery)) score += 120;
  if (compactQuery && document.normalized.includes(compactQuery)) score += 70;
  for (const term of terms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;
    if (title.includes(normalizedTerm)) score += 18;
    if (document.normalized.includes(normalizedTerm)) score += 4;
  }
  if (document.status === "A") score += 2;
  return score;
}

function searchKnowledge(query, limit = 5) {
  const terms = termsFor(query);
  const scored = getIndex().documents
    .map((document) => ({ document, score: scoreDocument(document, query, terms) }))
    .filter((entry) => entry.score > 2)
    .sort((a, b) => b.score - a.score);
  const topScore = scored[0]?.score || 0;
  const relevanceFloor = topScore >= 18 ? Math.max(8, topScore * 0.4) : 3;
  return scored
    .filter((entry) => entry.score >= relevanceFloor)
    .slice(0, Math.max(1, Math.min(limit, 8)))
    .map(({ document, score }) => knowledgeResult(document, score));
}

function knowledgeResult(document, score = 0) {
  return {
    id: document.id,
    title: document.title,
    snippet: document.summary,
    domain: document.domain,
    evidenceStatus: document.status,
    score,
    sources: document.sources
  };
}

function getKnowledgeByIds(ids = []) {
  const requested = Array.isArray(ids) ? ids : [];
  const byId = new Map(getIndex().documents.map((document) => [document.id, document]));
  return requested
    .map((id) => byId.get(String(id || "")))
    .filter(Boolean)
    .map((document) => knowledgeResult(document, 1000));
}

function indexStats() {
  const index = getIndex();
  return { documents: index.documents.length, sources: Object.keys(index.sources).length };
}

module.exports = { searchKnowledge, getKnowledgeByIds, indexStats, normalizeText };
