from fastapi import APIRouter, HTTPException, status
from supabase import Client
from typing import List
from core.database import get_supabase

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=List[dict])
async def list_goals():
    """List all available fitness goals"""
    try:
        supabase: Client = get_supabase()
        result = supabase.table("goals").select("*").order("name").execute()
        if result.data:
            return [{"id": g.get("id"), "name": g.get("name"), "description": g.get("description")} for g in result.data]
        return []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch goals: {str(e)}"
        )

