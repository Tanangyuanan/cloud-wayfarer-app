"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { getConfig, describeSearchProvider } = require("./config");
const { resolveLocation } = require("./locations");
const { indexStats } = require("./knowledge");
const { getLocalTime, getWeather, gatherContext } = require("./tools");
const { generateAnswer } = require("./model");
const { createJourneyService } = require("./journey-service");
const { discoveryForLocation, recommendationForConversation } = require("./commerce");
const { createUserMemoryStore, validMemoryId } = require("./user-memory-store");
const { deriveUserMemoryUpdates, asksToClearUserMemory } = require("./user-memory");
const { synthesizeSpeech: defaultSynthesizeSpeech } = require("./speech");
const { dataCatalogSummary } = require("./world-data");
const { publicWorldCapabilitySummary } = require("./public-world-tools");

const ROOT = path.resolve(__dirname, "..");
const MAX_BODY_BYTES = 32 * 1024;
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2", ".md": "text/markdown; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(payload));
}

function sendEvent(response, event, payload) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function sendMedia(response, media) {
  const type = media.extension === "png" ? "image/png" : media.extension === "webp" ? "image/webp" : "image/jpeg";
  response.writeHead(200, {
    "content-type": type,
    "content-length": media.size,
    "cache-control": "private, max-age=31536000, immutable"
  });
  fs.createReadStream(media.path).pipe(response);
}

function sendAudio(response, result) {
  response.writeHead(200, {
    "content-type": result.mimeType || "audio/mpeg",
    "content-length": result.audio.length,
    "cache-control": "private, max-age=86400",
    "x-audio-provider": result.provider || "MiniMax",
    "x-audio-model": result.model || "",
    "x-audio-voice": result.voiceId || ""
  });
  response.end(result.audio);
}

function safeError(error) {
  return { code: error.code || "internal_error", message: error.publicMessage || "这会儿没能把话接回来，等一会儿再试。" };
}

async function readJsonBody(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) {
      const error = new Error("body_too_large");
      error.code = "body_too_large";
      error.publicMessage = "问题内容过长，请缩短后重试。";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.code = "invalid_json";
    error.publicMessage = "请求格式无效。";
    throw error;
  }
}

function serveStatic(urlPath, response) {
  let relativePath;
  if (urlPath === "/" || urlPath === "/prototype" || urlPath === "/prototype/") relativePath = "prototype/index.html";
  else if (urlPath === "/app" || urlPath === "/app/") relativePath = "prototype/pwa/index.html";
  else if (urlPath.startsWith("/app/")) relativePath = `prototype/pwa/${decodeURIComponent(urlPath.slice(5))}`;
  else relativePath = decodeURIComponent(urlPath).replace(/^\/+/, "");
  const absolutePath = path.resolve(ROOT, relativePath);
  const allowedRoots = [path.join(ROOT, "prototype"), path.join(ROOT, "knowledge-base")];
  if (!allowedRoots.some((allowed) => absolutePath === allowed || absolutePath.startsWith(`${allowed}${path.sep}`))) return false;
  let stat;
  try { stat = fs.statSync(absolutePath); } catch { return false; }
  if (!stat.isFile()) return false;
  response.writeHead(200, {
    "content-type": MIME_TYPES[path.extname(absolutePath).toLowerCase()] || "application/octet-stream",
    "content-length": stat.size,
    "cache-control": "no-cache"
  });
  fs.createReadStream(absolutePath).pipe(response);
  return true;
}

function createRateLimiter({ windowMs = 60_000, max = 30 } = {}) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= max;
  };
}

