export interface PublicModel {
  id: string;
  name: string;
  routeCount: number;
}

export interface RouterMessage {
  role: string;
  content: string | null;
  toolCallId?: string;
  toolCalls?: Array<{ id: string; name: string; argumentsJson: string }>;
}

export interface RouterCompletionRequest {
  model: string;
  messages: RouterMessage[];
  tools?: Array<{ name: string; description: string; parameters: Record<string, unknown> }>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  showReasoning?: boolean;
}

export type RouterEvent =
  | { type: "route"; providerName: string; modelId: string; substituted: boolean }
  | { type: "text"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_call"; call: { id: string; name: string; argumentsJson: string } }
  | { type: "done" }
  | { type: "error"; code: string; retryable: boolean; detail?: string };
