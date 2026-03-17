from fastapi import APIRouter, HTTPException, status
from typing import List
from supabase import Client
from core.database import get_supabase
from schemas.waitlist import WaitlistEntryCreate, WaitlistEntryResponse

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_waitlist_entry(entry: WaitlistEntryCreate):
    """Add an entry to the waitlist"""
    supabase: Client = get_supabase()
    
    try:
        # Insert into waitlist_entries table
        result = supabase.table("waitlist_entries").insert({
            "email": entry.email,
            "name": entry.name,
            "city": entry.city,
            "message": entry.message,
        }).execute()
        
        if result.data and len(result.data) > 0:
            return WaitlistEntryResponse(**result.data[0])
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create waitlist entry"
            )
    except Exception as e:
        # Check if it's a duplicate email error
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email is already on the waitlist"
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create waitlist entry: {str(e)}"
        )
