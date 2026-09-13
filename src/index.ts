import { plugin, UiContrib } from "astra-plugin-sdk";
import { FreeAiRuntime } from "./runtime.js";

const pluginDirectory = process.env.ASTRA_PLUGIN_DIR || process.cwd();
let runtime: FreeAiRuntime | undefined;

function getRuntime(): FreeAiRuntime {
  if (!runtime) {
    runtime = new FreeAiRuntime(pluginDirectory);
    runtime.startModelSync();
  }
  return runtime;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export const app = plugin({
  id: "dwertyfa-free-ai",
  ai: {
    complete: (request) => getRuntime().complete(request),
  },
  ui: {
    contributions: [
      {
        ...UiContrib.page("freeai-settings", "FreeAI", "index.html", {
          iconSvg: '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 3h13v4h-9v4h8v4h-8v6H6z"/></svg>',
        }),
        transparent: true,
      },
    ],
    onCall: {
      getState: () => getRuntime().publicState(),
      refreshModels: () => getRuntime().refreshModels(),
      selectModel: (params) => getRuntime().selectModel(String(record(params).modelId ?? "")),
      testConnection: () => getRuntime().testConnection(),
    },
  },
  onShutdown: () => getRuntime().shutdown(),
  healthCheck: async () => {
    try {
      const state = await getRuntime().publicState();
      return { healthy: true, status: state.connected ? `FreeAI connected: ${state.selectedModelId || "model not selected"}` : "FreeAI configured; open plugin settings" };
    } catch (error) {
      return { healthy: false, status: error instanceof Error ? error.message : "FreeAI configuration error" };
    }
  },
});

if (require.main === module) app.run();
