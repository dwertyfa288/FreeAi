import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface DeploymentConfig {
  serverUrl: string;
  pluginToken: string;
}

declare const __FREEAI_SERVER_URL__: string | undefined;
declare const __FREEAI_PLUGIN_TOKEN__: string | undefined;

function isLoopback(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function loadDeployment(pluginDirectory: string): DeploymentConfig {
  if (typeof __FREEAI_SERVER_URL__ !== "undefined" && typeof __FREEAI_PLUGIN_TOKEN__ !== "undefined"
    && __FREEAI_SERVER_URL__ && __FREEAI_PLUGIN_TOKEN__) {
    return validateDeployment({ serverUrl: __FREEAI_SERVER_URL__, pluginToken: __FREEAI_PLUGIN_TOKEN__ });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(pluginDirectory, "deployment.json"), "utf8"));
  } catch {
    throw new Error("FreeAI deployment.json is missing or invalid");
  }
  return validateDeployment(parsed);
}

function validateDeployment(parsed: unknown): DeploymentConfig {
  if (!parsed || typeof parsed !== "object") throw new Error("FreeAI deployment.json is invalid");
  const value = parsed as Record<string, unknown>;
  if (typeof value.serverUrl !== "string" || typeof value.pluginToken !== "string" || !value.pluginToken.trim()) {
    throw new Error("FreeAI deployment.json is invalid");
  }
  let url: URL;
  try {
    url = new URL(value.serverUrl);
  } catch {
    throw new Error("FreeAI serverUrl is invalid");
  }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback(url.hostname)))) {
    throw new Error("FreeAI serverUrl must use HTTPS");
  }
  return { serverUrl: url.origin + url.pathname.replace(/\/$/, ""), pluginToken: value.pluginToken.trim() };
}
