import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface PluginState {
  selectedModelId: string;
}

export class PluginStateStore {
  constructor(private readonly path: string) {}

  async load(): Promise<PluginState> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as Record<string, unknown>;
      return { selectedModelId: typeof parsed.selectedModelId === "string" ? parsed.selectedModelId : "" };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { selectedModelId: "" };
      throw new Error("FreeAI state is invalid");
    }
  }

  async selectModel(selectedModelId: string): Promise<void> {
    if (!selectedModelId.trim()) throw new Error("Model id is required");
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp-${process.pid}-${randomUUID()}`;
    try {
      await writeFile(temporaryPath, JSON.stringify({ selectedModelId }), { encoding: "utf8", mode: 0o600 });
      await rename(temporaryPath, this.path);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}
