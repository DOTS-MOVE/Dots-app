#!/bin/bash
set -euo pipefail

# Local / manual deploy to Cloud Run (same image definition as CI: backend/cloudbuild.yaml).
# Usage from repo root: backend/deploy.sh  OR  cd backend && ./deploy.sh
#
# Optional env:
#   GCP_PROJECT_ID, SERVICE_NAME, GCP_REGION, IMAGE_TAG (default latest), DEBUG_FLAG

cd "$(dirname "${BASH_SOURCE[0]}")"

PROJECT_ID=${GCP_PROJECT_ID:-dots-490015}
SERVICE_NAME=${SERVICE_NAME:-dots-backend}
REGION=${GCP_REGION:-us-central1}
DEBUG_FLAG=${DEBUG_FLAG:-False}
IMAGE_TAG=${IMAGE_TAG:-latest}

IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:${IMAGE_TAG}"

gcloud config set project "${PROJECT_ID}"

echo "🔧 Enabling required APIs (no prompt; safe to re-run)..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  --quiet

echo "🚀 Building Docker image (${IMAGE})..."
gcloud builds submit . \
  --config=cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}" \
  --quiet

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE}" \
  --platform managed \
  --region "${REGION}" \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --update-env-vars "DEBUG=${DEBUG_FLAG}"

echo "🔓 Ensuring public access (invoker role)..."
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --region "${REGION}" \
  --member=allUsers \
  --role=roles/run.invoker \
  --quiet 2>/dev/null || true

echo "✅ Getting service URL..."
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format 'value(status.url)')
echo ""
echo "🎉 Backend deployed successfully!"
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "Don't forget:"
echo "1. Set SUPABASE_URL and SUPABASE_KEY (and other secrets) on the Cloud Run service"
echo "2. Point the frontend NEXT_PUBLIC_API_URL at: ${SERVICE_URL}"
