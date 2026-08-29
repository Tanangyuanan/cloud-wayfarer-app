"use strict";

function boolFromEnv(name, fallback) {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return !["0", "false", "no", "off"].includes(String(value).toLowerCase());
}

function numberFromEnv(name, fallback, min, max) {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function resolveAiEnvironment() {
  const requestedProvider = String(process.env.AI_PROVIDER || "deepseek").trim().toLowerCase();
  const customSpecified = Boolean(process.env.AI_API_KEY || process.env.AI_BASE_URL || process.env.AI_MODEL);
  const useDeepSeek = requestedProvider === "deepseek"
    || (requestedProvider === "auto" && Boolean(process.env.DEEPSEEK_API_KEY));
  const useMiniMax = requestedProvider === "minimax"
    || (requestedProvider === "auto" && !useDeepSeek && !customSpecified && Boolean(process.env.MINIMAX_API_KEY));

  if (useDeepSeek) {
    return {
      provider: "deepseek",
      apiFormat: "openai",
      baseUrl: cleanBaseUrl(process.env.AI_BASE_URL || process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"),
      apiKey: process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
      model: process.env.AI_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-v4-pro"
    };
  }

  if (useMiniMax) {
    return {
      provider: "minimax",
      apiFormat: "anthropic",
      baseUrl: cleanBaseUrl(process.env.AI_BASE_URL || process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/anthropic"),
      apiKey: process.env.AI_API_KEY || process.env.MINIMAX_API_KEY || "",
      model: process.env.AI_MODEL || process.env.MINIMAX_MODEL || "MiniMax-M3"
    };
  }

  return {
    provider: requestedProvider === "auto" ? (customSpecified ? "custom" : "anthropic-compatible") : requestedProvider,
    apiFormat: String(process.env.AI_API_FORMAT || "anthropic").trim().toLowerCase(),
    baseUrl: cleanBaseUrl(process.env.AI_BASE_URL || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com"),
    apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || "",
    model: process.env.AI_MODEL || process.env.ANTHROPIC_MODEL || process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || ""
  };
}

function resolveReplyAiEnvironment() {
  return {
    provider: "minimax",
    apiFormat: "anthropic",
    baseUrl: cleanBaseUrl(process.env.MINIMAX_CHAT_BASE_URL || process.env.MINIMAX_BASE_URL || "https://api.minimaxi.com/anthropic"),
    apiKey: process.env.MINIMAX_CHAT_API_KEY || process.env.MINIMAX_API_KEY || "",
    model: process.env.MINIMAX_CHAT_MODEL || process.env.MINIMAX_MODEL || "MiniMax-M3"
  };
}

function getConfig() {
  const aiEnvironment = resolveAiEnvironment();
  const replyAiEnvironment = resolveReplyAiEnvironment();
  const aiEnabled = boolFromEnv("AI_ENABLED", true);
  const replyAiEnabled = aiEnabled && boolFromEnv("MINIMAX_CHAT_ENABLED", true);
  const configuredSearchProvider = String(process.env.SEARCH_PROVIDER || "auto").toLowerCase();

  return {
    port: numberFromEnv("CLOUD_WAYFARER_PORT", 8787, 1, 65535),
    ai: {
      enabled: aiEnabled,
      provider: aiEnvironment.provider,
      apiFormat: aiEnvironment.apiFormat,
      baseUrl: aiEnvironment.baseUrl,
      apiKey: aiEnvironment.apiKey,
      model: aiEnvironment.model,
      temperature: numberFromEnv("AI_TEMPERATURE", aiEnvironment.provider === "deepseek" ? 0.35 : aiEnvironment.provider === "minimax" ? 0.2 : 0.25, 0.01, 1),
      timeoutMs: numberFromEnv("AI_REQUEST_TIMEOUT_MS", 45000, 3000, 120000),
      configured: Boolean(aiEnabled && aiEnvironment.apiKey && aiEnvironment.model)
    },
    replyAi: {
      enabled: replyAiEnabled,
      provider: replyAiEnvironment.provider,
      apiFormat: replyAiEnvironment.apiFormat,
      baseUrl: replyAiEnvironment.baseUrl,
      apiKey: replyAiEnvironment.apiKey,
      model: replyAiEnvironment.model,
      temperature: numberFromEnv("MINIMAX_CHAT_TEMPERATURE", 0.2, 0.01, 1),
      timeoutMs: numberFromEnv("MINIMAX_CHAT_TIMEOUT_MS", numberFromEnv("AI_REQUEST_TIMEOUT_MS", 45000, 3000, 120000), 3000, 120000),
      configured: Boolean(replyAiEnabled && replyAiEnvironment.apiKey && replyAiEnvironment.model)
    },
    image: {
      enabled: boolFromEnv("MINIMAX_IMAGE_ENABLED", Boolean(process.env.MINIMAX_API_KEY)),
      provider: "minimax",
      baseUrl: cleanBaseUrl(process.env.MINIMAX_IMAGE_BASE_URL || "https://api.minimaxi.com"),
      apiKey: process.env.MINIMAX_IMAGE_API_KEY || process.env.MINIMAX_API_KEY || "",
      model: process.env.MINIMAX_IMAGE_MODEL || "image-01",
      timeoutMs: numberFromEnv("MINIMAX_IMAGE_TIMEOUT_MS", 90000, 5000, 180000),
      configured: Boolean(
        boolFromEnv("MINIMAX_IMAGE_ENABLED", Boolean(process.env.MINIMAX_API_KEY))
        && (process.env.MINIMAX_IMAGE_API_KEY || process.env.MINIMAX_API_KEY)
      )
    },
    speech: {
      enabled: boolFromEnv("MINIMAX_SPEECH_ENABLED", Boolean(process.env.MINIMAX_API_KEY)),
      provider: "minimax",
      baseUrl: cleanBaseUrl(process.env.MINIMAX_SPEECH_BASE_URL || "https://api.minimaxi.com"),
      apiKey: process.env.MINIMAX_SPEECH_API_KEY || process.env.MINIMAX_API_KEY || "",
      model: process.env.MINIMAX_SPEECH_MODEL || "speech-2.8-hd",
      voiceId: process.env.MINIMAX_SPEECH_VOICE_ID || "Chinese (Mandarin)_News_Anchor",
      emotion: process.env.MINIMAX_SPEECH_EMOTION || "calm",
      speed: numberFromEnv("MINIMAX_SPEECH_SPEED", 0.92, 0.5, 2),
      timeoutMs: numberFromEnv("MINIMAX_SPEECH_TIMEOUT_MS", 120000, 5000, 180000),
      configured: Boolean(
        boolFromEnv("MINIMAX_SPEECH_ENABLED", Boolean(process.env.MINIMAX_API_KEY))
        && (process.env.MINIMAX_SPEECH_API_KEY || process.env.MINIMAX_API_KEY)
      )
    },
    weather: {
      enabled: boolFromEnv("WEATHER_ENABLED", true),
      timeoutMs: numberFromEnv("WEATHER_TIMEOUT_MS", 6500, 1000, 20000)
    },
    airQuality: {
      enabled: boolFromEnv("AIR_QUALITY_ENABLED", true),
      timeoutMs: numberFromEnv("AIR_QUALITY_TIMEOUT_MS", 6500, 1000, 20000)
    },
    publicWorld: {
      enabled: boolFromEnv("WORLD_PUBLIC_DATA_ENABLED", true),
      timeoutMs: numberFromEnv("WORLD_PUBLIC_TIMEOUT_MS", 8000, 1000, 30000),
      slowTimeoutMs: numberFromEnv("WORLD_PUBLIC_SLOW_TIMEOUT_MS", 15000, 3000, 45000),
      elevationEnabled: boolFromEnv("WORLD_ELEVATION_ENABLED", true),
      historyEnabled: boolFromEnv("WORLD_HISTORY_ENABLED", true),
      historyYears: numberFromEnv("WORLD_HISTORY_YEARS", 10, 3, 30),
      floodEnabled: boolFromEnv("WORLD_FLOOD_ENABLED", true),
      gbifEnabled: boolFromEnv("WORLD_GBIF_ENABLED", true),
      inaturalistEnabled: boolFromEnv("WORLD_INATURALIST_ENABLED", true),
      biodiversityRadiusKm: numberFromEnv("WORLD_BIODIVERSITY_RADIUS_KM", 25, 1, 100),
      earthquakeEnabled: boolFromEnv("WORLD_EARTHQUAKE_ENABLED", true),
      earthquakeRadiusKm: numberFromEnv("WORLD_EARTHQUAKE_RADIUS_KM", 300, 25, 2000),
      firmsEnabled: boolFromEnv("WORLD_FIRMS_ENABLED", true),
      firmsMapKey: process.env.NASA_FIRMS_MAP_KEY || "",
      fireRadiusKm: numberFromEnv("WORLD_FIRE_RADIUS_KM", 100, 10, 500),
      orbitalEnabled: boolFromEnv("WORLD_ORBITAL_ENABLED", true),
      aviationEnabled: boolFromEnv("WORLD_AVIATION_ENABLED", true),
      aviationRadiusKm: numberFromEnv("WORLD_AVIATION_RADIUS_KM", 100, 10, 250),
      openSkyClientId: process.env.OPENSKY_CLIENT_ID || "",
      openSkyClientSecret: process.env.OPENSKY_CLIENT_SECRET || ""
    },
    search: {
      enabled: boolFromEnv("SEARCH_ENABLED", true),
      provider: configuredSearchProvider,
      allowPublicSearch: boolFromEnv("ALLOW_PUBLIC_SEARCH", true),
      timeoutMs: numberFromEnv("SEARCH_TIMEOUT_MS", 8000, 1000, 25000),
      tavilyKey: process.env.TAVILY_API_KEY || "",
      braveKey: process.env.BRAVE_SEARCH_API_KEY || "",
      serperKey: process.env.SERPER_API_KEY || ""
    }
  };
}

function describeSearchProvider(config) {
  if (config.search.enabled === false) return "local-only";
  const requested = config.search.provider;
  if ((requested === "auto" || requested === "tavily") && config.search.tavilyKey) return "tavily";
  if ((requested === "auto" || requested === "brave") && config.search.braveKey) return "brave";
  if ((requested === "auto" || requested === "serper") && config.search.serperKey) return "serper";
  if (config.search.allowPublicSearch && ["auto", "wikipedia"].includes(requested)) return "wikipedia";
  return "local-only";
}

module.exports = { getConfig, describeSearchProvider, resolveAiEnvironment, resolveReplyAiEnvironment };
