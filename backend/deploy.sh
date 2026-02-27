#!/bin/bash
set -e

# Set Python version for gcloud (fixes Python 3.12 compatibility issue)
export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.11

# Default project; override for another GCP account:
#   GCP_PROJECT_ID=other-project-id ./deploy.sh
# Or export first: export GCP_PROJECT_ID=other-project-id && ./deploy.sh
PROJECT_ID=${GCP_PROJECT_ID:-dots-488014}
SERVICE_NAME=dots-backend
REGION=${GCP_REGION:-us-central1}

# Use the target project for this deploy
gcloud config set project "${PROJECT_ID}"

echo "🚀 Building Docker image..."
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --update-env-vars "DEBUG=False"

echo "✅ Getting service URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo ""
echo "🎉 Backend deployed successfully!"
echo "📍 Service URL: ${SERVICE_URL}"
echo ""
echo "Don't forget to:"
echo "1. Set SUPABASE_URL and SUPABASE_KEY environment variables in Cloud Run"
echo "2. Update NEXT_PUBLIC_API_URL in frontend/.env.local to: ${SERVICE_URL}"
