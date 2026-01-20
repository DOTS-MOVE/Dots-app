from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from typing import List, Optional
from datetime import datetime
import random
from core.database import get_supabase
from api.auth import get_current_user
from schemas.buddy import BuddyResponse, BuddyDetail, BuddyRequest, BuddyUpdate
from services.buddying import find_potential_buddies, create_buddy_request, calculate_buddy_score

router = APIRouter(prefix="/buddies", tags=["buddies"])


@router.get("/suggested", response_model=List[dict])
async def get_suggested_buddies(
    limit: int = Query(10, ge=1, le=50),
    min_score: float = Query(20.0, ge=0.0, le=100.0),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_current_user)
):
    """Get suggested buddies for current user with pagination"""
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
    
    # Check if user is discoverable
    if not current_user.get("is_discoverable", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must enable discovery to find buddies"
        )
    
    # Get current user's sports and goals for score calculation
    try:
        current_user_sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user_id).execute()
        current_user["sports"] = []
        if current_user_sports_result.data:
            for item in current_user_sports_result.data:
                if item.get("sports"):
                    current_user["sports"].append(item["sports"])
    except Exception:
        current_user["sports"] = []
    
    try:
        current_user_goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user_id).execute()
        current_user["goals"] = []
        if current_user_goals_result.data:
            for item in current_user_goals_result.data:
                if item.get("goals"):
                    current_user["goals"].append(item["goals"])
    except Exception:
        current_user["goals"] = []
    
    # Get all potential buddies using the service (no score filtering - show all discoverable users)
    all_buddies = find_potential_buddies(current_user, supabase, limit=None, min_score=0.0)
    
    # Apply offset and limit for pagination
    paginated_buddies = all_buddies[offset:offset + limit]
    
    result = []
    for m in paginated_buddies:
        user = m["user"]
        
        # Get recent events (last 3 events user attended/RSVPed to)
        recent_events = []
        try:
            rsvps_result = supabase.table("event_rsvps").select("event_id, events(*)").eq("user_id", user["id"]).eq("status", "approved").order("rsvp_at", desc=True).limit(3).execute()
            if rsvps_result.data:
                for rsvp in rsvps_result.data:
                    event = rsvp.get("events")
                    if event:
                        # Get sport info
                        sport_data = None
                        if event.get("sport_id"):
                            try:
                                sport_result = supabase.table("sports").select("*").eq("id", event["sport_id"]).single().execute()
                                if sport_result.data:
                                    sport_data = {
                                        "id": sport_result.data.get("id"),
                                        "name": sport_result.data.get("name") or "Unknown Sport",
                                        "icon": sport_result.data.get("icon") or "🏃"
                                    }
                            except Exception:
                                pass
                        
                        recent_events.append({
                            "id": event.get("id"),
                            "title": event.get("title"),
                            "sport": sport_data,
                            "start_time": event.get("start_time"),
                        })
        except Exception:
            recent_events = []
        
        # Calculate badges
        badges = []
        event_count = 0
        try:
            event_count_result = supabase.table("event_rsvps").select("id", count="exact").eq("user_id", user["id"]).eq("status", "approved").execute()
            event_count = event_count_result.count if event_count_result.count is not None else 0
        except Exception:
            event_count = 0
        
        if event_count >= 10:
            badges.append({"name": "Event Veteran", "icon": "🏆"})
        elif event_count >= 5:
            badges.append({"name": "Active Member", "icon": "⭐"})
        elif event_count >= 1:
            badges.append({"name": "Getting Started", "icon": "🌱"})
        
        user_sports = user.get("sports", [])
        if len(user_sports) >= 5:
            badges.append({"name": "Multi-Sport", "icon": "🎯"})
        
        # Generate multiple photos for the user
        num_photos = random.randint(3, 5)
        base_seed = abs(hash(user.get("email", str(user["id"])))) % 100000
        photos = []
        for i in range(num_photos):
            photos.append(f"https://picsum.photos/seed/{base_seed + i}/400/600")
        
        result.append({
            "user": {
                "id": user["id"],
                "full_name": user.get("full_name"),
                "age": user.get("age"),
                "location": user.get("location"),
                "avatar_url": user.get("avatar_url"),
                "bio": user.get("bio"),
                "sports": user.get("sports", []),
                "goals": user.get("goals", []),
                "recent_events": recent_events,
                "badges": badges,
                "event_count": event_count,
                "photos": photos
            },
            "score": m["score"]
        })
    
    return result


