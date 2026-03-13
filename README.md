# Veent Chatbots

Monorepo containing AI chatbot widgets for [Veent Tix](https://veent.io) — SvelteKit apps powered by [Dify](https://dify.ai) + Groq.

## Projects

| Directory | Purpose | Port | Target Users |
|---|---|---|---|
| `buyer-bot/` | Ticket buyer support chatbot | 80 | Event attendees / buyers |
| `organizer-bot/` | Organizer dashboard assistant | 3001 | Event organizers |

## Setup

Each project is independently buildable:

```bash
cd buyer-bot   # or organizer-bot
cp .env.example .env   # fill in your Dify API key
npm install
npm run dev
```

## Deployment

Each project has its own `Dockerfile`. Build and run independently:

```bash
docker build -t veent-buyer-bot ./buyer-bot
docker run -p 80:3000 --env-file buyer-bot/.env veent-buyer-bot

docker build -t veent-organizer-bot ./organizer-bot
docker run -p 3001:3000 --env-file organizer-bot/.env veent-organizer-bot
```

## Architecture

Both bots share the same architecture:

```
User → SvelteKit (DO Droplet) → Dify Cloud API → Groq (Llama-3.1-8b-instant)
```

- **Frontend**: Svelte 5 floating chat widget with SSE streaming
- **Backend**: SvelteKit server route proxying to Dify API
- **LLM**: Groq via Dify Cloud (free tier)
- **Knowledge**: Separate Dify knowledge bases per bot (no cross-pollution)
- **Deployment**: Docker on Digital Ocean
