from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PostCreate(BaseModel):
    content: str
    image_url: Optional[str] = None


class PostResponse(BaseModel):
    id: int
    user_id: int
    content: str
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    like_count: int = 0
    is_liked: bool = False
    user: Optional[dict] = None

    class Config:
        from_attributes = True


class LikeResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime
    user: Optional[dict] = None

    class Config:
        from_attributes = True
