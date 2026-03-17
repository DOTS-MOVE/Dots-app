from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class GroupChatBase(BaseModel):
    name: str
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class GroupChatCreate(GroupChatBase):
    member_ids: List[int]


class GroupChatUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class GroupChatResponse(GroupChatBase):
    id: int
    created_by_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GroupChatDetail(GroupChatResponse):
    members: List[dict] = []
    created_by: dict = {}

