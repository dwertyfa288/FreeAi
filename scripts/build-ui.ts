import { build } from "esbuild";

async function main(): Promise<void> {
  await build({
    entryPoints: ["ui/main.ts"],
    bundle: true,
    platform: "browser",
    format: "iife",
    outfile: "ui/app.js",
    minify: true,
  });
}

void main();
