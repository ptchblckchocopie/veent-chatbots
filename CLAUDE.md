# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dual-app monorepo for Veent AI chatbot widgets powered by Dify (RAG) + Groq LLM. Each app is an independent SvelteKit project (no shared workspaces).

- **buyer-bot** — Ticket buyer support chatbot (production port 80)
- **organizer-bot** — Event organizer dashboard assistant (production port 3001)

The buyer-bot landing page uses the **Dify embed widget** (`udify.app/embed.min.js`) instead of the custom FloatingAiAssistant component. The organizer page is a placeholder for a friend's organizer bot.

## Build & Dev Commands

Each app is independent — always `cd` into the app directory first:

```bash
cd buyer-bot   # or cd organizer-bot
npm install
npm run dev      # Vite dev server with HMR
npm run build    # Production build (outputs to /build)
npm run preview  # Preview production build locally
```

### Knowledge Base Scripts (buyer-bot only)

```bash
npm run baseline:capture   # Capture 10 baseline Dify API responses
npm run baseline:compare   # Compare current responses against saved baseline
npm run analyze            # Keyword audit of markdown documents
npm run split              # Split markdown into topic-focused sub-documents (<5K chars)
npm run upload             # Upload documents to Dify with regression tests
npm run validate           # Full validation (direct API + live proxy)
```

Organizer-bot has `baseline:capture`, `baseline:compare`, and `validate` only.

## Architecture

```
buyer-bot:
  Landing Page (/)          → Dify embed widget (udify.app/embed.min.js)
                            → Dify Cloud handles chat directly (no server proxy needed)
  Organizer Page (/organizer) → Dify embed widget (separate token, TBD)

organizer-bot:
  Landing Page (/)          → FloatingAiAssistant.svelte (custom chat widget)
                            → /api/chat/+server.ts (SSE proxy) → Dify Cloud API
```

- **Frontend**: Svelte 5, Tailwind CSS v4
- **Server**: SvelteKit with `@sveltejs/adapter-node` (Docker-ready)
- **AI Backend**: Dify Cloud API with Hybrid Search retrieval (Keyword 0.7 / Semantic 0.3, Top K=5), Groq Llama-3.1-8b-instant
- **Embedding**: gemini-embedding-001 (High Quality)
- **Deployment**: Docker multi-stage builds on Node 20 Alpine

## Key Source Locations

Buyer-bot:
- `src/routes/+page.svelte` — Landing page (veent.io-style UI, red theme, Dify buyer bot embed)
- `src/routes/organizer/+page.svelte` — Organizer page (teal theme, Dify organizer bot embed placeholder)
- `src/lib/components/ui/FloatingAiAssistant.svelte` — Custom chat widget (NOT currently used, replaced by Dify embed)
- `src/routes/api/chat/+server.ts` — Server-side Dify API proxy (NOT currently used with embed approach)
- `knowledge-base/` — 13 curated markdown docs for the Dify KB
- `scripts/` — 7 knowledge base automation scripts (.mjs)
- `baselines/` — Regression test baseline data

Organizer-bot:
- `src/routes/+page.svelte` — Landing page (teal theme, uses FloatingAiAssistant custom widget)
- `src/lib/components/ui/FloatingAiAssistant.svelte` — Custom chat widget (actively used here, unlike buyer-bot)
- `src/routes/api/chat/+server.ts` — Server-side Dify API proxy (actively used)
- `knowledge-base/` — 17 markdown documents for the Dify knowledge base

## Environment Variables

Each app requires a `.env` file (see `.env.example`):
- `DIFY_API_KEY` — Dify app-specific API key (different per bot)
- `DIFY_API_URL` — Dify API base URL (default: `https://api.dify.ai/v1`)

## Docker Deployment

```bash
docker build -t veent-buyer-bot ./buyer-bot
docker run -p 80:3000 --env-file buyer-bot/.env veent-buyer-bot

docker build -t veent-organizer-bot ./organizer-bot
docker run -p 3001:3000 --env-file organizer-bot/.env veent-organizer-bot
```

Both containers expose port 3000 internally, mapped to different host ports.

## Dify Knowledge Base Notes

- Inverted Index retrieval is keyword-sensitive — documents with high-frequency generic terms (e.g., "event" appearing 40+ times) can drown out relevant results
- Documents should be kept under 5K chars; use the `split` script to break larger docs
- Top K is set to 5; increasing it has caused regression (irrelevant chunks returned)
- Baseline regression testing (`baseline:capture` → `baseline:compare`) should be run before and after KB changes
- Dify's inverted index tokenizer does NOT index certain proper nouns (e.g., "Misalucha"). Workaround: create small focused documents (like `concert-events.md`) with high keyword density so semantic search matches them

## Dify Embed Widget

The buyer-bot uses the Dify embed widget instead of the custom FloatingAiAssistant:
```html
<script>
  window.difyChatbotConfig = { token: 'wHjfix4x8U53nv9u' };
</script>
<script src="https://udify.app/embed.min.js" id="wHjfix4x8U53nv9u" defer></script>
```

**Key requirements:**
- `window.difyChatbotConfig` must be set BEFORE the embed script loads
- The `<script>` tag `id` must match the token
- The embed script reads `window.difyChatbotConfig` synchronously on load — if the config isn't set yet, the bubble won't appear

## Dify Config (Buyer Bot)

- App: "Veent Tix Buyer Bot" (chatflow)
- App ID: `c710893f-eff7-4c63-8b03-d20f5040a029`
- KB ID: `15e17bd7-e876-4b0c-95d8-316ed3d5db12`
- Embed Token: `wHjfix4x8U53nv9u`
- LLM: Groq Llama-3.1-8b-instant (free tier, 6000 TPM limit)
- Retrieval: High Quality, Hybrid Search (Keyword 0.7 / Semantic 0.3), Top K=5
- Embedding: gemini-embedding-001
- Anti-hallucination rules in system prompt (only use event data from context, never invent)

## History

KB was built by crawling 106 events from veent.io → organized into 13 docs. Retrieval was tuned (High Quality embedding, Hybrid Search Keyword 0.7 / Semantic 0.3, Top K reduced from 8→5). Anti-hallucination rules added to Dify system prompt. Landing pages created with veent.io-style UI.

## TODO / Known Issues

1. **Dify embed bubble not appearing** — The embed script (`udify.app/embed.min.js`) loads (200 OK) but doesn't render the chat bubble. Root cause: the script reads `window.difyChatbotConfig` synchronously at parse time, but SvelteKit's `onMount` sets the config after hydration. Fix needed: set `difyChatbotConfig` in a synchronous `<script>` tag in `<svelte:head>` or in `app.html` BEFORE the embed script loads.
2. **Organizer bot token placeholder** — `src/routes/organizer/+page.svelte` line 9 has `token: 'ORGANIZER_BOT_TOKEN_HERE'` — needs the actual Dify embed token from the friend's organizer bot
3. **SvelteKit client-side navigation cleanup** — When navigating between `/` and `/organizer`, the Dify embed script from one page persists and conflicts with the other. May need to clean up the old script/bubble on route change, or use separate `<iframe>` approach
