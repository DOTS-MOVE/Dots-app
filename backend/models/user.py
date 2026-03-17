from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from core.database import Base


class UserRole(str, enum.Enum):
    USER = "user"
    PREMIUM = "premium"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    bio = Column(Text, nullable=True)
    location = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    cover_image_url = Column(String, nullable=True)
    role = Column(SQLEnum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    is_discoverable = Column(Boolean, default=False)  # Can be discovered and discover others
    profile_completed = Column(Boolean, default=False)  # Has completed onboarding
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    sports = relationship("Sport", secondary="user_sports", back_populates="users")
    goals = relationship("Goal", secondary="user_goals", back_populates="users")
    created_events = relationship("Event", back_populates="host", foreign_keys="Event.host_id")
    event_rsvps = relationship("Event", secondary="event_rsvps", back_populates="participants")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    sent_buddies = relationship("Buddy", foreign_keys="Buddy.user1_id", back_populates="user1")
    received_buddies = relationship("Buddy", foreign_keys="Buddy.user2_id", back_populates="user2")
    subscription = relationship("Subscription", back_populates="user", uselist=False)
    group_chats = relationship("GroupChat", secondary="group_members", back_populates="members")
    posts = relationship("Post", back_populates="user")
    likes = relationship("Like", back_populates="user")
    photos = relationship("UserPhoto", back_populates="user", cascade="all, delete-orphan")

