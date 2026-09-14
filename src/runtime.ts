import { join } from "node:path";
import type { AiChunk, AiCompleteRequest } from "astra-plugin-sdk";
import { completeForAstra } from "./ai-bridge.js";
import { addAutomaticModel, automaticModelId } from "./automatic-model.js";
import { loadDeployment } from "./deployment.js";
import { RouterClient } from "./router-client.js";
import { PluginStateStore } from "./state.js";
import type { PublicModel, RouterEvent } from "./types.js";
import { toUserFacingError } from "./user-errors.js";

export interface RuntimePublicState {
  selectedModelId: string;
  models: Array<Pick<PublicModel, "id" | "name">>;
  connected: boolean;
  lastRoute: Extract<RouterEvent, { type: "route" }> | null;
  lastError: string;
}

const modelSyncIntervalMs = 300_000;

export class FreeAiRuntime {
  private readonly client: RouterClient;
  private readonly state: PluginStateStore;
  private readonly activeRequests = new Set<AbortController>();
  private models: PublicModel[] = [];
  private lastRoute: Extract<RouterEvent, { type: "route" }> | null = null;
  private lastError = "";
  private modelSyncTimer: NodeJS.Timeout | undefined;
  private modelSyncRunning = false;

  constructor(pluginDirectory: string) {
    const deployment = loadDeployment(pluginDirectory);
    this.client = new RouterClient(deployment.serverUrl, deployment.pluginToken);
    this.state = new PluginStateStore(join(pluginDirectory, "freeai-state.json"));
  }

  async *complete(request: AiCompleteRequest): AsyncIterable<AiChunk | string> {
    const controller = new AbortController();
    this.activeRequests.add(controller);
    try {
      yield* completeForAstra(request, {
        selectedModel: async () => (await this.state.load()).selectedModelId,
        complete: (payload, signal) => this.client.complete(payload, signal),
        onRoute: (route) => { this.lastRoute = route; },
        signal: controller.signal,
      });
      this.lastError = "";
    } catch (error) {
      const userError = toUserFacingError(error);
      this.lastError = userError.message;
      throw userError;
    } finally {
      this.activeRequests.delete(controller);
    }
  }

  async refreshModels(): Promise<RuntimePublicState> {
    this.models = addAutomaticModel(await this.client.listModels());
    const state = await this.state.load();
    if (this.models.length > 0 && !this.models.some((model) => model.id === state.selectedModelId)) {
      await this.state.selectModel(automaticModelId);
    }
    this.lastError = "";
    return this.publicState();
  }

  startModelSync(): void {
    if (this.modelSyncTimer) return;
    this.synchronizeModels();
    this.modelSyncTimer = setInterval(() => this.synchronizeModels(), modelSyncIntervalMs);
    this.modelSyncTimer.unref();
  }

  async selectModel(modelId: string): Promise<RuntimePublicState> {
    if (this.models.length === 0) await this.refreshModels();
    if (!this.models.some((model) => model.id === modelId)) throw new Error("Модель недоступна");
    await this.state.selectModel(modelId);
    return this.publicState();
  }

  async testConnection(): Promise<RuntimePublicState> {
    try {
      await this.refreshModels();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : "Сервер недоступен";
    }
    return this.publicState();
  }

  async publicState(): Promise<RuntimePublicState> {
    const selected = await this.state.load();
    return {
      selectedModelId: selected.selectedModelId,
      models: this.models.map(({ id, name }) => ({ id, name })),
      connected: this.models.length > 0 && !this.lastError,
      lastRoute: this.lastRoute,
      lastError: this.lastError,
    };
  }

  shutdown(): void {
    if (this.modelSyncTimer) clearInterval(this.modelSyncTimer);
    this.modelSyncTimer = undefined;
    for (const controller of this.activeRequests) controller.abort();
    this.activeRequests.clear();
  }

  private synchronizeModels(): void {
    if (this.modelSyncRunning) return;
    this.modelSyncRunning = true;
    void this.refreshModels()
      .catch((error) => {
        this.lastError = error instanceof Error ? error.message : "Сервер недоступен";
      })
      .finally(() => {
        this.modelSyncRunning = false;
      });
  }
}
