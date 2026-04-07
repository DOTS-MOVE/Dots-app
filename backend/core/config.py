from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dots"
    
    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # Service role key (secret key) for backend operations
    SUPABASE_PUBLISHABLE_KEY: str = ""  # Publishable key (optional, for reference)
    
    # JWT (for custom tokens if needed)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS — localhost + dotsmove; all Vercel deploys via CORS_ORIGIN_REGEX
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://dotsmove.com",
        "https://www.dotsmove.com",
    ]
    # Production/preview hosts like https://your-app.vercel.app (set "" to disable)
    CORS_ORIGIN_REGEX: Optional[str] = r"https://.*\.vercel\.app"

    # App
    DEBUG: bool = True
    AUTO_APPROVE_RSVPS: bool = False

    # Telemetry
    REQUEST_TELEMETRY_ENABLED: bool = True
    REQUEST_TELEMETRY_SAMPLE_RATE: float = 1.0
    REQUEST_TELEMETRY_SLOW_MS: int = 500
    REQUEST_TELEMETRY_JSON_LOGS: bool = True
    
    class Config:
        env_file = [".env.local", ".env"]
        case_sensitive = True


settings = Settings()
