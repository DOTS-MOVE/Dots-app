from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    sport_id: int
    location: str
    start_time: datetime
    end_time: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_public: bool = True
    cover_image_url: Optional[str] = None


class EventCreate(EventBase):
    pass


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    sport_id: Optional[int] = None
    location: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    max_participants: Optional[int] = None
    is_cancelled: Optional[bool] = None
    is_public: Optional[bool] = None
    cover_image_url: Optional[str] = None


class EventResponse(EventBase):
    id: int
    host_id: int
    is_cancelled: bool
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    participant_count: int = 0
    pending_requests_count: int = 0  # For private events
    host: Optional[dict] = None  # Host information
    
    class Config:
        from_attributes = True


class EventDetail(EventResponse):
    host: dict = {}
    sport: dict = {}
    participants: List[dict] = []

