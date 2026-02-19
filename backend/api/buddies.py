from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from typing import List, Optional
from datetime import datetime
import logging
from core.database import get_supabase
from api.auth import get_current_user
from schemas.buddy import BuddyResponse, BuddyDetail, BuddyRequest, BuddyUpdate
from services.buddying import find_potential_buddies, create_buddy_request, calculate_buddy_score

router = APIRouter(prefix="/buddies", tags=["buddies"])
logger = logging.getLogger(__name__)


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
    
    all_buddies = find_potential_buddies(current_user, supabase, limit=None, min_score=0.0)
    paginated_buddies = all_buddies[offset:offset + limit]
    if not paginated_buddies:
        return []

    user_ids = [m["user"]["id"] for m in paginated_buddies]

    # Batch: recent events (last 3 per user) – one rsvps query, then group by user
    recent_events_by_user = {uid: [] for uid in user_ids}
    sport_ids = set()
    try:
        rsvps_result = supabase.table("event_rsvps").select("user_id, event_id, rsvp_at, events(*)").in_("user_id", user_ids).eq("status", "approved").order("rsvp_at", desc=True).limit(500).execute()
        by_user = {}
        for r in (rsvps_result.data or []):
            uid = r.get("user_id")
            if uid is None:
                continue
            if uid not in by_user:
                by_user[uid] = []
            ev = r.get("events")
            if ev:
                by_user[uid].append({"event": ev, "rsvp_at": r.get("rsvp_at")})
                if ev.get("sport_id"):
                    sport_ids.add(ev["sport_id"])
        for uid, list_ in by_user.items():
            list_.sort(key=lambda x: x["rsvp_at"] or "", reverse=True)
            recent_events_by_user[uid] = [x["event"] for x in list_[:3]]
    except Exception:
        pass

    # Batch: sport names for events
    sports_by_id = {}
    if sport_ids:
        try:
            sport_result = supabase.table("sports").select("id, name, icon").in_("id", list(sport_ids)).execute()
            if sport_result.data:
                sports_by_id = {s["id"]: {"id": s.get("id"), "name": s.get("name") or "Unknown Sport", "icon": s.get("icon") or "🏃"} for s in sport_result.data}
        except Exception:
            pass

    # Batch: user photos
    photos_by_user = {uid: [] for uid in user_ids}
    try:
        photos_result = supabase.table("user_photos").select("user_id, photo_url, display_order").in_("user_id", user_ids).order("display_order").execute()
        for p in (photos_result.data or []):
            uid = p.get("user_id")
            url = p.get("photo_url")
            if uid is not None and url:
                photos_by_user.setdefault(uid, []).append(url)
    except Exception:
        pass

    result = []
    for m in paginated_buddies:
        user = m["user"]
        uid = user["id"]
        event_count = user.get("_event_count", 0)
        recent_raw = recent_events_by_user.get(uid, [])
        recent_events = []
        for event in recent_raw:
            sport_data = sports_by_id.get(event.get("sport_id")) if event.get("sport_id") else None
            recent_events.append({
                "id": event.get("id"),
                "title": event.get("title"),
                "sport": sport_data,
                "start_time": event.get("start_time"),
            })
        badges = []
        if event_count >= 10:
            badges.append({"name": "Event Veteran", "icon": "🏆"})
        elif event_count >= 5:
            badges.append({"name": "Active Member", "icon": "⭐"})
        elif event_count >= 1:
            badges.append({"name": "Getting Started", "icon": "🌱"})
        if len(user.get("sports", [])) >= 5:
            badges.append({"name": "Multi-Sport", "icon": "🎯"})
        photos = photos_by_user.get(uid, [])

        result.append({
            "user": {
                "id": uid,
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
        buddies1_result = supabase.table("buddies").select("*").eq("user1_id", user_id).execute()
        buddies1 = buddies1_result.data if buddies1_result.data else []
        buddies2_result = supabase.table("buddies").select("*").eq("user2_id", user_id).execute()
        buddies2 = buddies2_result.data if buddies2_result.data else []
        all_buddies = buddies1 + buddies2
        buddy_ids = set()
        buddies = []
        for buddy in all_buddies:
            if buddy["id"] not in buddy_ids and (not status_filter or buddy.get("status") == status_filter):
                buddies.append(buddy)
                buddy_ids.add(buddy["id"])
    except Exception:
        logger.exception(
            "Operational failure listing buddies",
            extra={
                "user_id": user_id,
                "status_filter": status_filter,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable"
        )

    if not buddies:
        return []

    # Batch fetch: collect all user ids
    user_ids = list(set(buddy["user1_id"] for buddy in buddies) | set(buddy["user2_id"] for buddy in buddies))

    # Single query for all users
    users_by_id = {}
    try:
        users_result = supabase.table("users").select("id, full_name, age, location, avatar_url, bio").in_("id", user_ids).execute()
        if users_result.data:
            users_by_id = {u["id"]: u for u in users_result.data}
    except Exception:
        pass

    # Single query for all user_sports (with sports joined)
    sports_by_user = {uid: [] for uid in user_ids}
    try:
        us_result = supabase.table("user_sports").select("user_id, sport_id, sports(*)").in_("user_id", user_ids).execute()
        if us_result.data:
            for item in us_result.data:
                uid = item.get("user_id")
                s = item.get("sports")
                if uid is not None and s:
                    sports_by_user.setdefault(uid, []).append(s)
    except Exception:
        pass

    # Single query for all user_goals (with goals joined)
    goals_by_user = {uid: [] for uid in user_ids}
    try:
        ug_result = supabase.table("user_goals").select("user_id, goal_id, goals(*)").in_("user_id", user_ids).execute()
        if ug_result.data:
            for item in ug_result.data:
                uid = item.get("user_id")
                g = item.get("goals")
                if uid is not None and g:
                    goals_by_user.setdefault(uid, []).append(g)
    except Exception:
        pass

    def user_detail(uid):
        u = users_by_id.get(uid) or {"id": uid, "full_name": "Unknown", "age": None, "location": None, "avatar_url": None, "bio": None}
        sports = sports_by_user.get(uid) or []
        goals = goals_by_user.get(uid) or []
        return {
            "id": u.get("id"),
            "full_name": u.get("full_name") or "Unknown",
            "age": u.get("age"),
            "location": u.get("location"),
            "avatar_url": u.get("avatar_url"),
            "bio": u.get("bio"),
            "sports": [{"id": s.get("id"), "name": s.get("name"), "icon": s.get("icon")} for s in sports],
            "goals": [{"id": g.get("id"), "name": g.get("name")} for g in goals]
        }

    result = []
    for buddy in buddies:
        result.append(BuddyDetail(
            id=buddy["id"],
            user1_id=buddy["user1_id"],
            user2_id=buddy["user2_id"],
            match_score=buddy.get("match_score"),
            status=buddy.get("status", "pending"),
            created_at=datetime.fromisoformat(buddy["created_at"].replace("Z", "+00:00")) if isinstance(buddy.get("created_at"), str) else buddy.get("created_at"),
            user1=user_detail(buddy["user1_id"]),
            user2=user_detail(buddy["user2_id"])
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