function createRequestHandler(options = {}) {
  const config = options.config || getConfig();
  const now = options.now || (() => new Date());
  const journeyService = options.journeyService || createJourneyService({ config, now });
  const userMemoryStore = options.userMemoryStore || createUserMemoryStore({ now });
  const synthesizeSpeech = options.synthesizeSpeech || defaultSynthesizeSpeech;
  const commerceRecommender = options.commerceRecommender || recommendationForConversation;
  const allowRequest = createRateLimiter();
  const allowGeneration = createRateLimiter({ windowMs: 5 * 60_000, max: 12 });

  return async function handle(request, response) {
    const url = new URL(request.url || "/", "http://localhost");
    try {
      if (request.method === "GET" && url.pathname === "/api/health") {
        return sendJson(response, 200, {
          ok: true,
          service: "cloud_wayfarer-ai-tools",
          capabilities: {
            agent: {
              configured: Boolean(config.ai.configured && ["deepseek", "minimax"].includes(config.ai.provider)),
              framework: "@earendil-works/pi-agent-core",
              version: "0.84.4",
              persona: "阿镜"
            },
            model: { configured: config.ai.configured, provider: config.ai.provider || null, model: config.ai.model || null },
            reply: { configured: config.replyAi?.configured || false, provider: config.replyAi?.provider || null, model: config.replyAi?.model || null },
            image: { configured: config.image?.configured || false, provider: config.image?.provider || null, model: config.image?.model || null },
            speech: { configured: config.speech?.configured || false, provider: config.speech?.provider || null, model: config.speech?.model || null },
            time: { available: true, source: "server" },
            weather: { available: config.weather.enabled, provider: "open-meteo" },
            airQuality: { available: config.airQuality?.enabled || false, provider: "open-meteo" },
            worldData: dataCatalogSummary(),
            publicWorld: publicWorldCapabilitySummary(config),
            search: { provider: describeSearchProvider(config) },
            commerce: { available: true, mode: "external-link-catalog", commercial: false },
            knowledge: indexStats()
          }
        });
      }

      if (request.method === "POST" && url.pathname === "/api/journeys") {
        const clientKey = request.socket?.remoteAddress || "local";
        if (!allowGeneration(clientKey)) return sendJson(response, 429, { ok: false, error: { code: "rate_limited", message: "手账生成请求有点密集，请稍后再试。" } });
        const body = await readJsonBody(request);
        const journey = journeyService.create({
          mode: body.mode,
          pace: body.pace,
          theme: body.theme,
          commission: body.commission,
          durationMinutes: body.durationMinutes
        });
        return sendJson(response, 201, { ok: true, journey });
      }

      const startMatch = url.pathname.match(/^\/api\/journeys\/([^/]+)\/start$/);
      if (request.method === "POST" && startMatch) {
        const clientKey = request.socket?.remoteAddress || "local";
        if (!allowGeneration(clientKey)) return sendJson(response, 429, { ok: false, error: { code: "rate_limited", message: "旅程启动请求有点密集，请稍后再试。" } });
        const journey = typeof journeyService.start === "function"
          ? await journeyService.start(startMatch[1])
          : journeyService.get(startMatch[1]);
        return sendJson(response, 200, { ok: true, journey });
      }

      const commandMatch = url.pathname.match(/^\/api\/journeys\/([^/]+)\/commands$/);
      if (request.method === "POST" && commandMatch) {
        const body = await readJsonBody(request);
        const journey = await journeyService.command(commandMatch[1], body);
        return sendJson(response, 200, { ok: true, journey });
      }

      const mediaMatch = url.pathname.match(/^\/api\/journeys\/([^/]+)\/media\/([^/]+)$/);
      if (request.method === "GET" && mediaMatch) {
        return sendMedia(response, journeyService.media(mediaMatch[1], mediaMatch[2]));
      }

      const generateMatch = url.pathname.match(/^\/api\/journeys\/([^/]+)\/stops\/([^/]+)\/generate$/);
      if (request.method === "POST" && generateMatch) {
        const clientKey = request.socket?.remoteAddress || "local";
        if (!allowGeneration(clientKey)) return sendJson(response, 429, { ok: false, error: { code: "rate_limited", message: "手账生成请求有点密集，请稍后再试。" } });
        const result = await journeyService.generateStop(generateMatch[1], generateMatch[2]);
        return sendJson(response, 200, { ok: true, ...result });
      }

      const journeyMatch = url.pathname.match(/^\/api\/journeys\/([^/]+)$/);
      if (request.method === "GET" && journeyMatch) {
        const journey = typeof journeyService.sync === "function"
          ? await journeyService.sync(journeyMatch[1])
          : journeyService.get(journeyMatch[1]);
        return sendJson(response, 200, { ok: true, journey });
      }

      if (request.method === "GET" && url.pathname === "/api/ai/context") {
        const location = resolveLocation(url.searchParams.get("location"));
        const localTime = getLocalTime(location.id, now());
        const weather = url.searchParams.get("weather") === "0" ? null : await getWeather(location.id, config);
        return sendJson(response, 200, { ok: true, location, localTime, weather });
      }

      if (request.method === "GET" && url.pathname === "/api/commerce/discoveries") {
        const location = resolveLocation(url.searchParams.get("location"));
        return sendJson(response, 200, {
          ok: true,
          location: { id: location.id, name: location.name },
          discovery: discoveryForLocation(location.id)
        });
      }

      if (request.method === "POST" && url.pathname === "/api/ai/ask") {
        const clientKey = request.socket?.remoteAddress || "local";
        if (!allowRequest(clientKey)) return sendJson(response, 429, { ok: false, error: { code: "rate_limited", message: "提问有点密集，请稍后再试。" } });
        const body = await readJsonBody(request);
        const question = String(body.question || "").trim();
        if (question.length < 1 || question.length > 800) {
          return sendJson(response, 400, { ok: false, error: { code: "invalid_question", message: "请输入 1—800 个字符的内容。" } });
        }
        let journey = null;
        if (body.journeyId && typeof journeyService.get === "function") {
          try { journey = journeyService.get(body.journeyId); } catch { /* 无效旅程不影响普通问答。 */ }
        }
        const context = await gatherContext({ question, locationId: body.locationId || "guiyang", config });
        context.journey = journey;
        const memoryId = validMemoryId(body.memoryId);
        const userMemory = memoryId ? userMemoryStore.read(memoryId) : null;
        const streaming = body.stream === true || String(request.headers?.accept || "").includes("text/event-stream");
        if (streaming) {
          response.writeHead(200, {
            "content-type": "text/event-stream; charset=utf-8",
            "cache-control": "no-cache, no-store",
            connection: "keep-alive",
            "x-accel-buffering": "no"
          });
          response.flushHeaders?.();
        }
        const answerPromise = generateAnswer({
          question,
          context,
          config,
          conversationHistory: body.conversationHistory,
          userMemory,
          onToken: streaming ? (delta) => {
            if (!response.destroyed) sendEvent(response, "delta", { delta });
          } : null
        });
        const memoryPromise = memoryId && !asksToClearUserMemory(question)
          ? deriveUserMemoryUpdates({ question, profile: userMemory, config }).catch(() => [])
          : Promise.resolve([]);
        const [result, memoryOperations] = await Promise.all([answerPromise, memoryPromise]);
        const memoryResult = memoryId
          ? asksToClearUserMemory(question)
            ? userMemoryStore.clear(memoryId)
            : userMemoryStore.apply(memoryId, memoryOperations)
          : { profile: null, changed: false, applied: 0 };
        const remembered = Boolean(body.remember === true && body.journeyId && typeof journeyService.rememberExchange === "function");
        if (remembered) {
          journeyService.rememberExchange(body.journeyId, question, result.answer, { replyToEntryId: body.replyToEntryId });
        }
        let recommendation = null;
        try {
          recommendation = await commerceRecommender({
            question,
            answer: result.answer,
            context,
            journey,
            conversationHistory: body.conversationHistory,
            userMemory,
            config,
            now: now()
          });
        } catch {
          // 商品入口是可选增强，任何判断失败都不影响正常对话。
        }
        if (recommendation && journey?.id && typeof journeyService.recordCommerceRecommendation === "function") {
          try { journeyService.recordCommerceRecommendation(journey.id, recommendation); } catch { /* 频控记录失败时不打断对话。 */ }
        }
        const payload = {
          ok: true,
          answer: result.answer,
          sources: result.sources,
          recommendation,
          context: { localTime: context.localTime, weather: context.weather },
          meta: {
            modelUsed: result.modelUsed,
            model: result.model || null,
            provider: result.provider || null,
            degraded: result.degraded,
            reason: result.reason || null,
            answerKind: result.answerKind || "grounded-answer",
            searchProvider: context.web?.provider || "local-only",
            searchResultCount: context.web?.results?.length || 0,
            recommendationIncluded: Boolean(recommendation),
            remembered,
            memory: {
              shortTermMessages: Array.isArray(body.conversationHistory) ? Math.min(body.conversationHistory.length, 20) : 0,
              longTermFeatures: memoryResult.profile?.features?.length ?? userMemory?.features?.length ?? 0,
              updated: memoryResult.changed,
              applied: memoryResult.applied
            },
            answeredAt: now().toISOString()
          }
        };
        if (streaming) {
          sendEvent(response, "final", payload);
          return response.end();
        }
        return sendJson(response, 200, payload);
      }

      if (request.method === "POST" && url.pathname === "/api/speech/letter") {
        const clientKey = request.socket?.remoteAddress || "local";
        if (!allowGeneration(clientKey)) return sendJson(response, 429, { ok: false, error: { code: "rate_limited", message: "声音生成得有点密集，请稍后再试。" } });
        const body = await readJsonBody(request);
        const text = String(body.text || "").trim();
        if (text.length < 1 || text.length > 10000) {
          return sendJson(response, 400, { ok: false, error: { code: "invalid_speech_text", message: "请输入 1—10000 个字符的来信正文。" } });
        }
        if (!config.speech?.configured) {
          return sendJson(response, 503, {
            ok: false,
            error: { code: "speech_not_configured", message: "阿镜的声音尚未配置，请配置后再试。" }
          });
        }
        const result = await synthesizeSpeech({ text, config });
        return sendAudio(response, result);
      }

      if (request.method === "GET" && serveStatic(url.pathname, response)) return;
      if (url.pathname.startsWith("/api/")) return sendJson(response, 404, { ok: false, error: { code: "not_found", message: "接口不存在。" } });
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("页面不存在");
    } catch (error) {
      const status = ["journey_not_found", "media_not_found"].includes(error.code)
        ? 404
        : ["invalid_json", "body_too_large", "invalid_journey_id", "invalid_media_name", "location_not_in_journey", "invalid_command"].includes(error.code)
          ? 400
          : 500;
      if (response.headersSent) {
        sendEvent(response, "error", { ok: false, error: safeError(error) });
        return response.end();
      }
      sendJson(response, status, { ok: false, error: safeError(error) });
    }
  };
}

module.exports = { createRequestHandler, readJsonBody, serveStatic, sendMedia, sendAudio, sendEvent };
