# Dify Knowledge Base Integration Plan — Senior Dev System Document

> **How to use**: When the senior dev delivers the markdown file, save it somewhere (e.g., `/tmp/dify-knowledge/senior-dev-system-doc.md`) and tell Claude: "Here's the file from our senior dev, execute the integration plan at `/home/veent-ojt/veent-dify-chat/INTEGRATION-PLAN.md`"

---

## Automation Scripts

All scripts are in `/home/veent-ojt/veent-dify-chat/scripts/`. Run from the project root.

| Script | npm alias | Purpose |
|--------|-----------|---------|
| `baseline-capture.mjs` | `npm run baseline:capture` | Phase 1: Capture 10 baseline answers from Dify API |
| `baseline-compare.mjs` | `npm run baseline:compare -- --baseline <path>` | Compare current answers against a saved baseline |
| `analyze-document.mjs` | `npm run analyze -- <file.md>` | Phase 2-4: Keyword audit, section mapping, overlap check |
| `split-document.mjs` | `npm run split -- <file.md> <report.json>` | Phase 3: Generate topic-focused sub-documents |
| `upload-and-test.mjs` | `npm run upload -- --baseline <path> --docs <dir>` | Phase 5: Upload one-at-a-time with regression tests |
| `post-validation.mjs` | `npm run validate -- --baseline <path>` | Phase 6: Full validation (API + live + proxy) |

### Quick-Start Workflow

```bash
cd /home/veent-ojt/veent-dify-chat

# 1. Capture baseline (already done: baselines/baseline-2026-03-12.json)
npm run baseline:capture

# 2. When senior dev's file arrives:
npm run analyze -- /path/to/senior-dev-system-doc.md

# 3. Review analysis, then split:
npm run split -- /path/to/senior-dev-system-doc.md baselines/analysis-senior-dev-system-doc.json

# 4. Review generated files in output/, then upload one at a time:
npm run upload -- --baseline baselines/baseline-2026-03-12.json --docs output/

# 5. After all uploads, full validation:
npm run validate -- --baseline baselines/baseline-2026-03-12.json
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DIFY_API_KEY` | App API key (for chat queries) | `app-GARtGz5zAZ5SHo3zTgxLND5N` |
| `DIFY_API_URL` | Dify API base URL | `https://api.dify.ai/v1` |
| `DIFY_DATASET_KEY` | Dataset API key (for KB uploads) | None — get from Dify → Knowledge → API Access |
| `DIFY_DATASET_ID` | Knowledge base ID | `15e17bd7-e876-4b0c-95d8-316ed3d5db12` |

> **Note**: Without `DIFY_DATASET_KEY`, the upload script runs in manual mode — it prompts you to upload via the Dify UI, then runs automated regression tests.

---

## Current State (as of March 12, 2026)

### Active Dify Documents (6 docs, ~31K chars, ~32 chunks)
| Document | Chars | Chunks | Status |
|----------|-------|--------|--------|
| about-veent-tix.md | 3,019 | 3 | Active |
| faq-and-policies.md | 4,944 | 5 | Active |
| events-march-2026-v2.md | 6,778 | 7 | Active |
| events-april-2026-v2.md | 5,910 | 6 | Active |
| events-may-aug-2026-v2.md | 2,602 | 3 | Active |
| website-navigation-guide-v2.md | 8,043 | 8 | Active |

### Disabled Documents (do NOT touch)
- complete-events-history.md — Disabled (causes keyword pollution)
- veent-tix-knowledge-full.md — Disabled
- upcoming-events.md — Disabled
- website-navigation.md — Disabled (old version, replaced by v2)

### Dify Configuration
- **Workflow**: START → KNOWLEDGE RETRIEVAL → LLM → ANSWER
- **App ID**: c710893f-eff7-4c63-8b03-d20f5040a029
- **Knowledge Base ID**: 15e17bd7-e876-4b0c-95d8-316ed3d5db12
- **LLM**: Groq Llama-3.1-8b-instant
- **Retrieval**: Inverted Index (keyword-only), Economical mode, Top K=5
- **Chunking**: General mode, 1024 max chars, 50 overlap
- **System Prompt**: Updated with step-by-step guidance instructions

### Deployment
- **Live URL**: http://143.198.87.162 (Digital Ocean Droplet)
- **SvelteKit project**: /home/veent-ojt/veent-dify-chat/
- **API Key**: app-GARtGz5zAZ5SHo3zTgxLND5N
- **API URL**: https://api.dify.ai/v1

### Playwriter Sessions
- Session 2: Dify Cloud (cloud.dify.ai)
- Reset session if stale: `npx playwriter@latest session reset 2`

---

## Known Failure Modes (DO NOT REPEAT)

