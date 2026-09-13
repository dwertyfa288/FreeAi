import { ModelPicker } from "./model-picker";

interface AstraBridge {
  callBackend(method: string, params: Record<string, unknown>): Promise<unknown>;
}

interface UiState {
  selectedModelId: string;
  models: Array<{ id: string; name: string }>;
  connected: boolean;
  lastRoute: { providerName: string; modelId: string; substituted: boolean } | null;
  lastError: string;
}

declare global {
  interface Window {
    astra?: AstraBridge;
  }
}

function getElements() {
  return {
    status: document.querySelector<HTMLElement>("#status")!,
    availability: document.querySelector<HTMLElement>("#availability")!,
    route: document.querySelector<HTMLElement>("#route")!,
    error: document.querySelector<HTMLElement>("#error")!,
    toast: document.querySelector<HTMLElement>("#toast")!,
  };
}

async function call(method: string, params: Record<string, unknown> = {}): Promise<UiState> {
  const bridge = window.astra;
  if (!bridge || typeof bridge.callBackend !== 'function') {
    throw new Error('Мост Astra не загрузился. Перезапустите плагин.');
  }
  return bridge.callBackend(method, params) as Promise<UiState>;
}

let toastTimer = 0;
let modelPicker: ModelPicker;

function showToast(message: string, bad = false) {
  const { toast } = getElements();
  toast.textContent = message;
  toast.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function render(state: UiState): void {
  const { status, availability, route, error } = getElements();
  status.textContent = state.connected ? "Онлайн" : "Нет связи";
  status.className = state.connected ? "badge ok" : "badge";
  modelPicker.setModels(state.models, state.selectedModelId);
  availability.textContent = state.models.length ? "Список обновляется автоматически" : "Доступных моделей нет";
  route.textContent = state.lastRoute
    ? state.models.find((model) => model.id === state.lastRoute?.modelId)?.name ?? state.lastRoute.modelId
    : "Пока нет завершённых запросов";
  error.textContent = state.lastError;
}

async function run(method: string, params: Record<string, unknown> = {}, successMessage?: string): Promise<void> {
  const { error } = getElements();
  error.textContent = "";
  try {
    render(await call(method, params));
    if (successMessage) showToast(successMessage);
  } catch (failure) {
    const msg = failure instanceof Error ? failure.message : "Ошибка";
    error.textContent = msg;
    showToast(msg, true);
  }
}

function init() {
  modelPicker = new ModelPicker(document.querySelector<HTMLElement>("#model-picker")!);
  document.querySelector("#refresh")!.addEventListener("click", () => { void run("refreshModels", {}, "Модели обновлены"); });
  document.querySelector("#save")!.addEventListener("click", () => {
    if (!modelPicker.value) return;
    void run("selectModel", { modelId: modelPicker.value }, `Выбрана модель: ${modelPicker.selectedName}`);
  });
  document.querySelector("#test")!.addEventListener("click", () => { void run("testConnection", {}, "Сервер доступен"); });
  void run("getState").then(() => { void run("refreshModels"); });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export {};
