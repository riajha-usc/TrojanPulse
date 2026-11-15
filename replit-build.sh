#!/usr/bin/env bash
# Replit build: install both halves, create the simulated data, build the web app.
set -euo pipefail
cd "$(dirname "$0")"

pip install -r backend/requirements.txt
(cd backend && python -m data.generate)
(cd frontend && npm ci --include=dev && npm run build)
