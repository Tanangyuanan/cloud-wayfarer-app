"use strict";

const CITY_ENGLISH = {
  guiyang: "GUIYANG",
  qingyan: "QINGYAN",
  xiuwen: "XIUWEN",
  anshun: "ANSHUN",
  huangguoshu: "HUANGGUOSHU",
  zhijin: "ZHIJIN",
  bijie: "BIJIE",
  weining: "WEINING",
  liupanshui: "LIUPANSHUI",
  xingyi: "XINGYI",
  libo: "LIBO",
  duyun: "DUYUN",
  kaili: "KAILI",
  xijiang: "XIJIANG",
  zhenyuan: "ZHENYUAN",
  tongren: "TONGREN",
  fanjingshan: "FANJINGSHAN",
  zunyi: "ZUNYI",
  hailongtun: "HAILONGTUN",
  maotai: "MAOTAI",
  chishui: "CHISHUI"
};

function ticketMonth(localTime, fallback = new Date()) {
  const iso = String(localTime?.iso || "");
  const isoMatch = iso.match(/^(\d{4})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;
  const localMatch = String(localTime?.localText || "").match(/(\d{4})[/-](\d{2})/);
  if (localMatch) return `${localMatch[1]}-${localMatch[2]}`;
  return `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildTravelTicketPrompt({ cityName, cityEnglish, issuedOn }) {
  return [
    `做成一张精致的旅行纪念票根海报，给我做一个${cityName}的。`,
    "画面主体是一张横向票根卡片，左侧是旅行地点的风景插画，保留原照片中的主要建筑、景点和构图，将其转成温柔细腻的手绘插画风格，色彩清新、明亮、有旅行手账感。",
    `右侧连接一张白色竖向票根标签，票根边缘有半圆缺口和虚线打孔效果，上面排版文字：N0.2026 ${cityEnglish} ${issuedOn} NO.2026 TRAVEL TICKET，并在底部加入一条黑色条形码。`,
    "整体是3D立体纸质票根效果，圆角卡片，轻微厚度，柔和投影，悬浮在背景上。",
    "以随请求提供的地点原图作为左侧插画的构图参考；所有票面文字必须准确、清晰，不增加 Logo、水印或其他文字。"
  ].join(" ");
}

function createTravelTicket({ location, routeOrder, localTime, sourceImage, now = new Date() }) {
  const issuedOn = ticketMonth(localTime, now);
  const cityEnglish = CITY_ENGLISH[location.id] || String(location.name || location.id).toUpperCase();
  const serial = String(Math.max(1, Number(routeOrder) || 1)).padStart(3, "0");
  return {
    kind: "travel-ticket",
    city: location.name,
    cityEnglish,
    issuedOn,
    number: `NO.2026-${serial}`,
    label: "TRAVEL TICKET",
    sourceImage: sourceImage || null,
    prompt: buildTravelTicketPrompt({ cityName: location.name, cityEnglish, issuedOn })
  };
}

module.exports = {
  CITY_ENGLISH,
  ticketMonth,
  buildTravelTicketPrompt,
  createTravelTicket
};
