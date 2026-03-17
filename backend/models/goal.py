from sqlalchemy import Column, Integer, String, Table, ForeignKey
from sqlalchemy.orm import relationship
from core.database import Base

# Association table for many-to-many relationship
user_goals = Table(
    "user_goals",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("goal_id", Integer, ForeignKey("goals.id"), primary_key=True),
)


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, nullable=True)

    # Relationships
    users = relationship("User", secondary=user_goals, back_populates="goals")

