"use strict";

const INTERNAL_LANGUAGE_PATTERN = /(?:用户(?:的)?委托|委托是|根据用户(?:需求|委托)|whyForUser|why_for_user|contentIntent|deliveryFormat|researchStatus|long_letter|\bnote\b|\bpostcard\b|Agent\s*(?:决定|已提交)?|AI\s*(?:生成|整理)|模型(?:生成|未完成)|系统模板|后端(?:降级|来信|内容)|内容意图|暂不写成亲历|检索与核实边界|没有依据的人和事|资料仍在整理|这一笺先把|这一页先留|不替.{0,18}开口|我没(?:有)?编|今天没走到|不伪装亲历|待验证|资料线索指向|阿镜(?:写在|的现场笔记))/i;

const USER_RELATIONSHIP_PATTERN = /(?:你(?:说|问|写|留|托|交给|提醒|让)过?|你那条|你的那条|我们(?:说好|约好|约定))/;

function hasInternalLanguage(value) {
  return INTERNAL_LANGUAGE_PATTERN.test(String(value || ""));
}

function hasUserRelationshipLanguage(value) {
  return USER_RELATIONSHIP_PATTERN.test(String(value || ""));
}

function cleanPublicHeading(value, maxLength = 80) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/^\s*(?:远方来信|旅程来信)\s*[·|:：-]\s*(?:note|postcard|long_letter)\s*$/gim, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

module.exports = {
  INTERNAL_LANGUAGE_PATTERN,
  USER_RELATIONSHIP_PATTERN,
  hasInternalLanguage,
  hasUserRelationshipLanguage,
  cleanPublicHeading
};
