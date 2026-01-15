from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from typing import Optional, List
from datetime import datetime
from core.database import get_supabase
from api.auth import get_current_user
from schemas.event import EventCreate, EventUpdate, EventResponse, EventDetail

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    event_data: EventCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new event"""
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
    
    # Verify sport exists
    try:
        sport_result = supabase.table("sports").select("*").eq("id", event_data.sport_id).single().execute()
        if not sport_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sport not found"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sport not found"
        )
    
    # Create event in Supabase
    event_dict = event_data.dict()
    event_dict['host_id'] = user_id
    event_dict['is_cancelled'] = False
    event_dict['is_public'] = event_dict.get('is_public', True)
    # cover_image_url is included in event_dict from event_data if provided
    
    try:
        event_result = supabase.table("events").insert(event_dict).execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create event"
            )
        new_event = event_result.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create event: {str(e)}"
        )
    
    # Host automatically RSVPs with approved status
    try:
        supabase.table("event_rsvps").insert({
            "event_id": new_event["id"],
            "user_id": user_id,
            "status": "approved",
            "attended": False
        }).execute()
    except Exception as e:
        # If RSVP fails, we still return the event (it was created)
        pass
    
    # Get sport info for response
    sport_data = {
        "id": sport_result.data.get("id"),
        "name": sport_result.data.get("name") or "Unknown Sport",
        "icon": sport_result.data.get("icon") or "🏃"
    }
    
    return EventResponse(
        id=new_event["id"],
        title=new_event["title"],
        description=new_event.get("description"),
        location=new_event.get("location"),
        start_time=new_event["start_time"],
        end_time=new_event.get("end_time"),
        sport_id=new_event.get("sport_id"),
        host_id=new_event.get("host_id"),
        max_participants=new_event.get("max_participants"),
        is_cancelled=new_event.get("is_cancelled", False),
        is_public=new_event.get("is_public", True),
        image_url=new_event.get("image_url"),
        cover_image_url=new_event.get("cover_image_url"),
        created_at=new_event.get("created_at"),
        updated_at=new_event.get("updated_at"),
        participant_count=1,
        pending_requests_count=0,
        sport=sport_data
    )


@router.get("", response_model=List[EventResponse])
async def list_events(
    sport_id: Optional[int] = Query(None),
    location: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None)
):
    """List events with optional filtering"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    # Build query
    query = supabase.table("events").select("*").eq("is_cancelled", False)
    
    if sport_id:
        query = query.eq("sport_id", sport_id)
    
    if location:
        query = query.ilike("location", f"%{location}%")
    
    if start_date:
        query = query.gte("start_time", start_date.isoformat())
    
    if end_date:
        query = query.lte("start_time", end_date.isoformat())
    
    if search:
        # Supabase doesn't support OR directly, so we'll filter in Python
        pass
    
    try:
        events_result = query.order("start_time").execute()
        events = events_result.data if events_result.data else []
    except Exception:
        events = []
    
    # Apply search filter if provided
    if search:
        search_lower = search.lower()
        events = [e for e in events if 
                  search_lower in (e.get("title") or "").lower() or
                  search_lower in (e.get("description") or "").lower() or
                  search_lower in (e.get("location") or "").lower()]
    
    result = []
    for event in events:
        event_id = event.get("id")
        if not event_id:
            continue
        
        # Get participant count (approved RSVPs)
        participant_count = 0
        try:
            participant_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "approved").execute()
            participant_count = participant_result.count if participant_result.count is not None else 0
        except Exception:
            participant_count = 0
        
        # Get pending count
        pending_count = 0
        try:
            pending_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "pending").execute()
            pending_count = pending_result.count if pending_result.count is not None else 0
        except Exception:
            pending_count = 0
        
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
                sport_data = {
                    "id": event.get("sport_id"),
                    "name": "Unknown Sport",
                    "icon": "🏃"
                }
        
        result.append(EventResponse(
            id=event["id"],
            title=event["title"],
            description=event.get("description"),
            location=event.get("location"),
            start_time=event["start_time"],
            end_time=event.get("end_time"),
            sport_id=event.get("sport_id"),
            host_id=event.get("host_id"),
            max_participants=event.get("max_participants"),
            is_cancelled=event.get("is_cancelled", False),
            is_public=event.get("is_public", True),
            image_url=event.get("image_url"),
            cover_image_url=event.get("cover_image_url"),
            created_at=event.get("created_at"),
            updated_at=event.get("updated_at"),
            participant_count=participant_count,
            pending_requests_count=pending_count,
            sport=sport_data
        ))
    
    return result