1. **Keyword Pollution**: A 13K navigation guide with 97 "event" mentions drowned out actual event listings. FIX: Reduced to 7 mentions in v2.
2. **Inverted Index Flooding**: The 10K events-history doc had 106 event names, all containing "event", which dominated ALL event queries. FIX: Disabled the document.
3. **Top K Increase Backfired**: Changing Top K from 5 to 10 brought MORE irrelevant chunks, confusing the LLM into giving worse answers. FIX: Reverted to K=5.
4. **LLM Playing Safe**: When system prompt was too restrictive or context was too generic, the LLM defaulted to "visit the website" instead of step-by-step guidance. FIX: Updated system prompt.

---

## EXECUTION STEPS (Follow in exact order)

### Step 1: Analyze the Incoming Document

Run this analysis script on the senior dev's file:

```bash
# Replace FILE_PATH with actual path
FILE_PATH="/tmp/dify-knowledge/senior-dev-system-doc.md"

echo "=== FILE SIZE ==="
wc -c -w "$FILE_PATH"

echo "=== HIGH-RISK KEYWORD COUNTS ==="
for word in event events ticket tickets payment pay account organizer refund create buy; do
  count=$(grep -oi "$word" "$FILE_PATH" | wc -l)
  echo "$word: $count"
done

echo "=== H2 SECTIONS ==="
grep "^## " "$FILE_PATH"
```

### Step 2: Map Sections to Topics

Read through the document and classify each H2 section:

| Classification | Meaning | Action |
|---------------|---------|--------|
| **NEW** | Info not in any existing doc | → Create new sub-document |
| **OVERLAP-BETTER** | Same topic, better detail than existing doc | → Update existing doc |
| **OVERLAP-DUPLICATE** | Same info already in existing doc | → Skip entirely |
| **IRRELEVANT** | Pure dev internals users won't ask about | → Skip entirely |

### Step 3: Split Into Sub-Documents

**Hard rules:**
- **MAX 5,000 chars per document** — prevents monopolizing Top K=5
- **TARGET 2,000-4,000 chars** — sweet spot
- **ONE topic per document** — describable in one phrase
- **NO generic preambles** — never start with "Veent Tix is a platform..."
- **MAX 3 mentions of "event"/"ticket" per chunk** in non-event/ticket docs
- **File prefix**: `system-` for all new docs (easy rollback)

**Keyword anchoring:**
- Lead H2 headings with distinguishing terms: "## Organizer Dashboard Features" not "## Features"
- Use compound terms: "ticket scanning" not "ticket", "payment gateway" not "payment"
- Repeat distinguishing term 2-3x per chunk

**Proposed sub-documents (adjust based on actual content):**

| Document | Topic | Distinguishing Keywords | Max Chars |
|----------|-------|------------------------|-----------|
| system-organizer-tools.md | Dashboard, event creation, listings, analytics | organizer, dashboard, create listing, analytics | 4,000 |
| system-payment-checkout.md | Payment flow, gateway, transactions | checkout flow, payment gateway, transaction, receipt | 3,500 |
| system-check-in-qr.md | QR codes, scanning, entrance verification | QR code, scan, check-in, verify, entrance | 3,000 |
| system-account-auth.md | Login, password reset, roles | authentication, login flow, password reset, role | 3,000 |
| system-notifications.md | Email delivery, reminders | email notification, delivery, reminder | 2,500 |

### Step 4: Overlap Resolution

| If new section... | Action |
|-------------------|--------|
| Repeats user-facing info from existing doc | DELETE from new doc |
| Has BETTER info than existing doc | UPDATE existing doc, remove from new |
| Explains backend logic for same topic | KEEP both (different query intents) |
| Has boilerplate (contact info, "visit veent.io") | REMOVE — only keep in about-veent-tix.md |

### Step 5: Pre-Upload Validation

For EACH new sub-document, verify before uploading:

- [ ] Under 5,000 characters?
- [ ] Topic describable in one phrase?
- [ ] Can write 3 queries only THIS doc should answer?
- [ ] Top 5 keywords don't overlap with 3+ existing docs?
- [ ] No generic preamble ("Veent Tix is...")?
- [ ] Distinguishing keywords appear 2-3x per chunk?
- [ ] "event"/"ticket" max 3x per chunk?

### Step 6: Upload One at a Time (safest first)

**Upload order** (most isolated keywords → most overlap risk):

1. `system-check-in-qr.md` — QR, scan, check-in (most unique)
2. `system-notifications.md` — notification, email delivery
3. `system-account-auth.md` — authentication, login flow
4. `system-organizer-tools.md` — organizer, dashboard
5. `system-payment-checkout.md` — payment, checkout (highest risk → LAST)

**Per-upload procedure:**
1. Open Dify Knowledge: `https://cloud.dify.ai/datasets/15e17bd7-e876-4b0c-95d8-316ed3d5db12/documents`
2. Click "Add file" → Upload the .md file
3. Settings: General mode, 1024 max chunk, 50 overlap, Economical index
4. Click "Save & Process" → Wait for indexing
5. Go to workflow: `https://cloud.dify.ai/app/c710893f-eff7-4c63-8b03-d20f5040a029/workflow`
6. Open Preview → Run ALL 10 baseline queries
7. Compare against baseline answers below
8. **If ANY answer degrades → STOP → Delete the just-uploaded doc → Diagnose**
9. If all pass → Proceed to next document

