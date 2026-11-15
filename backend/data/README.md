# backend/data

Owner: Soham.

The street graph is real (OpenStreetMap). Everything else is simulated with a fixed seed, so every
run produces the same files and the demo looks the same at every rehearsal.

## Setup (run once, from the `backend` folder)

```bash
python data/download_graph.py   # needs internet once; saves data/cache/usc_walk.graphml
python -m data.generate         # writes every simulated dataset to data/generated/
```

Both output folders are ignored by git. Re-run `python -m data.generate` any time to recreate them.
Set `GROQ_API_KEY` first to have the LLM extract incidents; without it, a rule-based parser does it.

## Files

| File | What it is |
| --- | --- |
| `download_graph.py` | Downloads the walking street graph for Vermont–Figueroa, Exposition–Adams |
| `graph.py` | Loads the saved graph; street-name and distance helpers |
| `places.py` | Demo clock, campus spots, destinations, late-night businesses, Leavey hours |
| `generate.py` | Builds all simulated datasets with the demo stories in them |
| `extract_incidents.py` | LLM (or rules) turns DPS-style alert text into geocoded incidents |
| `store.py` | Reads and writes the generated JSON files |

## Generated datasets

| Dataset | One row is |
| --- | --- |
| `streetlights` | A light every ~35 m on streets and campus walkways (sidewalks share the street's lights), working or not |
| `hazard_reports` | One tap on a report button: type, place, time |
| `businesses` | A place open late, with its closing time |
| `walkers` | A student walking home tonight: first name and initial, start, destination, departure |
| `campus_schedule` | Something that ends and releases a crowd (Leavey closing, evening events) |
| `ride_requests` | One Fryft or shuttle request: pickup spot, time, minutes waited (3 weeks of nights) |
| `incidents_raw` | A past safety alert as raw text, like a DPS email |
| `incidents` | The same alerts after extraction: place, time, category |

## Demo stories

- The demo clock is Friday Nov 13 2026, 11:30 PM (`places.DEMO_NOW`).
- Streetlights are out on Ellendale Pl's south block, with 4 hazard reports there.
- Leavey Library closes at midnight tonight (its real Friday hours), which drives a Fryft surge.
  Change its `ends_at` in `campus_schedule.json` and the forecast surge moves.
- Maya R. and Dev K. leave Leavey for Ellendale Pl & 28th St in 5 and 7 minutes.
