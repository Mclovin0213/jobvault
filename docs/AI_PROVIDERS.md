# AI providers

The app has a single AI-touched endpoint: `POST /api/extract`. Given a job-posting URL, it fetches the page (with SSRF protection), strips the HTML to text, and asks a language model to return structured fields (`company`, `role`, `salary`, `location`, `workArrangement`, `source`). The UI uses the result to prefill new application rows.

The model is **bring-your-own-key**: you supply credentials via env vars, no key ships with the project.

## Wired today: MiniMax

The extract route uses the [Vercel AI SDK](https://ai-sdk.dev) with the [`vercel-minimax-ai-provider`](https://www.npmjs.com/package/vercel-minimax-ai-provider) package. To enable:

```
MINIMAX_API_KEY=your-key-here
# Optional:
# MINIMAX_MODEL=MiniMax-M2.5
# MINIMAX_BASE_URL=https://api.minimax.io/v1
```

Restart the server. The endpoint will start returning structured extractions instead of `{error: "missing_MINIMAX_API_KEY"}`.

### Graceful degradation

When the key is missing or the model errors, `/api/extract` returns a 200 with an `{error}` body. The frontend treats this as "no prefill available" and lets you fill the fields manually — no exception, no broken state.

## Roadmap: other providers

OpenAI and Anthropic are **not wired today**, by design — the scope of this OSS release is the storage and auth refactor, not the AI provider abstraction. The Vercel AI SDK makes the switch a small change in `server/routes/extract.ts`:

```ts
// Today:
import { minimax } from 'vercel-minimax-ai-provider'
const result = await generateText({ model: minimax(modelId), ... })

// To add OpenAI:
// bun add @ai-sdk/openai
import { openai } from '@ai-sdk/openai'
const result = await generateText({ model: openai('gpt-4o-mini'), ... })
```

A future PR will introduce an `AI_PROVIDER` env switch (`openai` / `anthropic` / `minimax`) and a single `AI_API_KEY`. Contributions welcome — see the `callMinimax` function in [`server/routes/extract.ts`](../server/routes/extract.ts) as the single integration point.

## Cost / safety notes

- The extract handler is rate-limited per signed-in user.
- The SSRF guard in [`server/lib/safeUrl.ts`](../server/lib/safeUrl.ts) rejects loopback, RFC1918, link-local, and IPv6 private addresses before fetching, and pins DNS during the fetch to prevent rebinding.
- The fetched HTML is capped at 1 MB and the extracted text is truncated to 15,000 characters before reaching the model.
