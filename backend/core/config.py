from pydantic_settings import BaseSettings
from typing import List, Optional


def _cors_origins_with_website(origins: List[str], website_url: Optional[str]) -> List[str]:
    out = list(origins)
    if website_url and website_url.rstrip("/") not in [u.rstrip("/") for u in out]:
        out.append(website_url.rstrip("/"))
    return out


class Settings(BaseSettings):
    # Database Configuration
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/dots"
    
    # Supabase Configuration
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""  # Service role key (secret key) for backend operations
    SUPABASE_PUBLISHABLE_KEY: str = ""  # Publishable key (optional, for reference)
    
    # Deployment (e.g. "production" | "staging"); backend-staging sets DEPLOYMENT_ENV=staging
    DEPLOYMENT_ENV: Optional[str] = None
    
    # Canonical URLs for this deployment (e.g. https://api.example.com, https://app.example.com)
    API_URL: Optional[str] = None
    WEBSITE_URL: Optional[str] = None
    
    # JWT (for custom tokens if needed)
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS - Allow localhost for dev and production domains
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "https://dotsmove.com",
        "https://www.dotsmove.com",
    ]
    
    # App
    DEBUG: bool = True
    
    @property
    def effective_cors_origins(self) -> List[str]:
        """CORS_ORIGINS plus WEBSITE_URL when set (e.g. for staging)."""
        return _cors_origins_with_website(self.CORS_ORIGINS, self.WEBSITE_URL)
    
    class Config:
        env_file = [".env.local", ".env"]
        case_sensitive = True


settings = Settings()
