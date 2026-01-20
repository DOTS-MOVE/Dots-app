from supabase import Client
from typing import List
from datetime import datetime


def calculate_buddy_score(user1: dict, user2: dict, supabase: Client = None) -> float:
    """
    Calculate buddy score between two users based on:
    - Sports overlap (35%)
    - Goals overlap (25%)
    - Location proximity (20%)
    - Age compatibility (10%)
    - Activity level similarity (10%)
    """
    score = 0.0
    
    # Sports overlap (35%) - Most important factor
    user1_sports = set(user1.get("sports", []))
    user2_sports = set(user2.get("sports", []))
    
    # If sports are dicts with 'id', extract IDs
    if user1_sports and isinstance(list(user1_sports)[0] if user1_sports else None, dict):
        user1_sports = {s.get("id") for s in user1_sports if s.get("id")}
    if user2_sports and isinstance(list(user2_sports)[0] if user2_sports else None, dict):
        user2_sports = {s.get("id") for s in user2_sports if s.get("id")}
    
    if user1_sports and user2_sports:
        common_sports = user1_sports.intersection(user2_sports)
        total_sports = user1_sports.union(user2_sports)
        sports_score = len(common_sports) / len(total_sports) if total_sports else 0
        score += sports_score * 0.35
    elif not user1_sports and not user2_sports:
        score += 0.175  # Both have no sports, neutral score
    elif len(user1_sports) > 0 and len(user2_sports) > 0:
        # Partial match - at least one sport overlap
        if user1_sports.intersection(user2_sports):
            score += 0.15  # Some overlap, partial score
    
    # Goals overlap (25%) - Important for compatibility
    user1_goals = set(user1.get("goals", []))
    user2_goals = set(user2.get("goals", []))
    
    # If goals are dicts with 'id', extract IDs
    if user1_goals and isinstance(list(user1_goals)[0] if user1_goals else None, dict):
        user1_goals = {g.get("id") for g in user1_goals if g.get("id")}
    if user2_goals and isinstance(list(user2_goals)[0] if user2_goals else None, dict):
        user2_goals = {g.get("id") for g in user2_goals if g.get("id")}
    
    if user1_goals and user2_goals:
        common_goals = user1_goals.intersection(user2_goals)
        total_goals = user1_goals.union(user2_goals)
        goals_score = len(common_goals) / len(total_goals) if total_goals else 0
        score += goals_score * 0.25
    elif not user1_goals and not user2_goals:
        score += 0.125  # Both have no goals, neutral score
    
    # Location proximity (20%) - Improved matching
    loc1 = user1.get("location", "").lower().strip() if user1.get("location") else ""
    loc2 = user2.get("location", "").lower().strip() if user2.get("location") else ""
    
    if loc1 and loc2:
        # Exact match
        if loc1 == loc2:
            score += 0.20
        # City/area match (e.g., "Washington, DC" matches "Washington DC")
        elif loc1.replace(',', '').replace(' ', '') == loc2.replace(',', '').replace(' ', ''):
            score += 0.18
        # One location contains the other
        elif loc1 in loc2 or loc2 in loc1:
            score += 0.12
        # Same state/region keywords
        else:
            loc1_words = set(loc1.split())
            loc2_words = set(loc2.split())
            common_words = loc1_words.intersection(loc2_words)
            common_words = {w for w in common_words if len(w) > 2}
            if common_words:
                score += 0.08
    else:
        score += 0.05  # Neutral if location not set
    
    # Age compatibility (10%) - Similar age ranges match better
    age1 = user1.get("age")
    age2 = user2.get("age")
    if age1 and age2:
        age_diff = abs(age1 - age2)
        if age_diff <= 3:
            score += 0.10
        elif age_diff <= 5:
            score += 0.075
        elif age_diff <= 10:
            score += 0.05
        elif age_diff <= 15:
            score += 0.025
    
    # Activity level similarity (10%) - Based on event attendance
    if supabase:
        try:
            user1_events_result = supabase.table("event_rsvps").select("id", count="exact").eq("user_id", user1.get("id")).eq("status", "approved").execute()
            user1_events = user1_events_result.count if user1_events_result.count is not None else 0
            
            user2_events_result = supabase.table("event_rsvps").select("id", count="exact").eq("user_id", user2.get("id")).eq("status", "approved").execute()
            user2_events = user2_events_result.count if user2_events_result.count is not None else 0
            
            if user1_events >= 5 and user2_events >= 5:
                score += 0.10
            elif user1_events >= 3 and user2_events >= 3:
                score += 0.075
            elif user1_events <= 2 and user2_events <= 2:
                score += 0.05
            elif abs(user1_events - user2_events) > 10:
                score += 0.02
            else:
                score += 0.05
        except Exception:
            score += 0.05
    
    return round(score * 100, 2)  # Return as percentage


