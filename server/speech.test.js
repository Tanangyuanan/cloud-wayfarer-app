"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { synthesizeSpeech, decodeAudio, generationError } = require("./speech");

test("MiniMax 来信女声使用当前 T2A HTTP 请求格式", async () => {
  const audio = Buffer.alloc(256, 11);
  let request = null;
  const result = await synthesizeSpeech({
    text: "见字如面。今天想从山与水的关系讲起。",
    config: {
      speech: {
        configured: true,
        baseUrl: "https://api.minimaxi.com",
        apiKey: "test-secret",
        model: "speech-2.8-hd",
        voiceId: "Chinese (Mandarin)_News_Anchor",
        emotion: "calm",
        speed: 0.92,
        timeoutMs: 1000
      }
    },
    fetchImpl: async (url, options) => {
      request = { url, ...options, body: JSON.parse(options.body) };
      return {
        ok: true,
        async json() {
          return {
            data: { audio: audio.toString("hex"), status: 2 },
            extra_info: { audio_length: 3200 },
            base_resp: { status_code: 0, status_msg: "success" }
          };
        }
      };
    }
  });
  assert.equal(request.url, "https://api.minimaxi.com/v1/t2a_v2");
  assert.equal(request.headers.authorization, "Bearer test-secret");
  assert.equal(request.body.model, "speech-2.8-hd");
  assert.equal(request.body.voice_setting.voice_id, "Chinese (Mandarin)_News_Anchor");
  assert.equal(request.body.voice_setting.speed, 0.92);
  assert.equal(request.body.voice_setting.emotion, "calm");
  assert.equal(request.body.language_boost, "Chinese");
  assert.equal(result.audio.length, 256);
  assert.equal(result.durationMs, 3200);
  assert.equal(result.voiceId, "Chinese (Mandarin)_News_Anchor");
});

test("语音解码拒绝空内容和异常十六进制", () => {
  assert.throws(() => decodeAudio(""), /speech_audio_invalid/);
  assert.throws(() => decodeAudio("not-hex"), /speech_audio_invalid/);
});

test("MiniMax 余额不足时返回明确的语音额度错误", () => {
  const error = generationError({ base_resp: { status_code: 1008, status_msg: "insufficient balance" } });
  assert.equal(error.code, "speech_quota_exhausted");
  assert.match(error.publicMessage, /额度/);
});
