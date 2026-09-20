import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform } from "node:os";

function readCommand(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true }).trim();
  } catch {
    return "";
  }
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}

function hardwareUuid(): string {
  if (platform() === "win32") {
    const output = readCommand("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"]);
    return output.split(/\r?\n/).find((value) => value.trim() && value.trim() !== "UUID")?.trim() ?? "";
  }
  if (platform() === "linux") return readFile("/sys/class/dmi/id/product_uuid");
  if (platform() === "darwin") {
    const output = readCommand("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"]);
    return output.match(/"IOPlatformUUID" = "([^"]+)"/)?.[1] ?? "";
  }
  return "";
}

export function hashHardwareId(source: string): string {
  return createHash("sha256").update(source.trim().toLowerCase()).digest("hex");
}

export function getHardwareId(fallbackId: string): string {
  return hashHardwareId(hardwareUuid() || fallbackId);
}
