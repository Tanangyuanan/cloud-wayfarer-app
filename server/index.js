"use strict";

const http = require("node:http");
const { loadLocalEnv } = require("./load-env");
const { getConfig, describeSearchProvider } = require("./config");
const { createRequestHandler } = require("./app");
const { createJourneyService } = require("./journey-service");
const { publicWorldCapabilitySummary } = require("./public-world-tools");

loadLocalEnv();
const config = getConfig();
const journeyService = createJourneyService({ config });
const server = http.createServer(createRequestHandler({ config, journeyService }));
const journeyTimer = setInterval(() => {
  journeyService.processDueJourneys().catch((error) => console.error("旅程后台同步失败：", error.message));
}, 10_000);
journeyTimer.unref();

server.listen(config.port, "127.0.0.1", () => {
  const modelState = config.ai.configured
    ? `已配置 ${config.ai.provider} / ${config.ai.model}`
    : "未配置（使用工具降级回答）";
  const replyModelState = config.replyAi.configured
    ? `已配置 ${config.replyAi.provider} / ${config.replyAi.model}`
    : "未配置（聊天使用知识库降级回答）";
  console.log(`云游四方 · Cloud Wayfarer 已启动：http://127.0.0.1:${config.port}/prototype/`);
  console.log(`内容模型：${modelState}；阿镜回复：${replyModelState}；搜索：${describeSearchProvider(config)}；天气：${config.weather.enabled ? "open-meteo" : "关闭"}；空气：${config.airQuality?.enabled ? "open-meteo" : "关闭"}`);
  const publicWorld = publicWorldCapabilitySummary(config);
  const publicCount = Object.values(publicWorld.sources).filter((item) => item.enabled).length;
  const configuredCount = Object.values(publicWorld.sources).filter((item) => item.enabled && item.configured !== false).length;
  console.log(`公开世界数据：${publicWorld.enabled ? `${publicCount}类已接入，${configuredCount}类可立即运行` : "关闭"}`);
  journeyService.processDueJourneys().catch((error) => console.error("旅程恢复失败：", error.message));
});

function stop() {
  clearInterval(journeyTimer);
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
