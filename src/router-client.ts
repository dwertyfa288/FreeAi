import { parseSse } from "./sse.js";
import type { GenerationKind, GenerationResult, ModelTestResult, PublicModel, RouterCompletionRequest, RouterEvent } from "./types.js";
import { MaintenanceModeError } from "./user-errors.js";

type FetchFunction = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const validKinds = new Set<string>(["text", "image", "video"]);

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
      return typeof value.id === "string" && typeof value.name === "string" && typeof value.routeCount === "number"
        && (typeof value.kind !== "string" || validKinds.has(value.kind));
    });
  }

  async generate(kind: GenerationKind, input: { prompt: string; model?: string; n?: number; size?: string; durationSeconds?: number }, signal?: AbortSignal): Promise<GenerationResult> {
    const response = await this.fetchRequest(`${this.serverUrl}/api/plugin/generate`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ kind, ...input }),
      signal,
    });
    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch {}
      if (response.status === 503) {
        try {
          const payload = JSON.parse(errorBody) as { code?: unknown };
          if (payload.code === "MAINTENANCE_MODE") throw new MaintenanceModeError();
        } catch (error) {
          if (error instanceof MaintenanceModeError) throw error;
        }
      }
      throw new Error(`FreeAI generation request failed: ${response.status} ${errorBody}`);
    }
    const payload = await response.json() as Partial<GenerationResult>;
    return {
      assets: Array.isArray(payload.assets) ? payload.assets : [],
      providerName: typeof payload.providerName === "string" ? payload.providerName : "",
      publicModelId: typeof payload.publicModelId === "string" ? payload.publicModelId : "",
      upstreamModelId: typeof payload.upstreamModelId === "string" ? payload.upstreamModelId : "",
      substituted: payload.substituted === true,
    };
  }

  async testModel(modelId: string, signal?: AbortSignal): Promise<ModelTestResult> {
    const response = await this.fetchRequest(`${this.serverUrl}/api/plugin/test`, {
      method: "POST",
      headers: { ...this.headers(), "content-type": "application/json" },
      body: JSON.stringify({ model: modelId }),
      signal,
    });
    if (!response.ok) {
      let errorBody = "";
      try { errorBody = await response.text(); } catch {}
      if (response.status === 503) {
        try {
          const payload = JSON.parse(errorBody) as { code?: unknown };
          if (payload.code === "MAINTENANCE_MODE") throw new MaintenanceModeError();
        } catch (error) {
          if (error instanceof MaintenanceModeError) throw error;
        }
      }
      throw new Error(`FreeAI test request failed: ${response.status} ${errorBody}`);
    }
    const payload = await response.json() as Partial<ModelTestResult>;
    return {
      ok: payload.ok === true,
      latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : 0,
      modelId: typeof payload.modelId === "string" ? payload.modelId : modelId,
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
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
      if (response.status === 503) {
        try {
          const payload = JSON.parse(errorBody) as { code?: unknown };
          if (payload.code === "MAINTENANCE_MODE") throw new MaintenanceModeError();
        } catch (error) {
          if (error instanceof MaintenanceModeError) throw error;
        }
      }
      throw new Error(`FreeAI completion request failed: ${response.status} ${errorBody}`);
    }
    if (!response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
      throw new Error("FreeAI server returned an invalid stream");
    }
    yield* parseSse(response.body);
  }
}