@router.get("/{event_id}", response_model=EventDetail)
async def get_event(
    event_id: int
):
    """Get event details"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    # Get event
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Get approved participants
    participants = []
    try:
        rsvps_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
        if rsvps_result.data:
            participant_ids = [r["user_id"] for r in rsvps_result.data]
            if participant_ids:
                users_result = supabase.table("users").select("id, full_name, avatar_url, location").in_("id", participant_ids).execute()
                if users_result.data:
                    participants = users_result.data
    except Exception:
        participants = []
    
    participant_count = len(participants)
    
    # Get host info
    host_data = None
    if event.get("host_id"):
        try:
            host_result = supabase.table("users").select("id, full_name, avatar_url, location").eq("id", event["host_id"]).single().execute()
            if host_result.data:
                host_data = host_result.data
        except Exception:
            host_data = {"id": event.get("host_id"), "full_name": "Unknown", "avatar_url": None, "location": None}
    
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
            sport_data = {"id": event.get("sport_id"), "name": "Unknown Sport", "icon": "🏃"}
    
    return EventDetail(
        id=event["id"],
        title=event["title"],
        description=event.get("description"),
        location=event.get("location"),
        start_time=event["start_time"],
        end_time=event.get("end_time"),
        sport_id=event.get("sport_id"),
        host_id=event.get("host_id"),
        max_participants=event.get("max_participants"),
        is_cancelled=event.get("is_cancelled", False),
        is_public=event.get("is_public", True),
        image_url=event.get("image_url"),
        cover_image_url=event.get("cover_image_url"),
        created_at=event.get("created_at"),
        updated_at=event.get("updated_at"),
        participant_count=participant_count,
        host=host_data or {"id": event.get("host_id"), "full_name": "Unknown", "avatar_url": None, "location": None},
        sport=sport_data or {"id": event.get("sport_id"), "name": "Unknown Sport", "icon": "🏃"},
        participants=participants
    )


@router.put("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_update: EventUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an event (host only)"""
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
    
    # Get event
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is host
    if event.get("host_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can update this event"
        )
    
    # Update event
    update_data = event_update.dict(exclude_unset=True)
    try:
        updated_result = supabase.table("events").update(update_data).eq("id", event_id).execute()
        if not updated_result.data:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update event"
            )
        updated_event = updated_result.data[0]
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update event: {str(e)}"
        )
    
    # Get participant and pending counts
    participant_count = 0
    pending_count = 0
    try:
        participant_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "approved").execute()
        participant_count = participant_result.count if participant_result.count is not None else 0
    except Exception:
        participant_count = 0
    
    try:
        pending_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "pending").execute()
        pending_count = pending_result.count if pending_result.count is not None else 0
    except Exception:
        pending_count = 0
    
    # Get sport info
    sport_data = None
    if updated_event.get("sport_id"):
        try:
            sport_result = supabase.table("sports").select("*").eq("id", updated_event["sport_id"]).single().execute()
            if sport_result.data:
                sport_data = {
                    "id": sport_result.data.get("id"),
                    "name": sport_result.data.get("name") or "Unknown Sport",
                    "icon": sport_result.data.get("icon") or "🏃"
                }
        except Exception:
            sport_data = {"id": updated_event.get("sport_id"), "name": "Unknown Sport", "icon": "🏃"}
    
    return EventResponse(
        id=updated_event["id"],
        title=updated_event["title"],
        description=updated_event.get("description"),
        location=updated_event.get("location"),
        start_time=updated_event["start_time"],
        end_time=updated_event.get("end_time"),
        sport_id=updated_event.get("sport_id"),
        host_id=updated_event.get("host_id"),
        max_participants=updated_event.get("max_participants"),
        is_cancelled=updated_event.get("is_cancelled", False),
        is_public=updated_event.get("is_public", True),
        image_url=updated_event.get("image_url"),
        cover_image_url=updated_event.get("cover_image_url"),
        created_at=updated_event.get("created_at"),
        updated_at=updated_event.get("updated_at"),
        participant_count=participant_count,
        pending_requests_count=pending_count,
        sport=sport_data
    )


