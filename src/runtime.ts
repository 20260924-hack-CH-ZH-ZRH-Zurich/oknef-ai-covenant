import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Config } from "./config.js";
import { localeAdapter, supportedLocales, type Locale } from "./locales.js";
import { agentRoles } from "./catalog.js";

export { agentRoles } from "./catalog.js";

export function agentAlias(role: keyof typeof agentRoles, locale: Locale): string {
  return `${role}${localeAdapter(locale).suffix}`;
}

export function adapterCredential(config: Config): string {
  return createHash("sha256").update(`oknef-provider-adapter:${config.token}`).digest("hex");
}

export async function prepareRuntime(config: Config) {
  await mkdir(config.stateDir, { recursive: true, mode: 0o700 });
  const workspace = resolve(config.stateDir, "workspace");
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const roles = Object.keys(agentRoles) as (keyof typeof agentRoles)[];
  const entries = Object.fromEntries(supportedLocales.flatMap(locale => roles.map(role => [agentAlias(role, locale), {
    name: `Oknef ${role} (${locale})`, workspace,
    model: `oknef-core${localeAdapter(locale).suffix}/${config.model}`, skills: [],
  }])));
  const providers = Object.fromEntries(supportedLocales.map(locale => [`oknef-core${localeAdapter(locale).suffix}`, {
    baseUrl: `http://127.0.0.1:${config.port}${localeAdapter(locale).path}`, api: "openai-completions",
    apiKey: "${OPENCLAW_ADAPTER_TOKEN}", models: [{ id: config.model, name: "Oknef controlled core", input: ["text"], contextWindow: 16000, maxTokens: 4096 }],
  }]));
  const value = {
    gateway: {
      mode: "local", bind: "loopback", port: config.gatewayPort,
      auth: { mode: "token", token: "${OPENCLAW_GATEWAY_TOKEN}" },
      http: { endpoints: { chatCompletions: { enabled: true } } },
    },
    agents: {
      defaults: {
        workspace, skipBootstrap: true, contextInjection: "never", skills: [],
        model: { primary: `oknef-core/${config.model}`, fallbacks: [] },
        heartbeat: { every: "0m" }, maxConcurrent: 3,
      },
      entries,
    },
    tools: { profile: "minimal", deny: ["*"], elevated: { enabled: false } },
    models: {
      mode: "replace", providers,
    },
    plugins: { enabled: false },
  };
  const path = resolve(config.stateDir, "openclaw.json");
  await writeFile(path, JSON.stringify(value, null, 2), { mode: 0o600 });
  return path;
}

export function gatewayEnvironment(config: Config, configPath: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH, HOME: config.stateDir, NODE_ENV: "production",
    OPENCLAW_STATE_DIR: config.stateDir, OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_GATEWAY_TOKEN: config.token, OPENCLAW_ADAPTER_TOKEN: adapterCredential(config),
    OPENCLAW_NO_TELEMETRY: "1", OPENCLAW_DISABLE_BONJOUR: "1",
  };
}

export function startGateway(config: Config, configPath: string): ChildProcess {
  const executable = resolve("node_modules/openclaw/openclaw.mjs");
  const child = spawn(process.execPath, [executable, "gateway", "run"], {
    env: gatewayEnvironment(config, configPath), stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr?.on("data", () => { /* Provider and user content must not enter service logs. */ });
  return child;
}
