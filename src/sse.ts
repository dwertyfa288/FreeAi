import type { RouterEvent } from "./types.js";

function parseEvent(name: string, data: string): RouterEvent {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw new Error("Invalid FreeAI stream event");
  }
  if (!value || typeof value !== "object") throw new Error("Invalid FreeAI stream event");
  const event = value as Record<string, unknown>;
  if (event.type !== name) throw new Error("Invalid FreeAI stream event");
  if (name === "text" || name === "thinking") {
    if (typeof event.delta !== "string") throw new Error("Invalid FreeAI stream delta");
  } else if (name === "tool_call") {
    const call = event.call;
    if (!call || typeof call !== "object") throw new Error("Invalid FreeAI tool call");
    const toolCall = call as Record<string, unknown>;
    if (typeof toolCall.id !== "string" || typeof toolCall.name !== "string" || typeof toolCall.argumentsJson !== "string") throw new Error("Invalid FreeAI tool call");
    try {
      JSON.parse(toolCall.argumentsJson);
    } catch {
      throw new Error("Invalid FreeAI tool argumentsJson");
    }
  } else if (name === "route") {
    if (typeof event.providerName !== "string" || typeof event.modelId !== "string" || typeof event.substituted !== "boolean") throw new Error("Invalid FreeAI route event");
  } else if (name === "error") {
    if (typeof event.code !== "string" || typeof event.retryable !== "boolean") throw new Error("Invalid FreeAI error event");
  } else if (name !== "done") {
    throw new Error("Unknown FreeAI stream event");
  }
  return event as unknown as RouterEvent;
}

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncIterable<RouterEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");
    while (true) {
      const separator = buffer.indexOf("\n\n");
      if (separator < 0) break;
      const frame = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      let name = "";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) name = line.slice(6).trim();
        if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (name && data.length > 0) yield parseEvent(name, data.join("\n"));
    }
  }
  buffer += decoder.decode();
  buffer = buffer.replace(/\r\n/g, "\n");
  if (buffer.trim()) throw new Error("Incomplete FreeAI stream");
}
