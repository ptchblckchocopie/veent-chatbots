# Progress Update — March 23, 2026

## What Changed

### 1. Gemini Fallback LLM Added (Dify Chatflow)

The buyer-bot Dify chatflow now has a **fallback LLM** in case the primary model hits its rate limit.

**New flow:**
```
USER INPUT -> KNOWLEDGE RETRIEVAL -> CODE -> LLM (Gemini 3.1 Flash-Lite Preview)
                                              |-- success -> ANSWER (2)
                                              |-- fail ----> LLM 2 (Llama-3.1-8b-instant) -> ANSWER (1)
```

- **Primary LLM**: Gemini 3.1 Flash-Lite Preview (via "veentbot" provider)
- **Fallback LLM**: Groq Llama-3.1-8b-instant (original model)
- Error handling on primary LLM set to **"Fail Branch"** so failures route to the fallback automatically
- Both LLMs share the same system prompt, context variables, and Code node outputs

### 2. Organizer Contact Info Scraped & Added to KB

Scraped organizer contact details from event pages on veent.net for all **upcoming events** (March 23, 2026 onwards). Contact info is found in the "NEED HELP? CONTACT US" section at the bottom of each event page.

**Files updated:**
- `buyer-bot/knowledge-base/events-mar-2026.md` — 5 contacts added
- `buyer-bot/knowledge-base/events-apr-2026.md` — 10 contacts added
- `buyer-bot/knowledge-base/events-may-aug-2026.md` — 4 contacts added

**Contact format:**
```
  Organizer Contact: [Name] -- Phone: [number]
  Organizer Contact: [Name] -- Email: [email]
  Organizer Contact: [Name] -- Facebook: [url]
```

Events where the organizer hasn't provided contact info on the page are left without the line. The Dify system prompt instructs the bot to say "the organizer has not provided contact information yet" for those.

### 3. Seven New Events Added to KB

Cross-checked veent.io/discover and found 7 events missing from the KB. Added them:

| Event | Date | File |
|-------|------|------|
| CORAL PROPAGATION WORKSHOP | Mar 28 | events-mar-2026.md |
| The Daytime Collective presents: F1 Socials | Mar 29 | events-mar-2026.md |
| FIREBALL RUN 2026 | Apr 11 | events-apr-2026.md |
| The Shady Brunch - POPSTAR PUKSAAN | Apr 12 | events-apr-2026.md |
| The Feast North Luzon Grand Feast | May 9 | events-may-aug-2026.md |
| TARA DAGAN TA SA AGUSAN DEL SUR | May 23 | events-may-aug-2026.md |
| Seven Seas Waterpark: The First Ever Pirate Run | May 31 | events-may-aug-2026.md |

### 4. KB Retrieval Fix — Keyword Headers & Chunking

The bot was returning "I don't have information about upcoming events" because the KB retrieval wasn't matching event documents for generic queries like "Show me upcoming events."

**Root cause:** Documents were chunked into tiny 1,024-char pieces. The keyword header ("upcoming events, event listings...") was in a separate chunk from the actual event data. When retrieval matched the header chunk, it contained zero events.

**Fix applied:**
- Added keyword-dense headers to each event file (e.g., `Keywords: upcoming events, show me events, what events, event listings, event schedule...`)
- Changed Dify KB chunking delimiter from `\n\n` to `##` so each event file becomes 1-2 large chunks instead of 14-16 tiny ones
- Changed max chunk length from 1,024 to 4,000 characters
- Result: keyword header + all events are now in the same chunk

### 5. New Script: `scrape-contacts.mjs`

Added `buyer-bot/scripts/scrape-contacts.mjs` for scraping organizer contact info from event pages using Playwright.

```bash
cd buyer-bot
npm run scrape:contacts              # scrape contacts for upcoming events
npm run scrape:contacts -- --dry-run # preview without writing files
```

Note: Requires `playwright` npm package to be installed (`npm install --save-dev playwright`). Alternatively, we used the Playwriter Chrome extension (MCP) for the initial scrape.

### 6. System Prompt Updates (Dify — not in repo)

These changes were made directly in the Dify chatflow UI:
- Added rule: "When users ask about upcoming events, show AT MOST 5 events sorted from nearest date to furthest"
- Added contact info handling rules to both LLM nodes (Gemini primary + Llama fallback)

## Dify KB Settings (for reference)

| Setting | Value |
|---------|-------|
| Retrieval mode | Hybrid Search |
| Weights | Semantic 0.7 / Keyword 0.3 |
| Top K | 10 |
| Score Threshold | 0 |
| Embedding model | gemini-embedding-001 |
| Chunk delimiter | `##` |
| Max chunk length | 4,000 |

## TODO

- [ ] Run baseline capture after KB changes: `npm run baseline:capture`
- [ ] Run baseline compare to check for regressions: `npm run baseline:compare`
- [ ] Install `playwright` as dev dependency for the scrape script to work standalone
- [ ] Periodically re-scrape contacts for newly added events
- [ ] Consider adding contact scraping to the crawl pipeline
