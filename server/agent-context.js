"use strict";

const fs = require("node:fs");
const path = require("node:path");

const AGENT_DIR = path.resolve(__dirname, "..", "agent");

const DOCUMENT_GROUPS = {
  decision: [
    "USER.md", "RELATIONSHIP.md", "SOUL.md", "WORLD.md", "LIFE.md",
    "STORY.md", "PREFERENCES.md", "MEMORY.md", "AGENCY.md", "RESEARCH.md",
    "TRAVEL_ESSAY.md", "PRESENCE.md", "PUBLIC_WRITING.md", "CONTENT.md", "POSTCARD.md"
  ],
  journal: [
    "USER.md", "RELATIONSHIP.md", "SOUL.md", "WORLD.md", "STORY.md",
    "PREFERENCES.md", "MEMORY.md", "TRAVEL_ESSAY.md", "PRESENCE.md", "PUBLIC_WRITING.md", "CONTENT.md", "POSTCARD.md"
  ],
  conversation: [
    "USER.md", "RELATIONSHIP.md", "SOUL.md", "WORLD.md", "MEMORY.md",
    "RESEARCH.md", "PUBLIC_WRITING.md", "POSTCARD.md"
  ]
};

const GROUP_LIMITS = { decision: 42000, journal: 36000, conversation: 26000 };

function cleanText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function readAgentDocuments(group = "decision") {
  const names = DOCUMENT_GROUPS[group] || DOCUMENT_GROUPS.decision;
  const limit = GROUP_LIMITS[group] || GROUP_LIMITS.decision;
  return names.map((filename) => {
    try {
      const text = fs.readFileSync(path.join(AGENT_DIR, filename), "utf8");
      return `\n--- ${filename} ---\n${text}`;
    } catch {
      return "";
    }
  }).join("").slice(0, limit);
}

function summarizeEntry(entry) {
  return {
    id: entry.id,
    at: entry.context?.localTime?.iso || entry.meta?.generatedAt || null,
    place: entry.locationName,
    headline: cleanText(entry.content?.headline, 100),
    observation: cleanText(entry.content?.observation, 220)
  };
}

function summarizeDecision(decision) {
  return {
    at: decision?.at || decision?.createdAt || null,
    action: decision?.action || null,
    place: decision?.locationName || decision?.locationId || null,
    mood: cleanText(decision?.mood, 36),
    thought: cleanText(decision?.thought, 260),
    nextStopReason: cleanText(decision?.nextStopReason, 180)
  };
}

function buildDynamicAgentContext(journey, options = {}) {
  if (!journey) return "当前没有关联具体旅程；保持阿镜的身份与事实边界，不假装拥有尚未发生的共同经历。";
  const memoryLimit = options.memoryLimit || 12;
  const entryLimit = options.entryLimit || 6;
  const memories = (journey.memories || []).slice(-memoryLimit).map((memory) => ({
    id: memory.id,
    kind: memory.kind,
    at: memory.at || memory.occurredAt,
    text: cleanText(memory.text || memory.whatHappened, 300),
    reflection: cleanText(memory.reflection, 240),
    scope: memory.scope || memory.privacy || null,
    replyToEntryId: memory.replyToEntryId || null,
    preferenceUpdates: memory.preferenceUpdates || []
  }));
  const journeyState = { ...(journey.state || {}) };
  if (journeyState.nextLocationRevealed === false) delete journeyState.nextLocationId;
  const lastAgentDecision = journey.agent?.lastRun?.decision;
  const latestPublicDecision = lastAgentDecision ? {
    action: lastAgentDecision.action || null,
    contentIntent: cleanText(lastAgentDecision.contentIntent, 260)
  } : null;
  const payload = {
    relationship: {
      sharedWords: cleanText(journey.settings?.commission, 600),
      sharedMemories: memories.filter((item) => ["user_clue", "shared_reply", "conversation"].includes(item.kind)),
      recentAgentMemories: memories.filter((item) => !["user_clue", "shared_reply", "conversation"].includes(item.kind))
    },
    journey: {
      id: journey.id,
      theme: journey.settings?.theme,
      mode: journey.settings?.mode,
      pace: journey.settings?.pace,
      state: journeyState,
      embodiment: journey.embodiment,
      learnedPreferences: journey.preferences?.learned || [],
      latestPublicDecision,
      recentDecisions: (journey.decisions || []).slice(-6).map(summarizeDecision),
      recentEntries: (journey.entries || []).filter((entry) => entry.status === "ready").slice(-entryLimit).map(summarizeEntry)
    }
  };
  return JSON.stringify(payload);
}

function taskSystemPrompt(group, taskRules) {
  return [
    "以下角色文档定义同一位持续生活的旅行者阿镜。稳定人格与关系原则应贯穿决策、写作和对话；不得把阿镜切换成客服、编辑器或百科向导。",
    readAgentDocuments(group),
    "\n--- 本次任务规则 ---",
    taskRules
  ].join("\n");
}

module.exports = {
  DOCUMENT_GROUPS,
  readAgentDocuments,
  buildDynamicAgentContext,
  taskSystemPrompt
};
