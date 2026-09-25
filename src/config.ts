import { resolve } from "node:path";

export type Config = ReturnType<typeof readConfig>;
export function readConfig() {
  function required(name: string) {
    const value = process.env[name];
    if (!value) throw new Error(`Missing ${name}`);
    return value;
  }
  const port = Number(required("PORT"));
  const gatewayPort = Number(required("OPENCLAW_GATEWAY_PORT"));
  if (![port, gatewayPort].every(value => Number.isInteger(value) && value > 1024 && value < 65536)) {
    throw new Error("Invalid service ports");
  }
  const core = new URL(required("CORE_BASE_URL"));
  if (!["http:", "https:"].includes(core.protocol) || core.username || core.password || core.search) {
    throw new Error("Invalid core origin");
  }
  for (const name of ["OPENAI_API_KEY", "AZURE_OPENAI_API_KEY"]) {
    if (process.env[name]) throw new Error("Provider credentials are forbidden in covenant");
  }
  return {
    port, gatewayPort, core: core.origin,
    coreToken: required("AI_CORE_TOKEN"), token: required("COVENANT_TOKEN"),
    stateDir: resolve(required("OPENCLAW_STATE_DIR")),
    model: required("AI_REASONING_MODEL"),
    timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS ?? "120000"),
  };
}
