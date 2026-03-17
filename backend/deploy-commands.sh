#!/bin/bash
# Deployment commands for Google Cloud Run
# Run these commands in your terminal

PROJECT_ID=dots
SERVICE_NAME=dots-backend
REGION=us-central1

echo "Step 1: Set up project..."
gcloud config set project ${PROJECT_ID}

echo "Step 2: Enable required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

echo "Step 3: Build and deploy..."
cd backend
gcloud builds submit --tag gcr.io/${PROJECT_ID}/${SERVICE_NAME}

gcloud run deploy ${SERVICE_NAME} \
  --image gcr.io/${PROJECT_ID}/${SERVICE_NAME} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --max-instances 10 \
  --set-env-vars "PORT=8080,DEBUG=False"

echo "Step 4: Get service URL..."
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "Backend URL: ${SERVICE_URL}"

echo ""
echo "Next steps:"
echo "1. Set SUPABASE_URL and SUPABASE_KEY environment variables:"
echo "   gcloud run services update ${SERVICE_NAME} --region ${REGION} --update-env-vars \"SUPABASE_URL=YOUR_URL,SUPABASE_KEY=YOUR_KEY,DEBUG=False\""
echo ""
echo "2. Update frontend/.env.local with:"
echo "   NEXT_PUBLIC_API_URL=${SERVICE_URL}"
