import { describe, expect, it } from "vitest";
import { hashHardwareId } from "../src/hardware-id.js";

describe("hardware id", () => {
  it("normalizes the identifier before hashing", () => {
    expect(hashHardwareId("  DEVICE-UUID  ")).toBe(hashHardwareId("device-uuid"));
  });

  it("does not expose the raw identifier", () => {
    const id = hashHardwareId("device-uuid");
    expect(id).toMatch(/^[a-f0-9]{64}$/);
    expect(id).not.toContain("device-uuid");
  });
});
