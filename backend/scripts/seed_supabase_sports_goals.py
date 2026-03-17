"""
Seed Sports and Goals directly into Supabase
Run with: python scripts/seed_supabase_sports_goals.py
"""
import os
import sys
from pathlib import Path

# Add parent directory to path to import modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.database import get_supabase

SPORTS = [
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
    {"name": "Pickleball", "icon": "🏓"},
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
    {"name": "Triathlon", "icon": "🏊‍♂️"},
    {"name": "Ultimate Frisbee", "icon": "🥏"},
    {"name": "Lacrosse", "icon": "🥍"},
    {"name": "Water Polo", "icon": "🤽"},
    {"name": "Synchronized Swimming", "icon": "🤽‍♀️"},
    {"name": "Archery", "icon": "🏹"},
    {"name": "Shooting", "icon": "🎯"},
    {"name": "Equestrian", "icon": "🐴"},
    {"name": "Polo", "icon": "🐎"},
    {"name": "Racquetball", "icon": "🎾"},
    {"name": "Squash", "icon": "🎾"},
]

GOALS = [
    {"name": "Meet a workout partner", "description": "Find someone to exercise with regularly"},
    {"name": "Discover fitness events", "description": "Find and attend local fitness events"},
    {"name": "Dating", "description": "Meet potential romantic partners through fitness"},
    {"name": "Weight Loss", "description": "Lose weight and burn calories"},
    {"name": "Muscle Gain", "description": "Build muscle and strength"},
    {"name": "Cardio Fitness", "description": "Improve cardiovascular health"},
    {"name": "General Health", "description": "Maintain overall health and wellness"},
    {"name": "Social Connection", "description": "Meet people and build community"},
]


def seed_sports():
    """Seed sports into Supabase"""
    try:
        supabase = get_supabase()
        print("🌱 Seeding sports...")
        
        # Get existing sports to avoid duplicates
        existing_result = supabase.table("sports").select("name").execute()
        existing_names = {s["name"] for s in (existing_result.data or [])}
        
        sports_to_insert = [s for s in SPORTS if s["name"] not in existing_names]
        
        if not sports_to_insert:
            print(f"✅ All {len(SPORTS)} sports already exist in database")
            return
        
        # Insert sports in batches
        batch_size = 50
        for i in range(0, len(sports_to_insert), batch_size):
            batch = sports_to_insert[i:i + batch_size]
            try:
                result = supabase.table("sports").insert(batch).execute()
                print(f"  ✅ Inserted {len(batch)} sports")
            except Exception as e:
                print(f"  ⚠️  Error inserting batch: {str(e)}")
        
        print(f"✅ Successfully seeded {len(sports_to_insert)} sports")
        
    except Exception as e:
        print(f"❌ Error seeding sports: {str(e)}")
        raise


def seed_goals():
    """Seed goals into Supabase"""
    try:
        supabase = get_supabase()
        print("🌱 Seeding goals...")
        
        # Get existing goals to avoid duplicates
        existing_result = supabase.table("goals").select("name").execute()
        existing_names = {g["name"] for g in (existing_result.data or [])}
        
        goals_to_insert = [g for g in GOALS if g["name"] not in existing_names]
        
        if not goals_to_insert:
            print(f"✅ All {len(GOALS)} goals already exist in database")
            return
        
        # Insert goals
        try:
            result = supabase.table("goals").insert(goals_to_insert).execute()
            print(f"✅ Successfully seeded {len(goals_to_insert)} goals")
        except Exception as e:
            print(f"❌ Error inserting goals: {str(e)}")
            raise
        
    except Exception as e:
        print(f"❌ Error seeding goals: {str(e)}")
        raise


if __name__ == "__main__":
    print("🚀 Starting sports and goals seeding...")
    try:
        seed_sports()
        seed_goals()
        print("\n✅ Seeding complete!")
    except Exception as e:
        print(f"\n❌ Seeding failed: {str(e)}")
        sys.exit(1)