### Step 7: Post-Integration Testing

After ALL documents uploaded, run these additional queries:
- "How does the check-in system work?"
- "How are QR codes verified at the entrance?"
- "How does the organizer dashboard work?"
- "How do I create an event as an organizer?"
- "How does the payment processing work?"

Then test on live deployment: http://143.198.87.162

### Step 8: Publish & Redeploy

1. In Dify workflow → Click "Publish" → "Publish Update"
2. Optionally rebuild the Docker container if SvelteKit code changed:
```bash
ssh root@143.198.87.162 "cd /root/veent-dify-chat && docker build -t veent-bot . && docker stop veent-bot && docker rm veent-bot && docker run -d --name veent-bot --restart unless-stopped -p 80:3000 --env-file /root/veent-dify-chat/.env veent-bot"
```

---

## ROLLBACK PLAN

- **Single doc issue**: Delete that `system-*.md` from Dify Knowledge
- **Multiple doc issue**: Delete ALL docs with `system-` prefix
- **Nuclear rollback**: The 6 original docs are untouched, so deleting all `system-*` docs returns to exact current state
- **Event docs are NEVER modified during this process**

---

## BASELINE TEST QUERIES & EXPECTED ANSWERS

### Query 1: "What events are happening in March?"
**Expected**: Lists March events by name and date (SUB1-SAHARUN, Miles For Smiles, Run4UrHeart, RUN FOR ILOILO RIVER, etc.)
**Source**: events-march-2026-v2.md
**Baseline answer**: Lists 4+ March events with specific dates and names. Includes navigation guidance to Discover page.

### Query 2: "How much are tickets for Lani Misalucha?"
**Expected**: VVIP P5,500 | VIP P4,400 | Platinum P3,300 | Premium P2,200 | Lower Balcony P800 | Upper Balcony P600
**Source**: events-april-2026-v2.md
**Baseline answer**: Lists all 6 ticket tiers with exact prices.

### Query 3: "Can I get a refund?"
**Expected**: All sales final, no refund policy. If event cancelled, organizer handles refund.
**Source**: faq-and-policies.md
**Baseline answer**: Clearly states no-refund policy with exception for cancelled events.

### Query 4: "How do I buy tickets?"
**Expected**: Step-by-step guide: find event → select tickets → choose seats → fill form → pay → receive QR
**Source**: website-navigation-guide-v2.md
**Baseline answer**: 7-step detailed walkthrough with payment methods listed.

### Query 5: "What payment methods are accepted?"
**Expected**: Visa, Mastercard, GCash, Maya, GrabPay, BillEase, Bank Transfer
**Source**: website-navigation-guide-v2 or about-veent-tix
**Baseline answer**: Lists all 7 payment methods with brief descriptions.

### Query 6: "How do I contact Veent?"
**Expected**: Email support@veenttix.com, hello@veent.io, support hours, social media links
**Source**: about-veent-tix.md
**Baseline answer**: Lists email, phone, website form, social media, in-app support.

### Query 7: "What is Veent Tix?"
**Expected**: Online ticketing platform for concerts, festivals, workshops. Browse, buy, receive digital tickets.
**Source**: about-veent-tix.md

### Query 8: "Are there fun runs in April?"
**Expected**: Lists April fun runs: Dash And Splash, Alfonso Ridge, Kaldereta Trail Run, RUN4ME, Sama ALL Charity, Challenger Run
**Source**: events-april-2026-v2.md
**Baseline answer**: Lists 6 April fun runs with dates and venues.

### Query 9: "How do I create an account?"
**Expected**: Click LOGIN → v2.veent.io/sign-in → Google sign-in or create account
**Source**: website-navigation-guide-v2.md

### Query 10: "What events are in CDO?"
**Expected**: Lists CDO events across months (Lani Misalucha, TJ Monterde & KZ, runs, etc.)
**Source**: Multiple event docs

---

## ONGOING MAINTENANCE RULES

### Document Size Limits
| Category | Max Chars | Max Chunks |
|----------|-----------|-----------|
| Event listings (monthly) | 8,000 | 8 |
| Policy/legal | 5,000 | 5 |
| System feature docs | 4,000 | 4 |
| About/general | 3,500 | 4 |
| Navigation/how-to | 8,000 | 8 |
| **Total KB** | **~60,000** | **~60** |

### Keyword Pollution Rule
No single non-event document should have >40% of any high-risk keyword's total occurrences across all docs.

### Event Document Rotation
- Archive months after all events pass
- NEVER consolidate multiple months into one document
- New month = new document file
