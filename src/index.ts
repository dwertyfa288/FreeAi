import { plugin, s, tool, UiContrib } from "astra-plugin-sdk";
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

function firstResultUrl(assets: Array<{ url?: string; base64?: string }>): string {
  for (const asset of assets) {
    if (asset.url) return asset.url;
    if (asset.base64) return `data:image/png;base64,${asset.base64}`;
  }
  return "";
}

export const app = plugin({
  id: "dwertyfa-free-ai",
  ai: {
    complete: (request) => getRuntime().complete(request),
  },
  tools: {
    freeai_generate_image: tool({
      description: "Сгенерировать изображение по запросу пользователя и вернуть его URL или data URI. Вызывай, когда пользователь просит картинку, иллюстрацию или изображение.",
      input: s.object({
        prompt: s.string().optional().describe("Точное описание изображения, которое нужно сгенерировать"),
        size: s.string().optional().describe("Размер изображения, например 1024x1024"),
        n: s.integer().optional().describe("Количество изображений (1-4)"),
      }),
      run: async ({ prompt, size, n }) => {
        try {
          const result = await getRuntime().generate("image", { prompt: prompt?.trim() || "", size, n });
          const url = firstResultUrl(result.assets);
          if (!url) return { success: false, error: "Сервер не вернул изображение" };
          return { success: true, result: url };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Ошибка генерации изображения" };
        }
      },
    }),
    freeai_generate_video: tool({
      description: "Сгенерировать видео по запросу пользователя и вернуть его URL. Вызывай, когда пользователь просит видеоролик, анимацию или видео.",
      input: s.object({
        prompt: s.string().optional().describe("Точное описание видео, которое нужно сгенерировать"),
        durationSeconds: s.integer().optional().describe("Длительность видео в секундах"),
        size: s.string().optional().describe("Разрешение видео, например 1280x720"),
      }),
      run: async ({ prompt, durationSeconds, size }) => {
        try {
          const result = await getRuntime().generate("video", { prompt: prompt?.trim() || "", durationSeconds, size });
          const url = firstResultUrl(result.assets);
          if (!url) return { success: false, error: "Сервер не вернул видео" };
          return { success: true, result: url };
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : "Ошибка генерации видео" };
        }
      },
    }),
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
      selectImageModel: (params) => getRuntime().selectImageModel(String(record(params).modelId ?? "")),
      selectVideoModel: (params) => getRuntime().selectVideoModel(String(record(params).modelId ?? "")),
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

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

if (require.main === module) app.run();
