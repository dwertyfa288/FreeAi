import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DeploymentConfig {
  serverUrl: string;
  pluginToken: string;
}

declare const __PRIMEAI_SERVER_URL__: string | undefined;
declare const __PRIMEAI_PLUGIN_TOKEN__: string | undefined;

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function loadDeployment(pluginDirectory: string): DeploymentConfig {
  if (typeof __PRIMEAI_SERVER_URL__ !== "undefined" && typeof __PRIMEAI_PLUGIN_TOKEN__ !== "undefined"
    && __PRIMEAI_SERVER_URL__ && __PRIMEAI_PLUGIN_TOKEN__) {
    return validateDeployment({ serverUrl: __PRIMEAI_SERVER_URL__, pluginToken: __PRIMEAI_PLUGIN_TOKEN__ });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(pluginDirectory, "deployment.json"), "utf8"));
  } catch {
    throw new Error("PrimeAI deployment.json is missing or invalid");
  }
  return validateDeployment(parsed);
}

function validateDeployment(parsed: unknown): DeploymentConfig {
  if (!parsed || typeof parsed !== "object") throw new Error("PrimeAI deployment.json is invalid");
  const value = parsed as Record<string, unknown>;
  if (typeof value.serverUrl !== "string" || typeof value.pluginToken !== "string" || !value.pluginToken.trim()) {
    throw new Error("PrimeAI deployment.json is invalid");
  }
  let url: URL;
  try {
    url = new URL(value.serverUrl);
  } catch {
    throw new Error("PrimeAI serverUrl is invalid");
  }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname)))) {
    throw new Error("PrimeAI serverUrl must use HTTPS");
  }
  return { serverUrl: url.origin + url.pathname.replace(/\/$/, ""), pluginToken: value.pluginToken.trim() };
}
