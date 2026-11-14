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
uvicorn app.main:app --reload
```

Frontend (Node 18 or newer):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

| What | Where |
| --- | --- |
| Student app | http://localhost:5173 |
| Dashboard | http://localhost:5173/dashboard |
| API docs | http://localhost:8000/docs |

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
