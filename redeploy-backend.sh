#!/bin/bash
# Redeploy the backend to Google Cloud Run.
# Run from repo root: ./redeploy-backend.sh
# Requires: gcloud CLI, Docker (or Cloud Build), and backend/.env.local for local dev only.

set -e
cd "$(dirname "$0")/backend"
echo "📁 Using backend directory: $(pwd)"
./deploy.sh
