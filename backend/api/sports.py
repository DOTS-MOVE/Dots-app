from fastapi import APIRouter, HTTPException, status
from supabase import Client
from typing import List, Optional
from core.database import get_supabase
import time

router = APIRouter(prefix="/sports", tags=["sports"])

# In-memory cache: sports change rarely (5 min TTL)
_sports_cache: Optional[List[dict]] = None
_sports_cache_at: float = 0
_CACHE_TTL_SEC = 300


@router.get("", response_model=List[dict])
async def list_sports():
    """List all available sports (cached 5 min)"""
    global _sports_cache, _sports_cache_at
    now = time.time()
    if _sports_cache is not None and (now - _sports_cache_at) < _CACHE_TTL_SEC:
        return _sports_cache
    try:
        supabase: Client = get_supabase()
        result = supabase.table("sports").select("*").order("name").execute()
        if result.data:
            _sports_cache = [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in result.data]
            _sports_cache_at = now
            return _sports_cache
        return []
    except Exception as e:
        if _sports_cache is not None:
            return _sports_cache  # Serve stale on error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sports: {str(e)}"
        )

