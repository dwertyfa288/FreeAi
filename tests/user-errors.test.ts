import { expect, it } from "vitest";
import { MaintenanceModeError, toUserFacingError } from "../src/user-errors.js";

it("shows a dedicated maintenance message", () => {
  expect(toUserFacingError(new MaintenanceModeError()).message).toBe("Сейчас технические работы. Повторите попытку позже");
});

it("hides every other technical error", () => {
  const error = toUserFacingError(new Error("FreeAI: NO_PROVIDER_AVAILABLE (secret details)"));
  expect(error.message).toBe("Произошла ошибка. Повторите запрос");
  expect(error.message).not.toContain("NO_PROVIDER_AVAILABLE");
});
