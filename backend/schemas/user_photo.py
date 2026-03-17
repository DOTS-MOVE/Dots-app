from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class UserPhotoCreate(BaseModel):
    photo_url: str
    display_order: Optional[int] = 0


class UserPhotoResponse(BaseModel):
    id: int
    user_id: int
    photo_url: str
    display_order: int
    created_at: datetime
    
    class Config:
        from_attributes = True
