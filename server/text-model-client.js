"use strict";

function endpoint(baseUrl, suffix) {
  return `${String(baseUrl || "").replace(/\/+$/, "")}${suffix}`;
}

function modelText(data) {
  if (Array.isArray(data?.content)) {
    return data.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
  }
  return data?.choices?.[0]?.message?.content || "";
}

function streamDelta(data) {
  if (typeof data?.choices?.[0]?.delta?.content === "string") return data.choices[0].delta.content;
  if (Array.isArray(data?.choices?.[0]?.delta?.content)) {
    return data.choices[0].delta.content.map((part) => part?.text || "").join("");
  }
  if (data?.type === "content_block_delta" && typeof data?.delta?.text === "string") return data.delta.text;
  return "";
}

async function readEventStream(response, onToken) {
  if (!response.body) throw new Error("model_stream_unavailable");
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const consume = (block) => {
    const dataText = block.split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!dataText || dataText === "[DONE]") return;
    let data;
    try { data = JSON.parse(dataText); } catch { return; }
    const delta = streamDelta(data);
    if (!delta) return;
    text += delta;
    onToken(delta);
  };

  const readChunk = (chunk) => {
    buffer += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      consume(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  };

  if (typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      readChunk(value);
    }
  } else {
    for await (const chunk of response.body) readChunk(chunk);
  }
  buffer += decoder.decode();
  if (buffer.trim()) consume(buffer);
  if (!text) throw new Error("model_empty_response");
  return text;
}

async function requestTextModel({
  config,
  fetchImpl = global.fetch,
  system,
  prompt,
  messages = [],
  maxTokens = 1200,
  json = false,
  signal,
  onToken
}) {
  if (!config?.ai?.configured) throw new Error("model_not_configured");
  const ai = config.ai;
  const openAIFormat = ai.apiFormat === "openai" || ai.provider === "deepseek";
  if (openAIFormat) {
    const response = await fetchImpl(endpoint(ai.baseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(onToken ? { accept: "text/event-stream" } : {}),
        authorization: `Bearer ${ai.apiKey}`
      },
      body: JSON.stringify({
        model: ai.model,
        max_tokens: maxTokens,
        temperature: ai.temperature ?? 0.35,
        thinking: { type: "disabled" },
        ...(onToken ? { stream: true } : {}),
        ...(json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          ...messages,
          { role: "user", content: prompt }
        ]
      }),
      signal
    });
    if (!response.ok) throw new Error(`model_http_${response.status}`);
    if (onToken) {
      const text = await readEventStream(response, onToken);
      return { text, data: null, apiFormat: "openai" };
    }
    const data = await response.json();
    const text = modelText(data);
    if (!text) throw new Error("model_empty_response");
    return { text, data, apiFormat: "openai" };
  }

  const response = await fetchImpl(endpoint(ai.baseUrl, "/v1/messages"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(onToken ? { accept: "text/event-stream" } : {}),
      "anthropic-version": "2023-06-01",
      "x-api-key": ai.apiKey
    },
    body: JSON.stringify({
      model: ai.model,
      max_tokens: maxTokens,
      temperature: ai.temperature ?? 0.25,
      ...(onToken ? { stream: true } : {}),
      system,
      messages: [...messages, { role: "user", content: prompt }]
    }),
    signal
  });
  if (!response.ok) throw new Error(`model_http_${response.status}`);
  if (onToken) {
    const text = await readEventStream(response, onToken);
    return { text, data: null, apiFormat: "anthropic" };
  }
  const data = await response.json();
  const text = modelText(data);
  if (!text) throw new Error("model_empty_response");
  return { text, data, apiFormat: "anthropic" };
}

module.exports = { requestTextModel, modelText, streamDelta, readEventStream };