@router.post("", response_model=BuddyResponse, status_code=status.HTTP_201_CREATED)
async def create_buddy(
    buddy_request: BuddyRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a buddy request"""
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
    
    if buddy_request.user2_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot buddy with yourself"
        )
    
    # Verify user2 exists
    try:
        user2_result = supabase.table("users").select("*").eq("id", buddy_request.user2_id).single().execute()
        if not user2_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if buddy already exists
    try:
        # Check both directions: user1->user2 and user2->user1
        existing1 = supabase.table("buddies").select("*").eq("user1_id", user_id).eq("user2_id", buddy_request.user2_id).execute()
        existing2 = supabase.table("buddies").select("*").eq("user1_id", buddy_request.user2_id).eq("user2_id", user_id).execute()
        
        if (existing1.data and len(existing1.data) > 0) or (existing2.data and len(existing2.data) > 0):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Buddy already exists"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        # If query fails, continue (might be a connection issue)
        pass
    
    # Calculate match score
    try:
        score = calculate_buddy_score(current_user, user2_result.data, supabase)
    except Exception:
        score = 50.0  # Default score if calculation fails
    
    # Create buddy request
    try:
        buddy_result = supabase.table("buddies").insert({
            "user1_id": user_id,
            "user2_id": buddy_request.user2_id,
            "match_score": score,
            "status": "pending"
        }).execute()
        
        if not buddy_result.data or len(buddy_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create buddy request"
            )
        
        new_buddy = buddy_result.data[0]
        return BuddyResponse(
            id=new_buddy["id"],
            user1_id=new_buddy["user1_id"],
            user2_id=new_buddy["user2_id"],
            match_score=new_buddy.get("match_score"),
            status=new_buddy.get("status", "pending"),
            created_at=datetime.fromisoformat(new_buddy["created_at"].replace("Z", "+00:00")) if isinstance(new_buddy.get("created_at"), str) else new_buddy.get("created_at")
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create buddy request: {str(e)}"
        )


@router.get("", response_model=List[BuddyDetail])
async def list_buddies(
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: dict = Depends(get_current_user)
):
    """List all buddies for current user"""
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
    
    # Get all buddies where user is user1 or user2
    try:
        # Get buddies where user is user1
        buddies1_result = supabase.table("buddies").select("*").eq("user1_id", user_id).execute()
        buddies1 = buddies1_result.data if buddies1_result.data else []
        
        # Get buddies where user is user2
        buddies2_result = supabase.table("buddies").select("*").eq("user2_id", user_id).execute()
        buddies2 = buddies2_result.data if buddies2_result.data else []
        
        # Combine and deduplicate
        all_buddies = buddies1 + buddies2
        buddy_ids = set()
        buddies = []
        for buddy in all_buddies:
            if buddy["id"] not in buddy_ids:
                if not status_filter or buddy.get("status") == status_filter:
                    buddies.append(buddy)
                    buddy_ids.add(buddy["id"])
    except Exception:
        buddies = []
    
    result = []
    for buddy in buddies:
        # Determine which user is the other user
        other_user_id = buddy["user2_id"] if buddy["user1_id"] == user_id else buddy["user1_id"]
        
        # Get user1 and user2 data
        try:
            user1_result = supabase.table("users").select("id, full_name, age, location, avatar_url, bio").eq("id", buddy["user1_id"]).single().execute()
            user1_data = user1_result.data if user1_result.data else {}
        except Exception:
            user1_data = {"id": buddy["user1_id"], "full_name": "Unknown", "age": None, "location": None, "avatar_url": None, "bio": None}
        
        try:
            user2_result = supabase.table("users").select("id, full_name, age, location, avatar_url, bio").eq("id", buddy["user2_id"]).single().execute()
            user2_data = user2_result.data if user2_result.data else {}
        except Exception:
            user2_data = {"id": buddy["user2_id"], "full_name": "Unknown", "age": None, "location": None, "avatar_url": None, "bio": None}
        
        # Get sports and goals for both users
        try:
            user1_sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", buddy["user1_id"]).execute()
            user1_sports = []
            if user1_sports_result.data:
                for item in user1_sports_result.data:
                    if item.get("sports"):
                        user1_sports.append(item["sports"])
        except Exception:
            user1_sports = []
        
        try:
            user2_sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", buddy["user2_id"]).execute()
            user2_sports = []
            if user2_sports_result.data:
                for item in user2_sports_result.data:
                    if item.get("sports"):
                        user2_sports.append(item["sports"])
        except Exception:
            user2_sports = []
        
        try:
            user1_goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", buddy["user1_id"]).execute()
            user1_goals = []
            if user1_goals_result.data:
                for item in user1_goals_result.data:
                    if item.get("goals"):
                        user1_goals.append(item["goals"])
        except Exception:
            user1_goals = []
        
        try:
            user2_goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", buddy["user2_id"]).execute()
            user2_goals = []
            if user2_goals_result.data:
                for item in user2_goals_result.data:
                    if item.get("goals"):
                        user2_goals.append(item["goals"])
        except Exception:
            user2_goals = []
        
        result.append(BuddyDetail(
            id=buddy["id"],
            user1_id=buddy["user1_id"],
            user2_id=buddy["user2_id"],
            match_score=buddy.get("match_score"),
            status=buddy.get("status", "pending"),
            created_at=datetime.fromisoformat(buddy["created_at"].replace("Z", "+00:00")) if isinstance(buddy.get("created_at"), str) else buddy.get("created_at"),
            user1={
                "id": user1_data.get("id"),
                "full_name": user1_data.get("full_name") or "Unknown",
                "age": user1_data.get("age"),
                "location": user1_data.get("location"),
                "avatar_url": user1_data.get("avatar_url"),
                "bio": user1_data.get("bio"),
                "sports": [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in user1_sports],
                "goals": [{"id": g.get("id"), "name": g.get("name")} for g in user1_goals]
            },
            user2={
                "id": user2_data.get("id"),
                "full_name": user2_data.get("full_name") or "Unknown",
                "age": user2_data.get("age"),
                "location": user2_data.get("location"),
                "avatar_url": user2_data.get("avatar_url"),
                "bio": user2_data.get("bio"),
                "sports": [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in user2_sports],
                "goals": [{"id": g.get("id"), "name": g.get("name")} for g in user2_goals]
            }
        ))
    
    return result


@router.delete("/{buddy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_buddy(
    buddy_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a buddy (remove from buddies)"""
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
    
    # Get buddy and verify user is part of it
    try:
        buddy_result = supabase.table("buddies").select("*").eq("id", buddy_id).single().execute()
        if not buddy_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Buddy not found"
            )
        buddy = buddy_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Buddy not found"
        )
    
    # Only allow deletion if user is part of the buddy
    if buddy.get("user1_id") != user_id and buddy.get("user2_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this buddy"
        )
    
    # Delete buddy
    try:
        supabase.table("buddies").delete().eq("id", buddy_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete buddy: {str(e)}"
        )
    
    return None