def find_potential_buddies(
    user: dict,
    supabase: Client,
    limit: int = None,
    min_score: float = 0.0  # No minimum score - show all users
) -> List[dict]:
    """
    Find potential buddies for a user using Supabase
    Returns all discoverable users (regardless of score), sorted by score, limit can be applied by caller
    """
    user_id = user.get("id")
    if not user_id:
        return []
    
    # Get existing buddy user IDs
    existing_buddy_user_ids = set()
    try:
        # Get buddies where user is user1
        buddies1_result = supabase.table("buddies").select("user2_id").eq("user1_id", user_id).execute()
        if buddies1_result.data:
            existing_buddy_user_ids.update([b["user2_id"] for b in buddies1_result.data])
        
        # Get buddies where user is user2
        buddies2_result = supabase.table("buddies").select("user1_id").eq("user2_id", user_id).execute()
        if buddies2_result.data:
            existing_buddy_user_ids.update([b["user1_id"] for b in buddies2_result.data])
    except Exception:
        pass
    
    # Get all discoverable users except current user and existing buddies
    try:
        query = supabase.table("users").select("*").eq("is_active", True).eq("is_discoverable", True).neq("id", user_id)
        
        if existing_buddy_user_ids:
            # Exclude existing buddies - Supabase doesn't support NOT IN directly, so we filter in Python
            all_users_result = query.execute()
            potential_users = [u for u in (all_users_result.data or []) if u.get("id") not in existing_buddy_user_ids]
        else:
            all_users_result = query.execute()
            potential_users = all_users_result.data or []
    except Exception:
        potential_users = []
    
    # Get sports and goals for all potential users
    for potential_user in potential_users:
        user_id_potential = potential_user.get("id")
        
        # Get sports
        try:
            sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user_id_potential).execute()
            potential_user["sports"] = []
            if sports_result.data:
                for item in sports_result.data:
                    if item.get("sports"):
                        potential_user["sports"].append(item["sports"])
        except Exception:
            potential_user["sports"] = []
        
        # Get goals
        try:
            goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user_id_potential).execute()
            potential_user["goals"] = []
            if goals_result.data:
                for item in goals_result.data:
                    if item.get("goals"):
                        potential_user["goals"].append(item["goals"])
        except Exception:
            potential_user["goals"] = []
    
    # Calculate scores for all users (no filtering by score)
    buddies = []
    for potential_user in potential_users:
        score = calculate_buddy_score(user, potential_user, supabase)
        buddies.append({
            "user": potential_user,
            "score": score
        })
    
    # Sort by score descending (for display purposes, but all are shown)
    buddies.sort(key=lambda x: x["score"], reverse=True)
    
    # Apply limit if provided
    if limit:
        return buddies[:limit]
    return buddies


def create_buddy_request(
    user1_id: int,
    user2_id: int,
    supabase: Client
) -> dict:
    """
    Create a buddy request using Supabase
    Returns the created buddy dict
    """
    # Check if buddy already exists
    try:
        # Check both directions
        existing1 = supabase.table("buddies").select("*").eq("user1_id", user1_id).eq("user2_id", user2_id).execute()
        existing2 = supabase.table("buddies").select("*").eq("user1_id", user2_id).eq("user2_id", user1_id).execute()
        
        if (existing1.data and len(existing1.data) > 0) or (existing2.data and len(existing2.data) > 0):
            raise ValueError("Buddy already exists")
    except ValueError:
        raise
    except Exception:
        pass  # If query fails, continue (might be a connection issue)
    
    # Get user data for score calculation
    try:
        user1_result = supabase.table("users").select("*").eq("id", user1_id).single().execute()
        user1_data = user1_result.data if user1_result.data else {}
        
        user2_result = supabase.table("users").select("*").eq("id", user2_id).single().execute()
        user2_data = user2_result.data if user2_result.data else {}
        
        # Get sports and goals for both users
        user1_sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user1_id).execute()
        user1_data["sports"] = []
        if user1_sports_result.data:
            for item in user1_sports_result.data:
                if item.get("sports"):
                    user1_data["sports"].append(item["sports"])
        
        user2_sports_result = supabase.table("user_sports").select("sport_id, sports(*)").eq("user_id", user2_id).execute()
        user2_data["sports"] = []
        if user2_sports_result.data:
            for item in user2_sports_result.data:
                if item.get("sports"):
                    user2_data["sports"].append(item["sports"])
        
        user1_goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user1_id).execute()
        user1_data["goals"] = []
        if user1_goals_result.data:
            for item in user1_goals_result.data:
                if item.get("goals"):
                    user1_data["goals"].append(item["goals"])
        
        user2_goals_result = supabase.table("user_goals").select("goal_id, goals(*)").eq("user_id", user2_id).execute()
        user2_data["goals"] = []
        if user2_goals_result.data:
            for item in user2_goals_result.data:
                if item.get("goals"):
                    user2_data["goals"].append(item["goals"])
        
        score = calculate_buddy_score(user1_data, user2_data, supabase)
    except Exception:
        score = 50.0  # Default score if calculation fails
    
    # Create buddy request
    buddy_result = supabase.table("buddies").insert({
        "user1_id": user1_id,
        "user2_id": user2_id,
        "match_score": score,
        "status": "pending"
    }).execute()
    
    if not buddy_result.data or len(buddy_result.data) == 0:
        raise ValueError("Failed to create buddy request")
    
    return buddy_result.data[0]
