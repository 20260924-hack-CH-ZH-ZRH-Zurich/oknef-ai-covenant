# Oknef covenant

The Node/TypeScript service runs OpenClaw 2026.9.6 with five domain agent profiles
and a controlled provider adapter. OpenClaw calls the adapter; only the adapter
calls Rust core. Configure internal service tokens in `.env`.

## Setup

Use Node 24.21 or newer in the supported 24.x release line. Run `npm ci`, copy
`.env.example` to `.env`, set internal endpoints/tokens, then run `npm run dev`.
The service rejects provider API keys in its environment. Its OpenClaw child
receives only gateway/adapter credentials and isolated runtime paths.

```sh
npm run build
npm test
npm run start
```

`GET /health` becomes ready after OpenClaw's authenticated model catalogue is
reachable. `POST /v1/workflows` accepts a bounded message, locale and either
`legacy-review` or `identity-review`. Two agents review in parallel and a verifier
reviews their output. The response always requires human review and records an
empty executed-actions list. All operating-system and external-action tools are
disabled. Workspace bootstrap is disabled to avoid generating operating manuals.

Docker Compose is for local development; deployment uses Azure Container Apps.
Use the service's own repository as its image build context.
