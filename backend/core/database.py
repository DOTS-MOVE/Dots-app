from supabase import create_client, Client
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from core.config import settings

# SQLAlchemy setup for database operations
DATABASE_URL = getattr(settings, 'DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/dots')
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db() -> Session:
    """Get SQLAlchemy database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Supabase client for auth operations (if needed)
_supabase_client: Client = None

def get_supabase() -> Client:
    """Get Supabase client for database operations"""
    global _supabase_client
    if _supabase_client is None:
        if not hasattr(settings, 'SUPABASE_URL') or not settings.SUPABASE_URL:
            raise ValueError("SUPABASE_URL is not configured. Please set it in .env.local file.")
        if not hasattr(settings, 'SUPABASE_KEY') or not settings.SUPABASE_KEY:
            raise ValueError("SUPABASE_KEY is not configured. Please set it in .env.local file.")
        try:
            _supabase_client = create_client(
                settings.SUPABASE_URL,
                settings.SUPABASE_KEY
            )
        except Exception as e:
            raise RuntimeError(f"Failed to initialize Supabase client: {str(e)}")
    return _supabase_client