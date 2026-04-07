#!/usr/bin/env bash
# Deploy backend to Cloud Run using a different gcloud account, then restore the previous one.
#
# 1) Add / refresh the account that can access dots-490015:
#    gcloud auth login
# 2) Run from repo root:
#    ./redeploy-backend-with-account.sh
#    Optional: ./redeploy-backend-with-account.sh other@email.com

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OTHER="${1:-emmanuel@dotsmove.com}"

PREV="$(gcloud config get-value account 2>/dev/null || true)"
cleanup() {
  if [[ -n "${PREV}" ]]; then
    gcloud config set account "${PREV}"
    echo "Restored gcloud account: ${PREV}"
  fi
}
trap cleanup EXIT

gcloud config set account "${OTHER}"
gcloud config set project dots-490015

cd "${ROOT}/backend"
echo "📁 Using backend directory: $(pwd)"
./deploy.sh
