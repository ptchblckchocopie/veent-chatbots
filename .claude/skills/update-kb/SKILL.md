---
name: update-kb
description: Crawl veent.io for events in a target month, update the knowledge base markdown file, and re-upload to Dify
argument-hint: "[month] (e.g., march, april, may)"
disable-model-invocation: true
---

# Update Knowledge Base for $ARGUMENTS

You are updating the Veent Tix Buyer Bot knowledge base for the month(s): **$ARGUMENTS**

## Step 1: Crawl veent.io/discover for events

1. Open `https://www.veent.io/discover` using Playwriter MCP
2. Scroll through the event listings and collect ALL events that fall within **$ARGUMENTS** (click "See More Events" as needed until you've passed the target month)
3. For each event in the target month, record: event name, date shown, and event page URL (the `href` from the card link)

## Step 2: Visit each event page for full details

For each event found in Step 1, visit the event's dedicated page (e.g., `https://eventname.veent.net`) and collect:

- **Full event name** (from the heading)
- **Exact date** (e.g., "Saturday, April 11")
- **Time range** (e.g., "4:00 AM - 9:00 AM (GMT+8)")
- **Venue** (full venue name and location)
- **All ticket categories and prices** (scroll down to the booking section)
- **Event link** (the veent.net URL)

## Step 3: Compare with existing knowledge file

1. Read the corresponding file in `knowledge/`:
   - March → `knowledge/events-mar-2026.md`
   - April → `knowledge/events-apr-2026.md`
   - May through August → `knowledge/events-may-aug-2026.md`
   - If the file doesn't exist, create it
2. Compare crawled data vs existing file:
   - Identify **new events** not in the file
   - Identify **date/time/price discrepancies** (veent.io is the source of truth)
   - Identify **events in the file that no longer appear on veent.io** (mark as ended/remove)
3. Report all differences to the user before making changes

## Step 4: Update the knowledge markdown file

Use this exact multi-line format for each event (matching the format used in `events-mar-2026.md`):

```
Event: [Event Name]
Event Link: https://[eventname].veent.net
Date: [Day], [Month] [DD], [YYYY]
Time: [Start] - [End]
Venue: [Full venue name and location]
Ticket Prices:
- [Category]: ₱[Price]
- [Category]: ₱[Price]
```

Rules:

- Start the file with `## Upcoming Events on Veent Tix — [Month] [Year]` heading
- Follow with `Below is the list of upcoming events, event listings, and event schedules for [Month] [Year] on Veent Tix.`
- Do NOT add a summary line listing all event names (this causes a chunking issue in Dify)
- Separate each event with a double blank line (`\n\n`)
- Sort events by date (earliest first)
- Include keyword hints in parentheses for concerts/notable events, e.g., `(Concert, Artist Name)`
- Omit Ticket Prices section if event has no listed prices

## Step 5: Upload to Dify Knowledge Base

1. Navigate to the Dify KB documents page: `https://cloud.dify.ai/datasets/15e17bd7-e876-4b0c-95d8-316ed3d5db12/documents`
2. **Delete** the old version of the document (click the popover menu → Delete → "I'm sure")
3. Click "Add file" and upload the updated markdown file
4. On the Document Processing (Step 2) page, configure these chunking settings:
   - **Delimiter**: Change from `\n\n` to `---` (this ensures the entire doc stays as 1 chunk)
   - **Maximum chunk length**: Set to `4000` (use `page.evaluate` to set the value: `Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, '4000')` then dispatch input+change events)
   - Leave other settings as default (High Quality, Hybrid Search, gemini-embedding-001)
5. Click "Preview Chunk" to verify it produces **1 chunk** (or minimal chunks) with all event data
6. Click "Save & Process" and wait for embedding to complete

## Step 6: Test in bot preview

1. Navigate to the workflow page: `https://cloud.dify.ai/app/c710893f-eff7-4c63-8b03-d20f5040a029/workflow`
2. Open the Preview panel
3. Ask: "events for $ARGUMENTS?"
4. Verify ALL events are returned with complete details (dates, times, venues, ticket prices, links)
5. Report results to the user

## Important Notes

- The Dify KB ID is: `15e17bd7-e876-4b0c-95d8-316ed3d5db12`
- The Dify App ID is: `c710893f-eff7-4c63-8b03-d20f5040a029`
- Top K is set to 5 in retrieval — keeping docs as single chunks ensures all event data is retrieved together
- veent.io is the source of truth for dates, times, venues, and prices
- Use Playwriter MCP (`mcp__playwriter__execute`) for all Dify and veent.io browser interactions
- When setting number inputs in Dify, use `page.evaluate` with native setter as Playwright `fill()` tends to time out on these inputs