@router.post("/{event_id}/rsvp", response_model=EventDetail)
async def rsvp_event(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """RSVP to an event"""
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
    
    # Get event
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    if event.get("is_cancelled"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Event is cancelled"
        )
    
    # Check if already RSVP'd
    try:
        existing_result = supabase.table("event_rsvps").select("*").eq("event_id", event_id).eq("user_id", user_id).execute()
        if existing_result.data and len(existing_result.data) > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Already RSVP'd to this event"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        # If query fails, continue (might be a connection issue)
        pass
    
    # Check max participants (only for approved RSVPs)
    if event.get("max_participants"):
        try:
            current_count_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "approved").execute()
            current_count = current_count_result.count if current_count_result.count is not None else 0
            if current_count >= event.get("max_participants"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Event is full"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            # If query fails, continue (might be a connection issue)
            pass
    
    # For public events, auto-approve. For private events, set to pending
    rsvp_status = "approved" if event.get("is_public", True) else "pending"
    
    # Create RSVP
    try:
        supabase.table("event_rsvps").insert({
            "event_id": event_id,
            "user_id": user_id,
            "status": rsvp_status,
            "attended": False
        }).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to RSVP: {str(e)}"
        )
    
    return await get_event(event_id)


@router.delete("/{event_id}/rsvp", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_rsvp(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Cancel RSVP to an event"""
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
        supabase.table("event_rsvps").delete().eq("event_id", event_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel RSVP: {str(e)}"
        )
    
    return None


@router.get("/user/me", response_model=dict)
async def get_my_events(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's events: owned, attending, and attended"""
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
    
    def format_event(event_data):
        if not event_data or not event_data.get("id"):
            return None
        
        event_id = event_data["id"]
        
        # Get participant count (approved RSVPs) - handle errors gracefully
        participant_count = 0
        try:
            participant_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "approved").execute()
            participant_count = participant_result.count if participant_result.count is not None else 0
        except Exception:
            participant_count = 0
        
        # Get pending count - handle errors gracefully
        pending_count = 0
        try:
            pending_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "pending").execute()
            pending_count = pending_result.count if pending_result.count is not None else 0
        except Exception:
            pending_count = 0
        
        # Get sport info (with error handling for missing sports)
        sport_data = None
        if event_data.get("sport_id"):
            try:
                sport_result = supabase.table("sports").select("*").eq("id", event_data["sport_id"]).single().execute()
                if sport_result.data:
                    sport_data = {
                        "id": sport_result.data.get("id"),
                        "name": sport_result.data.get("name") or "Unknown Sport",
                        "icon": sport_result.data.get("icon") or "🏃"
                    }
            except Exception:
                # Sport not found, use defaults
                sport_data = {
                    "id": event_data.get("sport_id"),
                    "name": "Unknown Sport",
                    "icon": "🏃"
                }
        
        return EventResponse(
            id=event_data["id"],
            title=event_data["title"],
            description=event_data.get("description"),
            location=event_data.get("location"),
            start_time=event_data["start_time"],
            end_time=event_data.get("end_time"),
            sport_id=event_data.get("sport_id"),
            host_id=event_data.get("host_id"),
            max_participants=event_data.get("max_participants"),
            is_cancelled=event_data.get("is_cancelled", False),
            is_public=event_data.get("is_public", True),
            image_url=event_data.get("image_url"),
            cover_image_url=event_data.get("cover_image_url"),
            created_at=event_data.get("created_at"),
            updated_at=event_data.get("updated_at"),
            participant_count=participant_count,
            pending_requests_count=pending_count,
            sport=sport_data
        )
    
    # Get events owned by user - handle errors gracefully
    owned_events = []
    try:
        owned_result = supabase.table("events").select("*").eq("host_id", user_id).order("start_time", desc=True).execute()
        owned_events = [format_event(e) for e in (owned_result.data or []) if format_event(e) is not None]
    except Exception:
        owned_events = []
    
    # Get events user is attending (RSVP'd but not yet attended, and not owned)
    # First get all RSVPs for this user - handle errors gracefully
    attending_event_ids = []
    attended_event_ids = []
    
    try:
        rsvps_result = supabase.table("event_rsvps").select("event_id, attended, status").eq("user_id", user_id).execute()
        
        if rsvps_result.data:
            for rsvp in rsvps_result.data:
                if rsvp.get("attended"):
                    attended_event_ids.append(rsvp["event_id"])
                else:
                    attending_event_ids.append(rsvp["event_id"])
    except Exception:
        # If RSVPs query fails, just use empty lists
        pass
    
    # Get attending events (exclude owned) - handle errors gracefully
    attending_events = []
    if attending_event_ids:
        try:
            attending_result = supabase.table("events").select("*").in_("id", attending_event_ids).neq("host_id", user_id).order("start_time", desc=False).execute()
            attending_events = [format_event(e) for e in (attending_result.data or []) if format_event(e) is not None]
        except Exception:
            attending_events = []
    
    # Get attended events - handle errors gracefully
    attended_events = []
    if attended_event_ids:
        try:
            attended_result = supabase.table("events").select("*").in_("id", attended_event_ids).order("start_time", desc=True).execute()
            attended_events = [format_event(e) for e in (attended_result.data or []) if format_event(e) is not None]
        except Exception:
            attended_events = []
    
    return {
        "owned": owned_events,
        "attending": attending_events,
        "attended": attended_events
    }


