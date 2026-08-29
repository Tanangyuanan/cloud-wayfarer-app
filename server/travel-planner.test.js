"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("桌面端把途经点、文化页与旅途发现统一收藏并生成旅行计划", () => {
  const html = read("prototype/index.html");
  const app = read("prototype/app.js");

  assert.match(html, /id="workspace-panel-collection"/);
  assert.match(html, /id="travel-collection-list"/);
  assert.match(html, /id="generate-travel-plan"/);
  assert.match(html, /只使用你主动收藏的内容/);

  assert.match(app, /TRAVEL_COLLECTION_STORAGE_KEY = "cloud_wayfarer-travel-wishlist-v1"/);
  assert.match(app, /function currentWaypointCollectionItem\(/);
  assert.match(app, /function collectionItemFromNode\(/);
  assert.match(app, /function commerceTravelCollectionItem\(/);
  assert.match(app, /function renderTravelPlanResult\(/);
  assert.match(app, /travelCollectionItems\.filter\(\(item\) => item\.selected !== false\)/);
});

test("移动端只在规划时请求位置，失败时按收藏顺序降级且不保存位置", () => {
  const html = read("prototype/pwa/index.html");
  const app = read("prototype/pwa/app.js");

  assert.match(html, /id="mobile-favorite-list"/);
  assert.match(html, /id="mobile-plan-favorites"/);
  assert.match(html, /规划时才会请求位置，且不会保存/);

  assert.match(app, /FOOTPRINT_FAVORITES_KEY = "cloud_wayfarer-travel-wishlist-v1"/);
  assert.match(app, /async function planMobileFavorites\(/);
  assert.match(app, /navigator\.geolocation\.getCurrentPosition/);
  assert.match(app, /mobileOrderedFavorites\(origin\)/);
  assert.match(app, /未读取位置，先按收藏顺序整理/);
  assert.doesNotMatch(app, /localStorage\.setItem\([^\n]*(?:latitude|longitude|userCoordinates)/);
});

test("公开前端不重新引入旧项目名称", () => {
  const publicSources = [
    "prototype/index.html",
    "prototype/app.js",
    "prototype/styles.css",
    "prototype/pwa/index.html",
    "prototype/pwa/app.js",
    "prototype/pwa/styles.css"
  ].map(read).join("\n");

  assert.doesNotMatch(publicSources, /黔镜|QIANJING|Qianjing|qianjing/);
});
