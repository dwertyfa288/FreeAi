const maintenanceMessage = "Сейчас технические работы. Повторите попытку позже";
const genericErrorMessage = "Произошла ошибка. Повторите запрос";
const modelUnavailablePattern = /MODEL_UNAVAILABLE|Модель .* недоступна/i;

export class MaintenanceModeError extends Error {
  constructor() {
    super(maintenanceMessage);
    this.name = "MaintenanceModeError";
  }
}

export function toUserFacingError(error: unknown): Error {
  if (error instanceof MaintenanceModeError) return new Error(maintenanceMessage);
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (modelUnavailablePattern.test(raw)) return new Error("Модель недоступна. Выберите другую модель.");
  return new Error(genericErrorMessage);
}
