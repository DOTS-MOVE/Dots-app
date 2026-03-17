from sqlalchemy import Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

# Association table for many-to-many relationship
user_sports = Table(
    "user_sports",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("sport_id", Integer, ForeignKey("sports.id"), primary_key=True),
)


class Sport(Base):
    __tablename__ = "sports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    icon = Column(String, nullable=True)  # Icon name or emoji

    # Relationships
    users = relationship("User", secondary=user_sports, back_populates="sports")
    events = relationship("Event", back_populates="sport")

