import type { AiChunk, AiCompleteRequest } from "astra-plugin-sdk";
import { ReasoningStreamParser, type ReasoningStreamPart } from "./reasoning-stream.js";
import type { RouterCompletionRequest, RouterEvent } from "./types.js";

export interface AiBridgeDependencies {
  selectedModel(): Promise<string>;
  complete(request: RouterCompletionRequest, signal?: AbortSignal): AsyncIterable<RouterEvent>;
  onRoute(event: Extract<RouterEvent, { type: "route" }>): void;
  signal?: AbortSignal;
}

function tools(request: AiCompleteRequest): RouterCompletionRequest["tools"] | undefined {
  if (!request.tools || request.tools.length === 0) return undefined;
  return request.tools.map((tool) => {
    let parameters: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(tool.parametersJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parameters = parsed as Record<string, unknown>;
      }
    } catch {
      parameters = {};
    }
    return { name: tool.name, description: tool.description, parameters };
  });
}

function reasoningEnabled(request: AiCompleteRequest): boolean {
  if (request.showReasoning) return true;
  return !["", "auto", "off", "none"].includes(request.reasoningEffort.trim().toLowerCase());
}

function reasoningChunk(part: ReasoningStreamPart): AiChunk {
  return part.type === "thinking" ? { thinking: part.delta } : { text: part.delta };
}

export async function* completeForAstra(request: AiCompleteRequest, dependencies: AiBridgeDependencies): AsyncIterable<AiChunk | string> {
  const selectedModel = await dependencies.selectedModel();
  if (!selectedModel) throw new Error("Выберите модель на странице плагина FreeAI");
  const showReasoning = reasoningEnabled(request);
  const reasoningParser = showReasoning ? new ReasoningStreamParser() : null;
  const payload: RouterCompletionRequest = {
    model: selectedModel,
    messages: request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content ?? null,
      toolCallId: msg.toolCallId || undefined,
      toolCalls: msg.toolCalls?.map((tc) => ({
        id: tc.id,
        name: tc.name,
        argumentsJson: tc.argumentsJson,
      })) || undefined,
    })),
    tools: tools(request),
    systemPrompt: request.systemPrompt ?? undefined,
    temperature: request.temperature ?? undefined,
    maxTokens: request.maxTokens ?? undefined,
    reasoningEffort: request.reasoningEffort ?? undefined,
    showReasoning,
  };
  for await (const event of dependencies.complete(payload, dependencies.signal)) {
    if (event.type === "route") dependencies.onRoute(event);
    if (event.type === "text") {
      if (!reasoningParser) yield { text: event.delta };
      else for (const part of reasoningParser.push(event.delta)) yield reasoningChunk(part);
    }
    if (event.type === "thinking" && showReasoning) yield { thinking: event.delta };
    if (event.type === "tool_call") yield { toolCall: event.call };
    if (event.type === "done") {
      if (reasoningParser) {
        for (const part of reasoningParser.finish()) yield reasoningChunk(part);
      }
      return;
    }
    if (event.type === "error") throw new Error(`FreeAI: ${event.code}${event.detail ? ` (${event.detail})` : ""}`);
  }
  throw new Error("FreeAI stream ended unexpectedly");
}
