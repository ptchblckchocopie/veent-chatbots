import datetime
import re

def main(**kwargs):
    today = datetime.datetime.now()
    current_date = today.strftime("%B %d, %Y")
    result = kwargs.get("result", [])

    # Pattern matches: "April 11, 2026" or "April 11 2026"
    date_pattern = r'(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}'

    upcoming_events = []
    non_event_chunks = []

    for chunk in result:
        content = chunk.get("content", "")

        # Split chunk into event blocks
        blocks = re.split(r'(?=Event:)', content)

        for block in blocks:
            block = block.strip()
            if not block:
                continue

            # Non-event blocks (headers, FAQ, etc.) -- keep as context
            if not block.startswith("Event:"):
                non_event_chunks.append(block)
                continue

            # Find dates in this event block
            block_dates = re.findall(date_pattern, block)

            if not block_dates:
                # No parseable date (e.g., multi-day "May 2-3, 2026") -- keep it
                upcoming_events.append(block)
                continue

            # Check if at least one date is today or in the future
            is_upcoming = False
            latest_date = None
            for ds in block_dates:
                try:
                    parsed = datetime.datetime.strptime(ds.replace(",", ""), "%B %d %Y")
                    if latest_date is None or parsed > latest_date:
                        latest_date = parsed
                    if parsed.date() >= today.date():
                        is_upcoming = True
                except ValueError:
                    is_upcoming = True  # If we can't parse, keep it

            if is_upcoming:
                upcoming_events.append(block)

    # Build filtered context
    parts = []
    if non_event_chunks:
        parts.extend(non_event_chunks)
    if upcoming_events:
        parts.extend(upcoming_events)

    filtered_context = "\n\n".join(parts)

    return {
        "current_date": current_date,
        "filtered_context": filtered_context
    }
