"use strict";

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

function speechError(code, publicMessage) {
  const error = new Error(code);
  error.code = code;
  error.publicMessage = publicMessage;
  return error;
}

function generationError(payload) {
  const statusCode = Number(payload?.base_resp?.status_code ?? 0);
  if (statusCode === 1008) {
    return speechError("speech_quota_exhausted", "阿镜的声音额度暂时用完了，请补充后再试。");
  }
  return speechError("speech_generation_failed", "这次声音没有生成成功，请稍后再试。");
}

function decodeAudio(value) {
  const text = String(value || "").trim();
  if (!text || !/^[0-9a-f]+$/i.test(text) || text.length % 2 !== 0) {
    throw speechError("speech_audio_invalid", "这次声音没有生成完整，请稍后再试。");
  }
  const audio = Buffer.from(text, "hex");
  if (audio.length < 128 || audio.length > 30 * 1024 * 1024) {
    throw speechError("speech_audio_invalid", "这次声音没有生成完整，请稍后再试。");
  }
  return audio;
}

async function synthesizeSpeech({ text, config, fetchImpl = global.fetch }) {
  const speech = config?.speech;
  if (!speech?.configured) {
    throw speechError("speech_not_configured", "MiniMax 女声尚未配置，将改用手机里的可用女声朗读。");
  }
  const normalized = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!normalized || normalized.length > 10000) {
    throw speechError("invalid_speech_text", "这封信暂时无法朗读，请确认正文不超过一万字。");
  }
  const timeout = timeoutSignal(speech.timeoutMs);
  try {
    const response = await fetchImpl(`${speech.baseUrl}/v1/t2a_v2`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${speech.apiKey}`
      },
      body: JSON.stringify({
        model: speech.model,
        text: normalized,
        stream: false,
        language_boost: "Chinese",
        output_format: "hex",
        voice_setting: {
          voice_id: speech.voiceId,
          speed: speech.speed,
          vol: 1,
          pitch: 0,
          emotion: speech.emotion || "calm"
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1
        }
      }),
      signal: timeout.signal
    });
    if (!response.ok) throw speechError("speech_http_error", "阿镜的声音暂时没有接通，请稍后再试。");
    const payload = await response.json();
    if (Number(payload?.base_resp?.status_code ?? 0) !== 0 || Number(payload?.data?.status ?? 2) !== 2) {
      throw generationError(payload);
    }
    return {
      audio: decodeAudio(payload?.data?.audio),
      mimeType: "audio/mpeg",
      provider: "MiniMax",
      model: speech.model,
      voiceId: speech.voiceId,
      durationMs: Number(payload?.extra_info?.audio_length) || null
    };
  } finally {
    timeout.clear();
  }
}

module.exports = { synthesizeSpeech, decodeAudio, generationError };
