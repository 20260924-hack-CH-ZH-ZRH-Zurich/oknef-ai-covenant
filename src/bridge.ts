import { randomUUID, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import { completionText } from "./format.js";
import { localeAdapter, supportedLocales } from "./locales.js";

export function authorized(header: string | undefined, token: string): boolean {
  const actual = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

type Completion = { model?: string; stream?: boolean; messages?: {role: string; content: unknown}[] };
export function completionPrompt(value: Completion): string {
  if (!Array.isArray(value.messages) || value.messages.length > 100) throw new Error("Invalid messages");
  const messages = value.messages.filter(item => item.role === "user" || item.role === "assistant");
  if (!messages.length) throw new Error("User input required");
  const text = messages.slice(-12).map(item => {
    if (typeof item.content !== "string") throw new Error("Text input required");
    return `${item.role}: ${item.content}`;
  }).join("\n");
  if (text.length > 12000) throw new Error("Conversation too large");
  return text;
}

export function registerBridge(app: FastifyInstance, config: Config, adapterToken: string) {
  for (const locale of supportedLocales) app.post(`${localeAdapter(locale).path}/chat/completions`, async (request, reply) => {
    if (!authorized(request.headers.authorization, adapterToken)) return reply.code(401).send({ error: "unauthorized" });
    let prompt: string;
    try { prompt = completionPrompt(request.body as Completion); }
    catch { return reply.code(400).send({ error: "invalid_completion" }); }
    const response = await fetch(`${config.core}/v1/chat`, {
      method: "POST", signal: AbortSignal.timeout(config.timeoutMs),
      headers: { "content-type": "application/json", authorization: `Bearer ${config.coreToken}` },
      body: JSON.stringify({ message: prompt, model: config.model, locale, history: [], context: {} }),
    });
    if (!response.ok) return reply.code(502).send({ error: "core_provider_unavailable" });
    let content: string;
    try { content = completionText(await response.json()); }
    catch { return reply.code(502).send({ error: "invalid_core_response" }); }
    const id = `chatcmpl-${randomUUID()}`;
    const common = { id, created: Math.floor(Date.now() / 1000), model: config.model };
    if ((request.body as Completion).stream) {
      reply.header("content-type", "text/event-stream").header("cache-control", "no-store");
      const event = (delta: object, finish_reason: string | null) => `data: ${JSON.stringify({ ...common, object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason }] })}\n\n`;
      return reply.send(event({ role: "assistant", content }, null) + event({}, "stop") + "data: [DONE]\n\n");
    }
    return { ...common, object: "chat.completion", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] };
  });
}
