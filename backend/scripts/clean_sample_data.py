"""
Quick script to clean all sample data
Usage: PYTHONPATH=/path/to/backend python scripts/clean_sample_data.py
"""
from scripts.seed_sample_data import clean_sample_data
from core.database import SessionLocal

if __name__ == "__main__":
    db = SessionLocal()
    try:
        clean_sample_data(db)
    finally:
        db.close()

