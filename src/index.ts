import Fastify from "fastify";
import { readConfig } from "./config.js";
import { registerBridge } from "./bridge.js";
import { adapterCredential, prepareRuntime, startGateway } from "./runtime.js";
import { registerWorkflows } from "./workflows.js";

const config = readConfig();
const app = Fastify({
  bodyLimit: 64 * 1024, disableRequestLogging: true,
  logger: { level: "warn", redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie", "password", "token", "api_key", "secret"] },
});
let ready = false;
app.addHook("onSend", async (_request, reply) => { reply.header("cache-control", "no-store"); });
app.get("/health", async (_request, reply) => reply.code(ready ? 200 : 503).send({ status: ready ? "ready" : "starting", service: "oknef-ai-covenant" }));
registerBridge(app, config, adapterCredential(config));
registerWorkflows(app, config);
await app.listen({ port: config.port, host: "0.0.0.0" });
const path = await prepareRuntime(config);
const child = startGateway(config, path);
child.on("exit", () => { ready = false; });
const probe = setInterval(async () => {
  try {
    const response = await fetch(`http://127.0.0.1:${config.gatewayPort}/v1/models`, {
      headers: { authorization: `Bearer ${config.token}` }, signal: AbortSignal.timeout(3000),
    });
    ready = response.ok;
  } catch { ready = false; }
}, 3000);
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => {
  clearInterval(probe); child.kill("SIGTERM"); await app.close(); process.exit(0);
});
