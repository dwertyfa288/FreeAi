import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const stateFile = "primeai-instance.json";
let cachedInstanceId = "";

export function getInstanceId(pluginDirectory: string): string {
  if (cachedInstanceId) return cachedInstanceId;
  const statePath = join(pluginDirectory, stateFile);
  try {
    const raw = JSON.parse(readFileSync(statePath, "utf8")) as { instanceId?: unknown };
    if (typeof raw.instanceId === "string" && raw.instanceId.length > 0) {
      cachedInstanceId = raw.instanceId;
      return cachedInstanceId;
    }
  } catch {
    // missing or invalid
  }
  cachedInstanceId = randomUUID();
  void persist(statePath, cachedInstanceId).catch(() => {});
  return cachedInstanceId;
}

async function persist(statePath: string, instanceId: string): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  const tmp = `${statePath}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(tmp, JSON.stringify({ instanceId }), { encoding: "utf8", mode: 0o600 });
  await unlink(statePath).catch(() => undefined);
  await rename(tmp, statePath);
}
