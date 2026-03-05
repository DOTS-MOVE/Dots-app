from fastapi import FastAPI
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

app = FastAPI(title="Dots API", version="1.0.0")
logger = logging.getLogger(__name__)

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
