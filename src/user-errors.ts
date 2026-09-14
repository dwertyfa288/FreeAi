const maintenanceMessage = "Сейчас технические работы. Повторите попытку позже";
const genericErrorMessage = "Произошла ошибка. Повторите запрос";

export class MaintenanceModeError extends Error {
  constructor() {
    super(maintenanceMessage);
    this.name = "MaintenanceModeError";
  }
}

export function toUserFacingError(error: unknown): Error {
  return error instanceof MaintenanceModeError
    ? new Error(maintenanceMessage)
    : new Error(genericErrorMessage);
}
