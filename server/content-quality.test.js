const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(projectRoot, "prototype", "app.js"), "utf8");
const catalog = JSON.parse(fs.readFileSync(path.join(projectRoot, "knowledge-base", "city-catalog.json"), "utf8"));

test("九城目录保持完整覆盖，且每条都明确停在待补证阶段", () => {
  const byCity = new Map();
  for (const node of catalog.nodes) {
    const nodes = byCity.get(node.cityId) || [];
    nodes.push(node);
    byCity.set(node.cityId, nodes);
  }

  assert.equal(byCity.size, 9);
  for (const [cityId, nodes] of byCity) {
    assert.equal(nodes.length, 12, `${cityId} 应保持 12 条城市目录`);
    for (const node of nodes) {
      assert.equal(node.status, "B", `${node.id} 不应被伪装成已完成深读`);
      assert.ok(node.summary?.length > 0, `${node.id} 需要一条可识别的摘要`);
      assert.ok(node.sourceIds?.length > 0, `${node.id} 至少需要一条初步来源`);
    }
  }
});

test("目录页不再用摘要伪造抵达故事和现场声音", () => {
  const retiredPhrases = [
    "先别找标准机位",
    "先听现场的人声、风声与脚步",
    "为什么列入城市目录",
    "到现场寻找："
  ];

  for (const phrase of retiredPhrases) {
    assert.equal(appSource.includes(phrase), false, `不应恢复通用话术：${phrase}`);
  }
  assert.match(appSource, /不把一条摘要扩写成“抵达故事”/);
  assert.match(appSource, /独立实景与现场观察待补/);
});

test("深读、导览和目录使用三种明确的内容层级", () => {
  assert.match(appSource, /contentDepth: "deep"/);
  assert.match(appSource, /contentDepth: "brief"/);
  assert.match(appSource, /contentDepth: "catalog"/);
  assert.match(appSource, /function lightweightDetailFor\(node\)/);
  assert.match(appSource, /dataset\.contentDepth = node\.contentDepth/);
});

test("九城全部目录条目只使用本地真实照片，不再回退到生成插画", () => {
  const assetBlock = appSource.match(/const NODE_PLATE_ASSETS = \{([\s\S]*?)\n\};/);
  const poolBlock = appSource.match(/const GROUP_REAL_PLATE_FALLBACKS = \{([\s\S]*?)\n\};/);
  const resolverBlock = appSource.match(/function plateAssetFor\(node\) \{([\s\S]*?)\n\}/);

  assert.ok(assetBlock, "缺少专属真实图片映射");
  assert.ok(poolBlock, "缺少同主题真实照片池");
  assert.ok(resolverBlock, "缺少目录图片解析函数");
  assert.doesNotMatch(resolverBlock[1], /generatedNodeCoverAsset/);
  assert.match(resolverBlock[1], /isRelatedFallback: true/);

  const assets = new Map(
    [...assetBlock[1].matchAll(/^\s*"([^"]+)":\s*\{\s*src:\s*"([^"]+)"/gm)]
      .map((match) => [match[1], match[2]])
  );
  const poolIds = [...poolBlock[1].matchAll(/"([A-Z0-9-]+)"/g)].map((match) => match[1]);

  assert.ok(poolIds.length > 0, "真实照片池不能为空");
  for (const referenceId of poolIds) {
    assert.ok(assets.has(referenceId), `照片池引用了未登记素材：${referenceId}`);
  }
  for (const [nodeId, source] of assets) {
    assert.doesNotMatch(source, /^data:/, `${nodeId} 不应使用内嵌生成图片`);
    assert.ok(fs.existsSync(path.join(projectRoot, "prototype", source)), `${nodeId} 图片文件不存在：${source}`);
  }
});
