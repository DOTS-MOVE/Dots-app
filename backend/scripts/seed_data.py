"""
Seed script to populate initial sports and goals data
"""
from sqlalchemy.orm import Session
from core.database import SessionLocal
from models.sport import Sport
from models.goal import Goal


def seed_sports(db: Session):
    sports = [
        {"name": "Running", "icon": "🏃"},
        {"name": "Cycling", "icon": "🚴"},
        {"name": "Swimming", "icon": "🏊"},
        {"name": "Weightlifting", "icon": "🏋️"},
        {"name": "Yoga", "icon": "🧘"},
        {"name": "Basketball", "icon": "🏀"},
        {"name": "Soccer", "icon": "⚽"},
        {"name": "Tennis", "icon": "🎾"},
        {"name": "Volleyball", "icon": "🏐"},
        {"name": "Rock Climbing", "icon": "🧗"},
        {"name": "Hiking", "icon": "🥾"},
        {"name": "CrossFit", "icon": "💪"},
        {"name": "Dancing", "icon": "💃"},
        {"name": "Martial Arts", "icon": "🥋"},
        {"name": "Pilates", "icon": "🧘‍♀️"},
        {"name": "Baseball", "icon": "⚾"},
        {"name": "Football", "icon": "🏈"},
        {"name": "Golf", "icon": "⛳"},
        {"name": "Surfing", "icon": "🏄"},
        {"name": "Skiing", "icon": "⛷️"},
        {"name": "Snowboarding", "icon": "🏂"},
        {"name": "Ice Skating", "icon": "⛸️"},
        {"name": "Hockey", "icon": "🏒"},
        {"name": "Rugby", "icon": "🏉"},
        {"name": "Cricket", "icon": "🏏"},
        {"name": "Badminton", "icon": "🏸"},
        {"name": "Table Tennis", "icon": "🏓"},
        {"name": "Boxing", "icon": "🥊"},
        {"name": "Wrestling", "icon": "🤼"},
        {"name": "Fencing", "icon": "🤺"},
        {"name": "Gymnastics", "icon": "🤸"},
        {"name": "Skateboarding", "icon": "🛹"},
        {"name": "Roller Skating", "icon": "🛼"},
        {"name": "Rowing", "icon": "🚣"},
        {"name": "Kayaking", "icon": "🛶"},
        {"name": "Canoeing", "icon": "🛶"},
        {"name": "Sailing", "icon": "⛵"},
        {"name": "Diving", "icon": "🤿"},
        {"name": "Water Polo", "icon": "🤽"},
        {"name": "Beach Volleyball", "icon": "🏐"},
        {"name": "Ultimate Frisbee", "icon": "🥏"},
        {"name": "Lacrosse", "icon": "🥍"},
        {"name": "Handball", "icon": "🤾"},
        {"name": "Squash", "icon": "🎾"},
        {"name": "Racquetball", "icon": "🎾"},
        {"name": "Pickleball", "icon": "🏓"},
        {"name": "Bowling", "icon": "🎳"},
        {"name": "Archery", "icon": "🏹"},
        {"name": "Horseback Riding", "icon": "🐴"},
        {"name": "Triathlon", "icon": "🏊"},
        {"name": "Marathon Running", "icon": "🏃"},
        {"name": "Trail Running", "icon": "🏃"},
        {"name": "Mountain Biking", "icon": "🚴"},
        {"name": "BMX", "icon": "🚴"},
    ]
    
    for sport_data in sports:
        existing = db.query(Sport).filter(Sport.name == sport_data["name"]).first()
        if not existing:
            sport = Sport(**sport_data)
            db.add(sport)
    
    db.commit()
    print("Seeded sports")


def seed_goals(db: Session):
    goals = [
        {"name": "Meet a workout partner", "description": "Find someone to exercise with regularly"},
        {"name": "Discover fitness events", "description": "Find and attend local fitness events"},
        {"name": "Dating", "description": "Meet potential romantic partners through fitness"},
        {"name": "Weight Loss", "description": "Lose weight and burn calories"},
        {"name": "Muscle Gain", "description": "Build muscle and strength"},
        {"name": "Cardio Fitness", "description": "Improve cardiovascular health"},
        {"name": "General Health", "description": "Maintain overall health and wellness"},
        {"name": "Social Connection", "description": "Meet people and build community"},
    ]
    
    for goal_data in goals:
        existing = db.query(Goal).filter(Goal.name == goal_data["name"]).first()
        if not existing:
            goal = Goal(**goal_data)
            db.add(goal)
    
    db.commit()
    print("Seeded goals")


if __name__ == "__main__":
    db = SessionLocal()
    try:
        seed_sports(db)
        seed_goals(db)
        print("Seeding complete!")
    finally:
        db.close()

