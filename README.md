# TrojanPulse

Start a walk, and you are never walking alone. A peer-safety web app for late-night walks around USC, built at AI@USC (November 14 to 15, 2026).

## What it does

- **Walk Mode:** safest versus fastest route, walking pods of verified @usc.edu students, and a hands-free voice trigger with a 10 second cancel countdown.
- **Campus Pulse:** a dashboard for USG and GSG with live alerts, walk demand and a ride demand forecast.

Data is simulated for the hackathon. The pipelines that use it are real.

## Run it

Backend (Python 3.9 or newer):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m data.generate          # once: creates the simulated datasets
python -m uvicorn app.main:app --reload
```

The street graph is already in the repo. If the data step is skipped the API still runs, but it serves example data. Check `http://localhost:8000/health`: `"data": "ready"` means the real data is in use.

For the voice trigger, copy `.env.example` to `.env` at the repo root and set `GROQ_API_KEY`. Without it the app still runs, with speech to text off.

Frontend (Node 18 or newer):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Set `VITE_CARTO_KEY` in `.env.local` to a free key from https://carto.com/basemaps/apikey. The maps show no streets without it.

In the student app, allow location and microphone access. If location is unavailable or far from campus, the app starts from Leavey Library and says so.

| What | Where |
| --- | --- |
| Student app | http://localhost:5173 |
| Dashboard | http://localhost:5173/dashboard |
| API docs | http://localhost:8000/docs |

## Deploy on Replit

One server hosts the API, the student app and the dashboard.

1. Import this repo from GitHub into Replit.
2. In Secrets, add `GROQ_API_KEY` and `VITE_CARTO_KEY`.
3. Publish as a **Reserved VM**. Walks and alerts are kept in memory, so the app needs one server that stays on.

| Setting | Value |
| --- | --- |
| Build command | `bash replit-build.sh` |
| Run command | `bash -c "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 5000"` |

The student app is at `/` and the dashboard at `/dashboard`. `/health` should show `"data": "ready"` and `"transcription": "groq"`.

## Project layout

```
backend/app      API, schemas, services
backend/data     simulated data generators
frontend/src     mobile app, dashboard, shared components
docs             team guides
```

## For the team

Guides are in the `docs` folder. Read the common one first, then your own.

| Guide | For |
| --- | --- |
| [teammates-builder-guide.pdf](docs/teammates-builder-guide.pdf) | Everyone: setup, terms, team rules |
| [sharyu-guide.pdf](docs/sharyu-guide.pdf) | Student app (mobile) |
| [arin-guide.pdf](docs/arin-guide.pdf) | Dashboard and shared frontend |
| [soham-guide.pdf](docs/soham-guide.pdf) | Data and models |
