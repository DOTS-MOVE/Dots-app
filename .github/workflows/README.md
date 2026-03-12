# Deploy Backend to GCP

The `deploy-backend-gcp.yml` workflow deploys the backend to Google Cloud Run when you push to `main` (and only when files under `backend/` change). You can also run it manually from the **Actions** tab.

## One-time setup

### 1. Service account for GitHub Actions (custom SA)

1. **Create a GCP service account** (if you don’t have one):
   - In [Google Cloud Console](https://console.cloud.google.com/) → IAM & Admin → Service Accounts → Create.
   - Grant it:
     - **Cloud Build Editor** (to trigger builds and build images)
     - **Cloud Run Admin** (to deploy)
     - **Service Account User** (so Cloud Run can use the build SA)
     - **Storage Admin** (or at least **Storage Object Creator** on bucket `gs://PROJECT_ID_cloudbuild`) — needed so `gcloud builds submit` can upload the build context.
   - Create a JSON key and download it.

2. **Add the key to GitHub**:
   - Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
   - Name: `GCP_SA_KEY`
   - Value: paste the **entire contents** of the JSON key file.

### 2. Permissions for the project’s default Cloud Build service account

The build runs in GCP under the **default Compute Engine / Cloud Build service account** (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`). It must have these roles so the build can read the uploaded source and push the image:

In [IAM & Admin → IAM](https://console.cloud.google.com/iam-admin/iam), find the principal  
`PROJECT_NUMBER-compute@developer.gserviceaccount.com` (e.g. `586247036420-compute@developer.gserviceaccount.com` for project `dots-488014`) and ensure it has:

| Role | Why |
|------|-----|
| **Storage Object Admin** on bucket `gs://PROJECT_ID_cloudbuild` | So the build can read the uploaded source tarball (otherwise: “storage.objects.get access denied”). |
| **Artifact Registry Writer** | So the build can push the Docker image to `gcr.io` (otherwise: “uploadArtifacts denied”). |
| **Artifact Registry Create-on-push Writer** (or **Artifact Registry Repository Admin**) | So the first push can create the `gcr.io` repo (otherwise: “createOnPush permission” / “gcr.io repo does not exist”). |
| **Logs Writer** (optional) | So build logs appear in Cloud Logging. |

To grant the bucket permission via CLI (replace `PROJECT_ID` and `PROJECT_NUMBER`):

```bash
gsutil iam ch serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com:objectAdmin gs://PROJECT_ID_cloudbuild
```

To grant Artifact Registry roles via CLI:

```bash
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.createOnPushWriter"
```

### 3. Run the workflow

Push to `main` (with changes under `backend/`) or run the workflow manually from the Actions tab.

## Variables

Edit the `env` block in the workflow to change:

- `GCP_PROJECT_ID` (default: `dots-488014`)
- `SERVICE_NAME` (default: `dots-backend`)
- `GCP_REGION` (default: `us-central1`)

Environment variables for the running service (e.g. `SUPABASE_URL`, `SUPABASE_KEY`) must be set in Cloud Run (Console → Cloud Run → your service → Edit & deploy → Variables).
