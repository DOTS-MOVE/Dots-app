from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    sport_ids: Optional[List[int]] = None
    goal_ids: Optional[List[int]] = None
    is_discoverable: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_discoverable: bool = False
    profile_completed: bool = False
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserProfile(UserResponse):
    sports: List[dict] = []
    goals: List[dict] = []
    photos: List[dict] = []


class CompleteProfileRequest(BaseModel):
    is_discoverable: bool

