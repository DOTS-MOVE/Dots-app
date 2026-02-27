from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from core.database import get_supabase, get_db
from api.auth import get_current_user
from schemas.user import UserResponse, UserUpdate, UserProfile, CompleteProfileRequest
from schemas.user_photo import UserPhotoCreate, UserPhotoResponse
from models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_current_user_profile(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's profile"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get photos - handle errors gracefully
    photos = []
    try:
        photos_result = supabase.table("user_photos").select("*").eq("user_id", user_id).order("display_order").execute()
        photos = photos_result.data if photos_result.data else []
    except Exception:
        photos = []
    
    # Get sports - handle errors gracefully
    sports = []
    try:
        sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user_id).execute()
        if sports_result.data:
            for item in sports_result.data:
                if item.get("sports"):
                    sports.append(item["sports"])
    except Exception:
        sports = []
    
    # Get goals - handle errors gracefully
    goals = []
    try:
        goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user_id).execute()
        if goals_result.data:
            for item in goals_result.data:
                if item.get("goals"):
                    goals.append(item["goals"])
    except Exception:
        goals = []
    
    # Build response with safe defaults
    response = {
        **current_user,
        "sports": [{"id": s.get("id"), "name": s.get("name") or "Unknown", "icon": s.get("icon") or "🏃"} for s in sports if s.get("id")],
        "goals": [{"id": g.get("id"), "name": g.get("name") or "Unknown"} for g in goals if g.get("id")],
        "photos": [{"id": p.get("id"), "photo_url": p.get("photo_url") or "", "display_order": p.get("display_order", 0)} for p in photos if p.get("id")]
    }
    
    # Ensure all required fields have defaults
    if not response.get("full_name"):
        response["full_name"] = None
    if not response.get("avatar_url"):
        response["avatar_url"] = None
    if not response.get("cover_image_url"):
        response["cover_image_url"] = None
    if not response.get("bio"):
        response["bio"] = None
    if not response.get("location"):
        response["location"] = None
    if response.get("age") is None:
        response["age"] = None
    
    return response


@router.get("/search", response_model=List[UserProfile])
async def search_users(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50)
):
    """Search for users by name, location, or bio"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    # Search in Supabase - we'll need to filter in Python since Supabase doesn't support OR directly
    try:
        # Get all active users and filter in Python
        users_result = supabase.table("users").select("*").eq("is_active", True).limit(limit * 3).execute()
        users = users_result.data if users_result.data else []
    except Exception:
        users = []
    
    # Filter by search term (name, location, or bio)
    search_lower = q.lower()
    filtered_users = [
        u for u in users
        if search_lower in (u.get("full_name") or "").lower() or
           search_lower in (u.get("location") or "").lower() or
           search_lower in (u.get("bio") or "").lower()
    ][:limit]
    
    result = []
    for user in filtered_users:
        user_id = user.get("id")
        
        # Get sports
        sports = []
        try:
            sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user_id).execute()
            if sports_result.data:
                for item in sports_result.data:
                    if item.get("sports"):
                        sports.append(item["sports"])
        except Exception:
            pass
        
        # Get goals
        goals = []
        try:
            goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user_id).execute()
            if goals_result.data:
                for item in goals_result.data:
                    if item.get("goals"):
                        goals.append(item["goals"])
        except Exception:
            pass
        
        result.append({
            **{k: v for k, v in user.items() if k not in ["sports", "goals"]},
            "sports": [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in sports],
            "goals": [{"id": g.get("id"), "name": g.get("name")} for g in goals]
        })
    
    return result


@router.get("/{user_id}", response_model=UserProfile)
async def get_user_profile(
    user_id: int
):
    """Get a user's profile by ID"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    try:
        user_result = supabase.table("users").select("*").eq("id", user_id).single().execute()
        if not user_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        user = user_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get sports
    sports = []
    try:
        sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user_id).execute()
        if sports_result.data:
            for item in sports_result.data:
                if item.get("sports"):
                    sports.append(item["sports"])
    except Exception:
        pass
    
    # Get goals
    goals = []
    try:
        goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user_id).execute()
        if goals_result.data:
            for item in goals_result.data:
                if item.get("goals"):
                    goals.append(item["goals"])
    except Exception:
        pass
    
    return {
        **{k: v for k, v in user.items() if k not in ["sports", "goals"]},
        "sports": [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in sports],
        "goals": [{"id": g.get("id"), "name": g.get("name")} for g in goals]
    }


@router.put("/me", response_model=UserProfile)
async def update_user_profile(
    user_update: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's profile"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    update_data = user_update.dict(exclude_unset=True)
    
    # Handle sports and goals separately
    sport_ids = update_data.pop("sport_ids", None)
    goal_ids = update_data.pop("goal_ids", None)
    
    # Update basic fields in users table
    if update_data:
        result = supabase.table("users").update(update_data).eq("id", user_id).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update user")
        current_user = result.data[0]
    
    # Update sports
    if sport_ids is not None:
        # Delete existing user_sports
        supabase.table("user_sports").delete().eq("user_id", user_id).execute()
        # Insert new user_sports
        if sport_ids:
            user_sports_data = [{"user_id": user_id, "sport_id": sid} for sid in sport_ids]
            supabase.table("user_sports").insert(user_sports_data).execute()
    
    # Update goals
    if goal_ids is not None:
        # Delete existing user_goals
        supabase.table("user_goals").delete().eq("user_id", user_id).execute()
        # Insert new user_goals
        if goal_ids:
            user_goals_data = [{"user_id": user_id, "goal_id": gid} for gid in goal_ids]
            supabase.table("user_goals").insert(user_goals_data).execute()
    
    # Get updated user with relations
    return await get_current_user_profile(current_user=current_user)


@router.post("/me/photos", response_model=UserPhotoResponse, status_code=status.HTTP_201_CREATED)
async def add_user_photo(
    photo_data: UserPhotoCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add a photo to user's profile"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Check photo limit (4 photos max)
    existing_photos = supabase.table("user_photos").select("*").eq("user_id", user_id).execute()
    existing_count = len(existing_photos.data) if existing_photos.data else 0
    if existing_count >= 4:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 4 photos allowed"
        )
    
    # Insert new photo
    new_photo_data = {
        "user_id": user_id,
        "photo_url": photo_data.photo_url,
        "display_order": photo_data.display_order or existing_count
    }
    result = supabase.table("user_photos").insert(new_photo_data).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add photo"
        )
    
    return UserPhotoResponse(**result.data[0])


@router.delete("/me/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_photo(
    photo_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a user photo"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    try:
        # Get photo and verify it belongs to user
        photo_result = supabase.table("user_photos").select("id, user_id").eq("id", photo_id).eq("user_id", user_id).single().execute()
        if not photo_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Photo not found"
            )
        
        # Delete photo
        supabase.table("user_photos").delete().eq("id", photo_id).eq("user_id", user_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete photo: {str(e)}"
        )


@router.post("/me/complete-profile", response_model=UserProfile)
async def complete_profile(
    request: CompleteProfileRequest,
    current_user: dict = Depends(get_current_user)
):
    """Complete profile onboarding - only name and age are required"""
    is_discoverable = request.is_discoverable
    
    # Check minimum requirements
    if not current_user.get("full_name"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Full name is required"
        )
    
    if not current_user.get("age"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Age is required"
        )
    
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Update profile
    result = supabase.table("users").update({
        "is_discoverable": is_discoverable,
        "profile_completed": True
    }).eq("id", user_id).execute()
    
    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete profile"
        )
    
    # Get updated user with relations
    return await get_current_user_profile(current_user=result.data[0])