@router.get("/{event_id}/rsvps", response_model=dict)
async def get_event_rsvps(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get all RSVPs for an event (host only)"""
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
    
    # Get event and verify user is host
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is host
    if event.get("host_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can view RSVPs"
        )
    
    # Get all RSVPs
    approved_users = []
    pending_users = []
    rejected_users = []
    
    try:
        rsvps_result = supabase.table("event_rsvps").select("user_id, status").eq("event_id", event_id).execute()
        if rsvps_result.data:
            approved_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "approved"]
            pending_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "pending"]
            rejected_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "rejected"]
            
            # Get user info for each status
            if approved_ids:
                approved_result = supabase.table("users").select("id, full_name, avatar_url, location").in_("id", approved_ids).execute()
                if approved_result.data:
                    approved_users = approved_result.data
            
            if pending_ids:
                pending_result = supabase.table("users").select("id, full_name, avatar_url, location").in_("id", pending_ids).execute()
                if pending_result.data:
                    pending_users = pending_result.data
            
            if rejected_ids:
                rejected_result = supabase.table("users").select("id, full_name, avatar_url, location").in_("id", rejected_ids).execute()
                if rejected_result.data:
                    rejected_users = rejected_result.data
    except Exception as e:
        # If query fails, return empty lists
        pass
    
    return {
        "approved": approved_users,
        "pending": pending_users,
        "rejected": rejected_users
    }


@router.post("/{event_id}/rsvps/{user_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
async def approve_rsvp(
    event_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Approve a pending RSVP (host only)"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    current_user_id = current_user.get("id")
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Get event and verify user is host
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is host
    if event.get("host_id") != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can approve RSVPs"
        )
    
    # Check if RSVP exists
    try:
        rsvp_result = supabase.table("event_rsvps").select("*").eq("event_id", event_id).eq("user_id", user_id).single().execute()
        if not rsvp_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="RSVP not found"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RSVP not found"
        )
    
    # Check max participants before approving
    if event.get("max_participants"):
        try:
            current_count_result = supabase.table("event_rsvps").select("id", count="exact").eq("event_id", event_id).eq("status", "approved").execute()
            current_count = current_count_result.count if current_count_result.count is not None else 0
            if current_count >= event.get("max_participants"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Event is full"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            # If query fails, continue (might be a connection issue)
            pass
    
    # Update RSVP status to approved
    try:
        supabase.table("event_rsvps").update({"status": "approved"}).eq("event_id", event_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve RSVP: {str(e)}"
        )
    
    return None


@router.post("/{event_id}/rsvps/{user_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_rsvp(
    event_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Reject a pending RSVP (host only)"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    current_user_id = current_user.get("id")
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Get event and verify user is host
    try:
        event_result = supabase.table("events").select("*").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )
    
    # Check if user is host
    if event.get("host_id") != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can reject RSVPs"
        )
    
    # Check if RSVP exists
    try:
        rsvp_result = supabase.table("event_rsvps").select("*").eq("event_id", event_id).eq("user_id", user_id).single().execute()
        if not rsvp_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="RSVP not found"
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="RSVP not found"
        )
    
    # Update RSVP status to rejected
    try:
        supabase.table("event_rsvps").update({"status": "rejected"}).eq("event_id", event_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject RSVP: {str(e)}"
        )
    
    return None
