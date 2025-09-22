# Agent API Flow (Next.js)

## Overview
The `/api/agent` Next.js route provides a simple HTTP interface for generating responses via OpenAI using the Vercel AI SDK, while `/api/agent-tools` exposes metadata describing the available Convex-backed tools.

## Endpoints
### `GET /api/agent-tools`
- Returns `{ tools: Array<AgentToolMetadata> }` from `@repo/types/agentToolsMetadata`.
- Useful for UI components that display tooltips or documentation about what the agent can do.

### `POST /api/agent`
- Request body:
  ```json
  {
    "messages": [
      { "role": "system", "content": "..." },
      { "role": "user", "content": "..." }
    ]
  }
  ```
- Response body:
  ```json
  {
    "text": "...",
    "usage": { "totalTokens": 123, ... },
    "finishReason": "stop"
  }
  ```
- Uses `generateText` from `ai` with the OpenAI chat model (`process.env.OPENAI_CHAT_MODEL` or `gpt-4o-mini`).

## Environment Variables
- `OPENAI_API_KEY` – required by `@ai-sdk/openai`.
- `OPENAI_CHAT_MODEL` (optional) – override the default chat model used in the API route.

## Tool Metadata Source
- Defined in `packages/types/src/agentToolsMetadata.ts` and exported via `@repo/types`.
- Keeps API responses consistent with backend tooling.

## Notes
- The API route is intentionally lightweight: it does not call Convex directly but serves as a thin wrapper around OpenAI. Convex tools remain accessible through backend actions (`api.agent.action.sendMessage`, etc.).
- Clients needing deeper integration can consume `agentToolsMetadata` and call Convex actions directly as needed.
