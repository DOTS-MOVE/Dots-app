import json
import random
import time
import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings
from core.database import get_supabase
import logging
from api.auth import router as auth_router
from api.users import router as users_router
from api.events import router as events_router
from api.buddies import router as buddies_router
from api.messages import router as messages_router
from api.groups import router as groups_router
from api.sports import router as sports_router
from api.goals import router as goals_router
from api.waitlist import router as waitlist_router
from api.posts import router as posts_router


def _configure_logging() -> None:
    """Ensure INFO logs from this app are emitted in Cloud Run container logs."""
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    if not root_logger.handlers:
        handler = logging.StreamHandler()
        handler.setLevel(logging.INFO)
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.setLevel(logging.INFO)

    for logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        logging.getLogger(logger_name).setLevel(logging.INFO)


_configure_logging()
app = FastAPI(title="Dots API", version="1.0.0")
logger = logging.getLogger(__name__)


def _trace_request(request: Request, duration_ms: float, status_code: int, sample_roll: float, request_id: str):
    payload = {
        "event": "http_request",
        "method": request.method,
        "path": request.url.path,
        "query_param_names": list(request.query_params.keys()),
        "status_code": status_code,
        "duration_ms": round(duration_ms, 2),
        "request_id": request_id,
        "sample_roll": round(sample_roll, 4),
        "slow": duration_ms >= settings.REQUEST_TELEMETRY_SLOW_MS,
        "slow_ms_threshold": settings.REQUEST_TELEMETRY_SLOW_MS,
    }
    if settings.REQUEST_TELEMETRY_JSON_LOGS:
        logger.info(json.dumps(payload))
    else:
        logger.info(
            "HTTP %s %s status=%s duration_ms=%s",
            request.method,
            request.url.path,
            status_code,
            round(duration_ms, 2),
        )


def _request_id_from_header(request: Request) -> str:
    cloud_trace = request.headers.get("x-cloud-trace-context")
    if cloud_trace:
        return cloud_trace.split("/")[0]
    return request.headers.get("x-request-id") or str(uuid.uuid4())


def _should_trace() -> bool:
    if not settings.REQUEST_TELEMETRY_ENABLED:
        return False
    if settings.REQUEST_TELEMETRY_SAMPLE_RATE >= 1:
        return True
    return random.random() <= max(0.0, settings.REQUEST_TELEMETRY_SAMPLE_RATE)

# Test Supabase connection on startup
@app.on_event("startup")
async def startup_event():
    rsvp_mode = "approved" if settings.AUTO_APPROVE_RSVPS else "pending"
    logger.info(
        "RSVP startup mode: AUTO_APPROVE_RSVPS=%s (new RSVPs default to '%s')",
        settings.AUTO_APPROVE_RSVPS,
        rsvp_mode,
    )
    print(f"RSVP startup mode: AUTO_APPROVE_RSVPS={settings.AUTO_APPROVE_RSVPS} (new RSVPs default to '{rsvp_mode}')")
    try:
        print("Testing Supabase connection...")
        supabase = get_supabase()
        print("✅ Supabase connection successful")
    except Exception as e:
        print(f"⚠️  WARNING: Supabase connection failed: {str(e)}")
        print("⚠️  The server will continue, but Supabase features may not work")
        print("⚠️  Please check your SUPABASE_URL and SUPABASE_KEY environment variables")
        # Don't crash the server - just warn

    telemetry_status = "ENABLED" if settings.REQUEST_TELEMETRY_ENABLED else "DISABLED"
    print(
        "Telemetry startup status: "
        f"enabled={telemetry_status}, "
        f"sample_rate={settings.REQUEST_TELEMETRY_SAMPLE_RATE}, "
        f"slow_ms={settings.REQUEST_TELEMETRY_SLOW_MS}, "
        f"json_logs={settings.REQUEST_TELEMETRY_JSON_LOGS}"
    )
    logger.info(
        "telemetry_startup status=%s sample_rate=%s slow_ms=%s json_logs=%s",
        telemetry_status,
        settings.REQUEST_TELEMETRY_SAMPLE_RATE,
        settings.REQUEST_TELEMETRY_SLOW_MS,
        settings.REQUEST_TELEMETRY_JSON_LOGS,
    )
    if settings.REQUEST_TELEMETRY_JSON_LOGS:
        logger.info(
            json.dumps({
                "event": "telemetry_startup",
                "enabled": settings.REQUEST_TELEMETRY_ENABLED,
                "sample_rate": settings.REQUEST_TELEMETRY_SAMPLE_RATE,
                "slow_ms_threshold": settings.REQUEST_TELEMETRY_SLOW_MS,
                "json_logs": settings.REQUEST_TELEMETRY_JSON_LOGS,
                "status": telemetry_status,
            })
        )


@app.middleware("http")
async def request_telemetry_middleware(request: Request, call_next):
    should_trace = _should_trace()
    request_id = _request_id_from_header(request)
    request.state.request_id = request_id
    start = time.perf_counter()
    sample_roll = random.random() if should_trace else 1.0

    try:
        response = await call_next(request)
    except Exception:
        duration_ms = (time.perf_counter() - start) * 1000
        if should_trace:
            payload = {
                "event": "http_request_error",
                "method": request.method,
                "path": request.url.path,
                "status_code": 500,
                "duration_ms": round(duration_ms, 2),
                "request_id": request_id,
                "sample_roll": round(sample_roll, 4),
            }
            if settings.REQUEST_TELEMETRY_JSON_LOGS:
                logger.exception(json.dumps(payload))
            else:
                logger.exception("Unhandled exception handling %s %s", request.method, request.url.path)
        raise

    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    if should_trace:
        _trace_request(request, duration_ms, response.status_code, sample_roll, request_id)
    return response

# CORS middleware - Allow all origins in debug mode for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else settings.CORS_ORIGINS,  # Allow all in debug mode
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(events_router)
app.include_router(buddies_router)
app.include_router(messages_router)
app.include_router(groups_router)
app.include_router(sports_router)
app.include_router(goals_router)
app.include_router(waitlist_router)
app.include_router(posts_router)

@app.get("/")
async def root():
    return {"message": "Dots API", "version": "1.0.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
