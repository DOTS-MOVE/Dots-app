from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from typing import Optional, List
from datetime import datetime
from core.database import get_supabase
from api.auth import get_current_user, get_current_user_optional
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
    
    # Convert datetime objects to ISO format strings for Supabase
    if isinstance(event_dict.get('start_time'), datetime):
        event_dict['start_time'] = event_dict['start_time'].isoformat()
    if isinstance(event_dict.get('end_time'), datetime):
        event_dict['end_time'] = event_dict['end_time'].isoformat()
    
    # Set image_url from cover_image_url if provided (for backwards compatibility)
    if event_dict.get('cover_image_url') and not event_dict.get('image_url'):
        event_dict['image_url'] = event_dict['cover_image_url']
    
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
    
    # Get participant count (exclude host)
    participant_count = 0
    host_id = new_event.get("host_id")
    try:
        participant_result = supabase.table("event_rsvps").select("id").eq("event_id", new_event["id"]).eq("status", "approved").execute()
        if participant_result.data:
            # Count participants excluding the host
            participants = [r for r in participant_result.data if r.get("user_id") != host_id]
            participant_count = len(participants)
    except Exception:
        participant_count = 0

    # Get host info
    host_data = None
    if host_id:
        try:
            host_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", host_id).single().execute()
            if host_result.data:
                host_data = {
                    "id": host_result.data.get("id"),
                    "full_name": host_result.data.get("full_name") or "Unknown",
                    "avatar_url": host_result.data.get("avatar_url")
                }
        except Exception:
            host_data = {
                "id": host_id,
                "full_name": "Unknown",
                "avatar_url": None
            }

    return EventResponse(
        id=new_event["id"],
        title=new_event["title"],
        description=new_event.get("description"),
        location=new_event.get("location"),
        start_time=new_event["start_time"],
        end_time=new_event.get("end_time"),
        sport_id=new_event.get("sport_id"),
        host_id=host_id,
        max_participants=new_event.get("max_participants"),
        is_cancelled=new_event.get("is_cancelled", False),
        is_public=new_event.get("is_public", True),
        image_url=new_event.get("image_url"),
        cover_image_url=new_event.get("cover_image_url"),
        created_at=new_event.get("created_at"),
        updated_at=new_event.get("updated_at"),
        participant_count=participant_count,
        pending_requests_count=0,
        sport=sport_data,
        host=host_data
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
    
    if not events:
        return []
    
    event_ids = [e["id"] for e in events if e.get("id") is not None]
    sport_ids = list({e.get("sport_id") for e in events if e.get("sport_id") is not None})
    host_ids = list({e.get("host_id") for e in events if e.get("host_id") is not None})
    
    rsvps_by_event = {}
    sports_by_id = {}
    hosts_by_id = {}
    
    if event_ids:
        try:
            rsvps_result = supabase.table("event_rsvps").select("event_id, user_id, status").in_("event_id", event_ids).execute()
            for r in (rsvps_result.data or []):
                eid = r.get("event_id")
                if eid not in rsvps_by_event:
                    rsvps_by_event[eid] = {"approved": [], "pending": 0}
                if r.get("status") == "approved":
                    rsvps_by_event[eid]["approved"].append(r.get("user_id"))
                elif r.get("status") == "pending":
                    rsvps_by_event[eid]["pending"] += 1
        except Exception:
            pass
    
    if sport_ids:
        try:
            sports_result = supabase.table("sports").select("id, name, icon").in_("id", sport_ids).execute()
            for s in (sports_result.data or []):
                sports_by_id[s["id"]] = {"id": s.get("id"), "name": s.get("name") or "Unknown Sport", "icon": s.get("icon") or "🏃"}
        except Exception:
            pass
    
    if host_ids:
        try:
            users_result = supabase.table("users").select("id, full_name, avatar_url").in_("id", host_ids).execute()
            for u in (users_result.data or []):
                hosts_by_id[u["id"]] = {"id": u.get("id"), "full_name": u.get("full_name") or "Unknown", "avatar_url": u.get("avatar_url")}
        except Exception:
            pass
    
    result = []
    for event in events:
        event_id = event.get("id")
        if event_id is None:
            continue
        host_id = event.get("host_id")
        sport_id = event.get("sport_id")
        
        rsvps = rsvps_by_event.get(event_id, {"approved": [], "pending": 0})
        participant_count = len([uid for uid in rsvps["approved"] if uid != host_id])
        pending_count = rsvps["pending"]
        
        sport_data = sports_by_id.get(sport_id) if sport_id is not None else None
        if sport_data is None and sport_id is not None:
            sport_data = {"id": sport_id, "name": "Unknown Sport", "icon": "🏃"}
        
        host_data = hosts_by_id.get(host_id) if host_id is not None else None
        if host_data is None and host_id is not None:
            host_data = {"id": host_id, "full_name": "Unknown", "avatar_url": None}
        
        try:
            result.append(EventResponse(
                id=event["id"],
                title=event["title"],
                description=event.get("description"),
                location=event.get("location"),
                start_time=event["start_time"],
                end_time=event.get("end_time"),
                sport_id=sport_id,
                host_id=host_id,
                max_participants=event.get("max_participants"),
                is_cancelled=event.get("is_cancelled", False),
                is_public=event.get("is_public", True),
                image_url=event.get("image_url"),
                cover_image_url=event.get("cover_image_url"),
                created_at=event.get("created_at"),
                updated_at=event.get("updated_at"),
                participant_count=participant_count,
                pending_requests_count=pending_count,
                sport=sport_data,
                host=host_data
            ))
        except Exception as e:
            # Skip event on validation error, don't fail entire response
            continue
    
    return result


@router.get("/{event_id}", response_model=EventDetail)
async def get_event(
    event_id: int,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get event details. Includes rsvp_status when authenticated."""
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
    
    # Get approved participants (excluding host)
    participants = []
    host_id = event.get("host_id")
    try:
        rsvps_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
        if rsvps_result.data:
            # Filter out the host
            participant_ids = [r["user_id"] for r in rsvps_result.data if r.get("user_id") != host_id]
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
    
    # Get current user's RSVP status (when authenticated)
    rsvp_status = None
    if current_user and current_user.get("id"):
        try:
            rsvp_result = supabase.table("event_rsvps").select("status").eq("event_id", event_id).eq("user_id", current_user["id"]).maybe_single().execute()
            if rsvp_result.data and rsvp_result.data.get("status"):
                rsvp_status = rsvp_result.data["status"]
        except Exception:
            pass
    
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
        participants=participants,
        rsvp_status=rsvp_status
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
    
    # Convert datetime objects to ISO format strings for Supabase
    if isinstance(update_data.get('start_time'), datetime):
        update_data['start_time'] = update_data['start_time'].isoformat()
    if isinstance(update_data.get('end_time'), datetime):
        update_data['end_time'] = update_data['end_time'].isoformat()
    
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
    
    # Get participant and pending counts (excluding host)
    participant_count = 0
    pending_count = 0
    host_id = event.get("host_id")
    try:
        participant_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
        if participant_result.data:
            # Count participants excluding the host
            participants = [r for r in participant_result.data if r.get("user_id") != host_id]
            participant_count = len(participants)
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
    
    # Get host info
    host_data = None
    if host_id:
        try:
            host_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", host_id).single().execute()
            if host_result.data:
                host_data = {
                    "id": host_result.data.get("id"),
                    "full_name": host_result.data.get("full_name") or "Unknown",
                    "avatar_url": host_result.data.get("avatar_url")
                }
        except Exception:
            host_data = {
                "id": host_id,
                "full_name": "Unknown",
                "avatar_url": None
            }
    
    return EventResponse(
        id=updated_event["id"],
        title=updated_event["title"],
        description=updated_event.get("description"),
        location=updated_event.get("location"),
        start_time=updated_event["start_time"],
        end_time=updated_event.get("end_time"),
        sport_id=updated_event.get("sport_id"),
        host_id=host_id,
        max_participants=updated_event.get("max_participants"),
        is_cancelled=updated_event.get("is_cancelled", False),
        is_public=updated_event.get("is_public", True),
        image_url=updated_event.get("image_url"),
        cover_image_url=updated_event.get("cover_image_url"),
        created_at=updated_event.get("created_at"),
        updated_at=updated_event.get("updated_at"),
        participant_count=participant_count,
        pending_requests_count=pending_count,
        sport=sport_data,
        host=host_data
    )


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete an event (host only). RSVPs are cascade-deleted."""
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
        event_result = supabase.table("events").select("host_id").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    if event.get("host_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can delete this event"
        )

    try:
        supabase.table("events").delete().eq("id", event_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete event: {str(e)}"
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
    
    # Check max participants (only for approved RSVPs, excluding host)
    if event.get("max_participants"):
        try:
            host_id = event.get("host_id")
            current_count_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
            if current_count_result.data:
                # Count participants excluding the host
                participants = [r for r in current_count_result.data if r.get("user_id") != host_id]
                current_count = len(participants)
            else:
                current_count = 0
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
    
    # All RSVPs require manual host approval - no auto-approve
    rsvp_status = "pending"
    
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
        
        # Get participant count (approved RSVPs excluding host) - handle errors gracefully
        participant_count = 0
        host_id = event_data.get("host_id")
        try:
            participant_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
            if participant_result.data:
                # Count participants excluding the host
                participants = [r for r in participant_result.data if r.get("user_id") != host_id]
                participant_count = len(participants)
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
        
        # Get host info
        host_data = None
        if host_id:
            try:
                host_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", host_id).single().execute()
                if host_result.data:
                    host_data = {
                        "id": host_result.data.get("id"),
                        "full_name": host_result.data.get("full_name") or "Unknown",
                        "avatar_url": host_result.data.get("avatar_url")
                    }
            except Exception:
                host_data = {
                    "id": host_id,
                    "full_name": "Unknown",
                    "avatar_url": None
                }
        
        return EventResponse(
            id=event_data["id"],
            title=event_data["title"],
            description=event_data.get("description"),
            location=event_data.get("location"),
            start_time=event_data["start_time"],
            end_time=event_data.get("end_time"),
            sport_id=event_data.get("sport_id"),
            host_id=host_id,
            max_participants=event_data.get("max_participants"),
            is_cancelled=event_data.get("is_cancelled", False),
            is_public=event_data.get("is_public", True),
            image_url=event_data.get("image_url"),
            cover_image_url=event_data.get("cover_image_url"),
            created_at=event_data.get("created_at"),
            updated_at=event_data.get("updated_at"),
            participant_count=participant_count,
            pending_requests_count=pending_count,
            sport=sport_data,
            host=host_data
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
    
    # Get all RSVPs - single query for rsvps, single query for all users
    approved_users = []
    pending_users = []
    rejected_users = []
    
    try:
        rsvps_result = supabase.table("event_rsvps").select("user_id, status").eq("event_id", event_id).execute()
        if rsvps_result.data:
            approved_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "approved"]
            pending_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "pending"]
            rejected_ids = [r["user_id"] for r in rsvps_result.data if r.get("status") == "rejected"]
            all_user_ids = list(dict.fromkeys(approved_ids + pending_ids + rejected_ids))
            
            if all_user_ids:
                users_result = supabase.table("users").select("id, full_name, avatar_url, location").in_("id", all_user_ids).execute()
                users_by_id = {u["id"]: u for u in (users_result.data or [])}
                approved_users = [users_by_id[i] for i in approved_ids if i in users_by_id]
                pending_users = [users_by_id[i] for i in pending_ids if i in users_by_id]
                rejected_users = [users_by_id[i] for i in rejected_ids if i in users_by_id]
    except Exception:
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
    
    # Check max participants before approving (excluding host)
    if event.get("max_participants"):
        try:
            host_id = event.get("host_id")
            current_count_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
            if current_count_result.data:
                # Count participants excluding the host
                participants = [r for r in current_count_result.data if r.get("user_id") != host_id]
                current_count = len(participants)
            else:
                current_count = 0
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


@router.delete("/{event_id}/rsvps/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_participant(
    event_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove a participant from the event (host only). Works for pending or approved."""
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

    try:
        event_result = supabase.table("events").select("host_id").eq("id", event_id).single().execute()
        if not event_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
        event = event_result.data
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found"
        )

    if event.get("host_id") != current_user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the event host can remove participants"
        )

    try:
        supabase.table("event_rsvps").delete().eq("event_id", event_id).eq("user_id", user_id).execute()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove participant: {str(e)}"
        )

    return None
