const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");
const PRODUCT_COPY_FILES = [
  "prototype/index.html",
  "prototype/app.js",
  "prototype/map-runtime.js",
  "prototype/ajing-chat.js",
  "prototype/pwa/index.html",
  "prototype/pwa/app.js",
  "knowledge-base/culture-details.json",
  "scripts/build-deepseek-copy-input.js"
];

const RETIRED_FRONTSTAGE_TERMS = [
  "让 AI 出发",
  "AI 尚未出发",
  "AI 云旅行",
  "AI 旅人",
  "AI 决定",
  "AI 情境",
  "旅行搭子",
  "等待安排",
  "远方相识",
  "另一个我",
  "远方的我"
];

test("前台只用阿镜称呼旅行角色，不回退到 AI、搭子或旧隐喻", () => {
  for (const relativePath of PRODUCT_COPY_FILES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), "utf8");
    for (const term of RETIRED_FRONTSTAGE_TERMS) {
      assert.equal(source.includes(term), false, `${relativePath} 不应出现“${term}”`);
    }
  }
});

test("阿镜是角色底座中的唯一正式名字", () => {
  const identity = fs.readFileSync(path.join(ROOT, "agent/USER.md"), "utf8");
  assert.match(identity, /\| 名字 \| 阿镜 \|/);
});

test("来信播放器只显示阿镜，不向用户暴露语音供应商或设备降级", () => {
  const html = fs.readFileSync(path.join(ROOT, "prototype/pwa/index.html"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "prototype/pwa/app.js"), "utf8");
  assert.match(html, /听阿镜慢慢讲/);
  assert.match(app, /阿镜 · 正在讲给你听/);
  assert.doesNotMatch(`${html}\n${app}`, /MiniMax 女声|本机女声|MiniMax 未配置|正在请 MiniMax/);
});

test("旅行页面不再露出写作流程，也不拿无依据的现场细节补气氛", () => {
  const source = [
    "prototype/index.html",
    "prototype/app.js",
    "prototype/pwa/index.html",
    "prototype/pwa/app.js"
  ].map((relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8")).join("\n");

  assert.doesNotMatch(source, /这一笺先把|暂不写成亲历|资料针脚|生成待重试|声音资料还没有接入/);
  assert.doesNotMatch(source, /队伍在旧街口变长|一炉点心刚出炉|店家刚摆出的点心|羊汤和辣椒先把清晨叫醒|晚归的人穿过桥边|夜市里的一桌热气|河风吹过步道|屋檐把声音收住/);
});

test("文案批改脚本通过项目文字模型客户端固定走 DeepSeek V4 Pro", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const editor = fs.readFileSync(path.join(ROOT, "scripts/deepseek-copy-editor.js"), "utf8");
  const runner = fs.readFileSync(path.join(ROOT, "scripts/run-deepseek-copy-pass.js"), "utf8");

  assert.equal(packageJson.scripts["copy:deepseek"], "node scripts/run-deepseek-copy-pass.js");
  assert.match(editor, /require\("\.\.\/server\/text-model-client"\)/);
  assert.match(editor, /requestTextModel\(/);
  assert.match(editor, /config\.ai\.provider !== "deepseek"/);
  assert.match(editor, /config\.ai\.model !== "deepseek-v4-pro"/);
  assert.match(runner, /deepseek-copy-editor\.js/);
});
