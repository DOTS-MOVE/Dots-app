from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageBase(BaseModel):
    content: str
    image_url: Optional[str] = None


class MessageCreate(MessageBase):
    receiver_id: Optional[int] = None
    event_id: Optional[int] = None
    group_id: Optional[int] = None


class MessageResponse(MessageBase):
    id: int
    sender_id: int
    receiver_id: Optional[int] = None
    event_id: Optional[int] = None
    group_id: Optional[int] = None
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class MessageDetail(MessageResponse):
    sender: dict = {}
    receiver: Optional[dict] = None
    event: Optional[dict] = None

