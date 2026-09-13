import { parseSse } from "./sse.js";
import type { PublicModel, RouterCompletionRequest, RouterEvent } from "./types.js";

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class RouterClient {
  constructor(
    private readonly serverUrl: string,
    private readonly pluginToken: string,
    private readonly fetchRequest: FetchFunction = fetch,
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  private headers(): Record<string, string> {
    return { authorization: `Bearer ${this.pluginToken}` };
  }

  async listModels(signal?: AbortSignal): Promise<PublicModel[]> {
    const response = await this.fetchRequest(`${this.serverUrl}/api/plugin/models`, { headers: this.headers(), signal });
    if (!response.ok) throw new Error(`FreeAI models request failed: ${response.status}`);
    const payload = await response.json() as { models?: unknown };
    if (!Array.isArray(payload.models)) throw new Error("Invalid FreeAI models response");
    return payload.models.filter((model): model is PublicModel => {
      if (!model || typeof model !== "object") return false;
      const value = model as Record<string, unknown>;
      return typeof value.id === "string" && typeof value.name === "string" && typeof value.routeCount === "number";
    });
  }

  async *complete(request: RouterCompletionRequest, signal?: AbortSignal): AsyncIterable<RouterEvent> {
    const response = await this.fetchRequest(`${this.serverUrl}/api/plugin/chat/completions`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json", accept: "text/event-stream" },
      body: JSON.stringify(request),
      signal,
    });
    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch {}
      throw new Error(`FreeAI completion request failed: ${response.status} ${errorBody}`);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
      throw new Error("FreeAI server returned an invalid stream");
    }
    yield* parseSse(response.body);
  }
}
