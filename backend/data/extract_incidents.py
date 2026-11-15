"""Turn raw DPS-style alert text into structured, geocoded incidents. This is one of the AI pieces.

With GROQ_API_KEY set, an LLM reads each alert and returns the two cross streets, the time and the
category. Without a key (or if the LLM answer can't be used), a rule-based parser does the same job,
so generation still works offline. The cross streets are then geocoded on the real street graph.

generate.py runs this for you. To re-run only this step:  python -m data.extract_incidents
"""

import json
import os
import re
from datetime import datetime
from typing import List, Optional

from data import places, store
from data.graph import intersection, load_graph

# Groq retired llama-3.1-8b-instant in August 2026. Override with GROQ_LLM_MODEL if this one changes.
GROQ_MODEL = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-20b")
CATEGORIES = ["theft", "robbery", "assault", "vandalism", "vehicle break-in", "other"]

SYSTEM_PROMPT = f"""You read campus safety alert emails and return JSON only, with these keys:
"street_a" and "street_b": the two cross streets, copied exactly as written in the alert;
"month", "day": the date as numbers; "clock": the time as 24-hour "HH:MM";
"category": one of {CATEGORIES}.
Do not describe any person."""

ALERT_PATTERN = re.compile(
    r"On (?P<month>[A-Z][a-z]{2}) (?P<day>\d{1,2}) at approximately (?P<clock>\d{1,2}:\d{2} [AP]M), "
    r"an? (?P<category>[a-z -]+?) was reported near (?P<a>.+?) and (?P<b>.+?)\."
)


def parse_with_rules(text: str) -> Optional[dict]:
    match = ALERT_PATTERN.search(" ".join(text.split()))
    if not match:
        return None
    clock = datetime.strptime(match["clock"], "%I:%M %p").strftime("%H:%M")
    month = datetime.strptime(match["month"], "%b").month
    return {
        "street_a": match["a"],
        "street_b": match["b"],
        "month": month,
        "day": int(match["day"]),
        "clock": clock,
        "category": match["category"],
    }


def parse_with_llm(client, text: str) -> dict:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        temperature=0,
        reasoning_effort="low",
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": text}],
    )
    return json.loads(response.choices[0].message.content)


def to_incident(row: dict, fields: dict, g, method: str) -> dict:
    """Geocode the cross streets and build the stored record. Raises if the fields can't be used."""
    lat, lng = intersection(g, fields["street_a"], fields["street_b"])
    hour, minute = map(int, fields["clock"].split(":"))
    when = datetime(places.DEMO_NOW.year, int(fields["month"]), int(fields["day"]), hour, minute)
    category = next((c for c in CATEGORIES if c in str(fields["category"]).lower()), "other")
    return {
        "id": row["id"],
        "text": row["text"],
        "location": {"lat": round(lat, 6), "lng": round(lng, 6)},
        "time": when.isoformat(timespec="minutes"),
        "category": category,
        "extracted_by": method,
    }


def extract_all(raw_rows: List[dict], use_llm: bool = True) -> List[dict]:
    g = load_graph()
    client = None
    if use_llm and os.getenv("GROQ_API_KEY"):
        from groq import Groq

        client = Groq()
    incidents = []
    for row in raw_rows:
        incident = None
        if client:
            try:
                incident = to_incident(row, parse_with_llm(client, row["text"]), g, "llm")
            except Exception as error:  # bad JSON, unknown street, API down: fall back to rules
                print(f"{row['id']}: LLM answer not usable ({error}); using rules")
        if incident is None:
            fields = parse_with_rules(row["text"])
            if fields is None:
                print(f"{row['id']}: could not parse, skipped")
                continue
            incident = to_incident(row, fields, g, "rules")
        incidents.append(incident)
    return incidents


if __name__ == "__main__":
    rows = extract_all(store.load("incidents_raw"))
    store.save("incidents", rows)
    print(f"incidents: {len(rows)} extracted")