@router.put("/{buddy_id}", response_model=BuddyResponse)
async def update_buddy(
    buddy_id: int,
    buddy_update: BuddyUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update buddy status (accept/reject)"""
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
    
    # Get buddy
    try:
        buddy_result = supabase.table("buddies").select("*").eq("id", buddy_id).single().execute()
        if not buddy_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Buddy not found"
            )
        buddy = buddy_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Buddy not found"
        )
    
    # Only the receiver can update the buddy status
    if buddy.get("user2_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the receiver can update buddy status"
        )
    
    # Update buddy status
    try:
        updated_result = supabase.table("buddies").update({
            "status": buddy_update.status.value if hasattr(buddy_update.status, 'value') else str(buddy_update.status),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", buddy_id).execute()
        
        if not updated_result.data or len(updated_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update buddy"
            )
        
        updated_buddy = updated_result.data[0]
        return BuddyResponse(
            id=updated_buddy["id"],
            user1_id=updated_buddy["user1_id"],
            user2_id=updated_buddy["user2_id"],
            match_score=updated_buddy.get("match_score"),
            status=updated_buddy.get("status", "pending"),
            created_at=datetime.fromisoformat(updated_buddy["created_at"].replace("Z", "+00:00")) if isinstance(updated_buddy.get("created_at"), str) else updated_buddy.get("created_at")
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update buddy: {str(e)}"
        )
