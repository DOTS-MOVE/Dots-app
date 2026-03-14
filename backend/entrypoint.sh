#!/bin/sh
# Cloud Run sets PORT environment variable, default to 8080
PORT=${PORT:-8080}
exec uvicorn main:app --host 0.0.0.0 --port $PORT --log-level info
