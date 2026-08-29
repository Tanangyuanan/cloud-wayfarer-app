"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const heritageCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge-base", "heritage-catalog.json"), "utf8"));

const CITY_IDS = new Set([
  "guiyang", "zunyi", "anshun", "liupanshui", "bijie",
  "tongren", "qiandongnan", "qiannan", "qianxinan"
]);

function normalizedName(value) {
  return String(value || "").replace(/[\s（）()“”"'·—_-]+/g, "").toLowerCase();
}

test("非遗扩充目录满足城市、来源与字段完整性要求", () => {
  assert.equal(heritageCatalog.nodes.length, 104);
  assert.equal(heritageCatalog.stats.total, heritageCatalog.nodes.length);

  const ids = new Set();
  const cityNames = new Set();
  const cityCounts = new Map();

  for (const node of heritageCatalog.nodes) {
    assert.match(node.id, /^IHC-(GY|ZY|AS|LPS|BJ|TR|QDN|QN|QXN)-\d{3}$/);
    assert.equal(ids.has(node.id), false, `重复 ID: ${node.id}`);
    ids.add(node.id);

    assert.equal(CITY_IDS.has(node.cityId), true, `未知城市: ${node.cityId}`);
    assert.equal(node.contentKind, "culture");
    assert.equal(node.status, "A");
    assert.ok(node.name.trim());
    assert.ok(node.domain.trim());
    assert.ok(node.summary.length >= 45, `${node.name} 的摘要过短`);
    assert.ok(node.heritage?.officialName);
    assert.ok(node.heritage?.category);
    assert.ok(node.heritage?.location);
    assert.ok(node.heritage?.level);
    assert.ok(node.heritage?.batch);

    const compositeName = `${node.cityId}:${normalizedName(node.name)}`;
    assert.equal(cityNames.has(compositeName), false, `同城重复名称: ${node.name}`);
    cityNames.add(compositeName);

    assert.ok(Array.isArray(node.sourceIds) && node.sourceIds.length > 0);
    for (const sourceId of node.sourceIds) {
      const source = heritageCatalog.sources[sourceId];
      assert.ok(source, `${node.name} 缺少来源 ${sourceId}`);
      assert.match(source.url, /^https?:\/\//);
    }

    cityCounts.set(node.cityId, (cityCounts.get(node.cityId) || 0) + 1);
  }

  assert.deepEqual([...cityCounts.keys()].sort(), [...CITY_IDS].sort());
  assert.ok([...cityCounts.values()].every((count) => count >= 8 && count <= 12));
});

test("生成脚本重复执行时保持目录结果稳定", () => {
  const before = fs.readFileSync(path.join(ROOT, "knowledge-base", "heritage-catalog.json"), "utf8");
  delete require.cache[require.resolve("../scripts/generate-heritage-catalog")];
  require("../scripts/generate-heritage-catalog");
  const after = fs.readFileSync(path.join(ROOT, "knowledge-base", "heritage-catalog.json"), "utf8");
  assert.equal(after, before);
});
