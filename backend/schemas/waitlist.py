from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class WaitlistEntryCreate(BaseModel):
    email: EmailStr
    name: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None


class WaitlistEntryResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
