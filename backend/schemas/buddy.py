from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.buddy import BuddyStatus


class BuddyResponse(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    match_score: Optional[float] = None
    status: BuddyStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class BuddyDetail(BuddyResponse):
    user1: dict = {}
    user2: dict = {}


class BuddyRequest(BaseModel):
    user2_id: int


class BuddyUpdate(BaseModel):
    status: BuddyStatus
