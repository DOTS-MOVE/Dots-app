"""
Seed script to populate database with sample data for testing
Run with: PYTHONPATH=/path/to/backend python scripts/seed_sample_data.py
"""
from sqlalchemy.orm import Session
from core.database import SessionLocal
from models.user import User, UserRole
from models.event import Event
from models.sport import Sport
from models.goal import Goal
from models.buddy import Buddy, BuddyStatus
from models.subscription import Subscription, SubscriptionTier
from models.event import event_rsvps
from models.message import Message
from models.group_chat import GroupChat, group_members
from core.security import get_password_hash
from datetime import datetime, timedelta
import random

# Sample data - Expanded with many more diverse profiles (50+ users)
SAMPLE_USERS = [
    {"email": "alice@example.com", "full_name": "Alice Johnson", "age": 28, "location": "San Francisco, CA", "bio": "Love running and yoga! Looking for workout buddies to stay motivated. I run 3-4 times a week and practice yoga on weekends. Let's get active together!"},
    {"email": "bob@example.com", "full_name": "Bob Smith", "age": 32, "location": "San Francisco, CA", "bio": "Cycling enthusiast and weekend warrior! I do long rides every Saturday morning. Looking for cycling partners for Marin County rides."},
    {"email": "charlie@example.com", "full_name": "Charlie Brown", "age": 25, "location": "Oakland, CA", "bio": "Weightlifting and CrossFit enthusiast. I train 5 days a week focusing on strength and conditioning. Let's get strong together!"},
    {"email": "diana@example.com", "full_name": "Diana Prince", "age": 30, "location": "San Francisco, CA", "bio": "Yoga and Pilates instructor. I teach classes 3x a week and love practicing with others. Always up for a session in the park!"},
    {"email": "eve@example.com", "full_name": "Eve Martinez", "age": 27, "location": "Berkeley, CA", "bio": "Swimming and hiking enthusiast. Nature lover who enjoys open water swimming and weekend hikes. Let's explore the Bay Area together!"},
    {"email": "frank@example.com", "full_name": "Frank Wilson", "age": 35, "location": "San Francisco, CA", "bio": "Basketball player and fitness coach. I play pickup games 2-3 times a week. Looking for players for regular games!"},
    {"email": "grace@example.com", "full_name": "Grace Lee", "age": 29, "location": "San Francisco, CA", "bio": "Tennis player and dance fitness instructor. I love staying active and having fun while working out. Let's hit the courts or dance floor!"},
    {"email": "henry@example.com", "full_name": "Henry Davis", "age": 31, "location": "Oakland, CA", "bio": "Rock climbing and hiking adventure seeker. I climb at Planet Granite 3x a week and do weekend hikes. Looking for climbing partners!"},
    {"email": "isabella@example.com", "full_name": "Isabella Garcia", "age": 26, "location": "San Francisco, CA", "bio": "Runner and triathlete in training. Training for my first half marathon! Looking for running buddies for early morning runs."},
    {"email": "james@example.com", "full_name": "James Wilson", "age": 33, "location": "San Francisco, CA", "bio": "Swimming coach and open water swimmer. I swim at Aquatic Park regularly. Looking for training partners!"},
    {"email": "karen@example.com", "full_name": "Karen Chen", "age": 28, "location": "San Francisco, CA", "bio": "Yoga and meditation practitioner. I practice daily and love outdoor yoga sessions. Looking for mindful movement partners!"},
    {"email": "liam@example.com", "full_name": "Liam O'Connor", "age": 30, "location": "Oakland, CA", "bio": "Cycling and running enthusiast. I do both road cycling and trail running. Weekend warrior looking for training partners!"},
    {"email": "maya@example.com", "full_name": "Maya Patel", "age": 27, "location": "Berkeley, CA", "bio": "Tennis player and fitness enthusiast. I play tennis 2-3 times a week and love trying new sports. Always up for a match!"},
    {"email": "noah@example.com", "full_name": "Noah Taylor", "age": 29, "location": "San Francisco, CA", "bio": "Weightlifting and powerlifting. I train at the gym 5 days a week focusing on compound lifts. Looking for a training partner!"},
    {"email": "olivia@example.com", "full_name": "Olivia Brown", "age": 31, "location": "San Francisco, CA", "bio": "Hiking and outdoor fitness enthusiast. I love exploring Bay Area trails and doing outdoor workouts. Adventure buddy wanted!"},
    {"email": "peter@example.com", "full_name": "Peter Kim", "age": 34, "location": "Oakland, CA", "bio": "Basketball and running. I play basketball weekly and run 3-4 times a week. Looking for active workout partners!"},
    {"email": "quinn@example.com", "full_name": "Quinn Anderson", "age": 26, "location": "San Francisco, CA", "bio": "Swimming and yoga practitioner. I swim laps 3x a week and do yoga for recovery. Looking for workout buddies!"},
    {"email": "rachel@example.com", "full_name": "Rachel Green", "age": 28, "location": "Berkeley, CA", "bio": "Cycling and hiking enthusiast. I do long bike rides on weekends and love exploring new trails. Let's ride together!"},
    {"email": "sam@example.com", "full_name": "Sam Rodriguez", "age": 32, "location": "San Francisco, CA", "bio": "CrossFit and weightlifting. I train at a CrossFit box 4x a week. Looking for motivated training partners!"},
    {"email": "taylor@example.com", "full_name": "Taylor Swift", "age": 29, "location": "Oakland, CA", "bio": "Running and Pilates. I run 4-5 times a week and do Pilates for strength. Training for a marathon!"},
    # Additional users to ensure plenty of matches
    {"email": "alex@example.com", "full_name": "Alex Rivera", "age": 24, "location": "San Francisco, CA", "bio": "Marathon runner and cycling enthusiast. Training for my first Ironman! Looking for training partners."},
    {"email": "sophia@example.com", "full_name": "Sophia Martinez", "age": 27, "location": "Oakland, CA", "bio": "Yoga instructor and meditation teacher. I love connecting with others through movement and mindfulness."},
    {"email": "michael@example.com", "full_name": "Michael Chen", "age": 31, "location": "San Francisco, CA", "bio": "Basketball player and fitness trainer. I play in leagues and love coaching others. Always up for a game!"},
    {"email": "emma@example.com", "full_name": "Emma Thompson", "age": 26, "location": "Berkeley, CA", "bio": "Swimmer and triathlete. I swim competitively and train for triathlons. Looking for training buddies!"},
    {"email": "david@example.com", "full_name": "David Park", "age": 29, "location": "San Francisco, CA", "bio": "Weightlifter and powerlifter. I compete in powerlifting meets. Looking for a training partner!"},
    {"email": "lisa@example.com", "full_name": "Lisa Wang", "age": 28, "location": "Oakland, CA", "bio": "Runner and yoga practitioner. I run marathons and do yoga for recovery. Training for Boston!"},
    {"email": "chris@example.com", "full_name": "Chris Johnson", "age": 33, "location": "San Francisco, CA", "bio": "Cyclist and mountain biker. I do road cycling and mountain biking. Weekend warrior!"},
    {"email": "jessica@example.com", "full_name": "Jessica Brown", "age": 25, "location": "Berkeley, CA", "bio": "Tennis player and fitness enthusiast. I play tennis competitively and love staying active!"},
    {"email": "ryan@example.com", "full_name": "Ryan Davis", "age": 30, "location": "San Francisco, CA", "bio": "CrossFit athlete and weightlifter. I train at a CrossFit box 5x a week. Looking for motivated partners!"},
    {"email": "amanda@example.com", "full_name": "Amanda Lee", "age": 27, "location": "Oakland, CA", "bio": "Hiker and outdoor enthusiast. I love exploring trails and doing outdoor workouts. Adventure seeker!"},
    {"email": "josh@example.com", "full_name": "Josh Wilson", "age": 32, "location": "San Francisco, CA", "bio": "Basketball player and runner. I play pickup games and run 3x a week. Looking for active partners!"},
    {"email": "natalie@example.com", "full_name": "Natalie Garcia", "age": 29, "location": "Berkeley, CA", "bio": "Yoga and Pilates instructor. I teach classes and love practicing with others. Always up for a session!"},
    {"email": "kevin@example.com", "full_name": "Kevin Martinez", "age": 28, "location": "San Francisco, CA", "bio": "Swimmer and open water enthusiast. I swim at Aquatic Park regularly. Looking for training partners!"},
    {"email": "sarah@example.com", "full_name": "Sarah Kim", "age": 26, "location": "Oakland, CA", "bio": "Runner and triathlete. Training for my first Ironman! Looking for training buddies for long runs."},
    {"email": "daniel@example.com", "full_name": "Daniel Rodriguez", "age": 31, "location": "San Francisco, CA", "bio": "Weightlifter and powerlifter. I train at the gym 5 days a week. Looking for a spotter!"},
    {"email": "michelle@example.com", "full_name": "Michelle Chen", "age": 28, "location": "Berkeley, CA", "bio": "Cycling and running enthusiast. I do both road cycling and trail running. Weekend warrior!"},
    {"email": "brandon@example.com", "full_name": "Brandon Taylor", "age": 30, "location": "San Francisco, CA", "bio": "Basketball player and fitness coach. I play pickup games 2-3 times a week. Looking for players!"},
    {"email": "lauren@example.com", "full_name": "Lauren Anderson", "age": 27, "location": "Oakland, CA", "bio": "Tennis player and fitness enthusiast. I play tennis 2-3 times a week. Always up for a match!"},
    {"email": "justin@example.com", "full_name": "Justin Brown", "age": 29, "location": "San Francisco, CA", "bio": "Swimming and yoga practitioner. I swim laps 3x a week and do yoga for recovery. Looking for buddies!"},
    {"email": "nicole@example.com", "full_name": "Nicole Green", "age": 28, "location": "Berkeley, CA", "bio": "Hiking and outdoor fitness enthusiast. I love exploring Bay Area trails. Adventure buddy wanted!"},
    {"email": "eric@example.com", "full_name": "Eric O'Connor", "age": 32, "location": "San Francisco, CA", "bio": "CrossFit and weightlifting. I train at a CrossFit box 4x a week. Looking for motivated partners!"},
    {"email": "stephanie@example.com", "full_name": "Stephanie Patel", "age": 26, "location": "Oakland, CA", "bio": "Running and Pilates. I run 4-5 times a week and do Pilates for strength. Training for a marathon!"},
    {"email": "brian@example.com", "full_name": "Brian Wilson", "age": 31, "location": "San Francisco, CA", "bio": "Cycling and running enthusiast. I do both road cycling and trail running. Weekend warrior!"},
    {"email": "rebecca@example.com", "full_name": "Rebecca Davis", "age": 29, "location": "Berkeley, CA", "bio": "Yoga and meditation practitioner. I practice daily and love outdoor yoga sessions. Looking for partners!"},
    {"email": "jason@example.com", "full_name": "Jason Lee", "age": 28, "location": "San Francisco, CA", "bio": "Basketball player and runner. I play basketball weekly and run 3-4 times a week. Looking for active partners!"},
    {"email": "melissa@example.com", "full_name": "Melissa Garcia", "age": 27, "location": "Oakland, CA", "bio": "Swimmer and triathlete. I swim competitively and train for triathlons. Looking for training buddies!"},
    {"email": "andrew@example.com", "full_name": "Andrew Martinez", "age": 30, "location": "San Francisco, CA", "bio": "Weightlifter and powerlifter. I compete in powerlifting meets. Looking for a training partner!"},
    {"email": "jennifer@example.com", "full_name": "Jennifer Kim", "age": 28, "location": "Berkeley, CA", "bio": "Runner and yoga practitioner. I run marathons and do yoga for recovery. Training for Boston!"},
    {"email": "thomas@example.com", "full_name": "Thomas Park", "age": 32, "location": "San Francisco, CA", "bio": "Cyclist and mountain biker. I do road cycling and mountain biking. Weekend warrior!"},
    {"email": "ashley@example.com", "full_name": "Ashley Brown", "age": 26, "location": "Oakland, CA", "bio": "Tennis player and fitness enthusiast. I play tennis competitively and love staying active!"},
    {"email": "robert@example.com", "full_name": "Robert Johnson", "age": 29, "location": "San Francisco, CA", "bio": "CrossFit athlete and weightlifter. I train at a CrossFit box 5x a week. Looking for motivated partners!"},
    {"email": "linda@example.com", "full_name": "Linda Davis", "age": 27, "location": "Berkeley, CA", "bio": "Hiker and outdoor enthusiast. I love exploring trails and doing outdoor workouts. Adventure seeker!"},
]

SAMPLE_EVENTS = [
    {"title": "Morning Run in Golden Gate Park", "description": "Join us for a 5K run through Golden Gate Park. All paces welcome!", "sport": "Running", "location": "Golden Gate Park, San Francisco", "hours_from_now": 24},
    {"title": "Weekend Cycling Group Ride", "description": "25-mile group ride through Marin County. Intermediate level.", "sport": "Cycling", "location": "Sausalito, CA", "hours_from_now": 48},
    {"title": "Yoga Session at Dolores Park", "description": "Outdoor yoga session. Bring your mat!", "sport": "Yoga", "location": "Dolores Park, San Francisco", "hours_from_now": 12},
    {"title": "Basketball Pickup Game", "description": "Casual pickup game. All skill levels welcome!", "sport": "Basketball", "location": "Mission Bay Courts, San Francisco", "hours_from_now": 36},
    {"title": "Weightlifting Session", "description": "Gym session focusing on compound lifts. Spotting available.", "sport": "Weightlifting", "location": "24 Hour Fitness, Market St", "hours_from_now": 18},
    {"title": "Swimming at Aquatic Park", "description": "Open water swimming. Wetsuits recommended.", "sport": "Swimming", "location": "Aquatic Park, San Francisco", "hours_from_now": 60},
    {"title": "Tennis Doubles", "description": "Looking for 3 more players for doubles.", "sport": "Tennis", "location": "Golden Gate Park Tennis Courts", "hours_from_now": 72},
    {"title": "Hiking Mission Peak", "description": "Early morning hike to Mission Peak. Moderate difficulty.", "sport": "Hiking", "location": "Mission Peak, Fremont", "hours_from_now": 96},
]

def seed_sample_data(db: Session):
    """Seed database with sample users, events, and buddies"""
    
    # Get sports and goals
    sports = db.query(Sport).all()
    goals = db.query(Goal).all()
    
    if not sports or not goals:
        print("❌ Please run seed_data.py first to populate sports and goals!")
        return
    
    # Create admin user first
    print("👑 Creating admin user...")
    admin_email = "admin@dots.app"
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            hashed_password=get_password_hash("admin123"),
            full_name="Admin User",
            age=30,
            location="San Francisco, CA",
            bio="System Administrator",
            role=UserRole.ADMIN,
            avatar_url="https://picsum.photos/seed/admin/400/400"
        )
        db.add(admin_user)
        db.flush()
        print(f"  ✅ Created admin user: {admin_email} / admin123")
    else:
        # Update existing admin user to ensure it has admin role
        admin_user.role = UserRole.ADMIN
        if not admin_user.avatar_url:
            admin_user.avatar_url = "https://picsum.photos/seed/admin/400/400"
        db.flush()
        print(f"  ✅ Admin user already exists: {admin_email} / admin123")
    
    # Create sample users
    print("👥 Creating sample users...")
    created_users = []
    
    for user_data in SAMPLE_USERS:
        # Generate avatar URL using Picsum (placeholder images)
        # Using user index to get consistent images
        user_index = SAMPLE_USERS.index(user_data)
        avatar_url = f"https://picsum.photos/seed/{user_index + 100}/400/600"
        
        # Check if user exists
        existing = db.query(User).filter(User.email == user_data["email"]).first()
        if existing:
            # Update existing user with avatar URL if missing
            if not existing.avatar_url:
                existing.avatar_url = avatar_url
                db.flush()
                print(f"  ✅ Updated user {user_data['email']} with avatar URL")
            created_users.append(existing)
            continue
        
        user = User(
            email=user_data["email"],
            hashed_password=get_password_hash("password123"),  # Same password for all test users
            full_name=user_data["full_name"],
            age=user_data["age"],
            location=user_data["location"],
            bio=user_data["bio"],
            avatar_url=avatar_url
        )
        db.add(user)
        db.flush()
        
        # Assign random sports (2-4 sports per user)
        user_sports = random.sample(sports, random.randint(2, min(4, len(sports))))
        user.sports = user_sports
        
        # Assign random goals (1-3 goals per user)
        user_goals = random.sample(goals, random.randint(1, min(3, len(goals))))
        user.goals = user_goals
        
        # Create subscription
        subscription = Subscription(
            user_id=user.id,
            tier=SubscriptionTier.FREE
        )
        db.add(subscription)
        
        created_users.append(user)
        print(f"  ✅ Created user: {user_data['full_name']} ({user_data['email']})")
    
    db.commit()
    print(f"✅ Created {len(created_users)} users\n")
    
    # Create sample events
    print("📅 Creating sample events...")
    created_events = []
    
    # Update existing events with images if missing, or delete and recreate
    existing_events = db.query(Event).all()
    for existing_event in existing_events:
        if not existing_event.image_url:
            # Generate image URL for existing event
            event_seed = abs(hash(existing_event.title + str(existing_event.sport_id))) % 100000
            existing_event.image_url = f"https://picsum.photos/seed/{event_seed + 20000}/800/600"
            db.flush()
            print(f"  ✅ Updated event '{existing_event.title}' with image URL")
        else:
            # Delete existing event to recreate with fresh data
            db.delete(existing_event)
    db.commit()
    
    for event_data in SAMPLE_EVENTS:
        # Find sport
        sport = next((s for s in sports if s.name == event_data["sport"]), None)
        if not sport:
            print(f"  ⚠️  Sport '{event_data['sport']}' not found, skipping event...")
            continue
        
        # Pick random host from created users
        host = random.choice(created_users)
        
        # Calculate start time
        start_time = datetime.utcnow() + timedelta(hours=event_data["hours_from_now"])
        end_time = start_time + timedelta(hours=2)
        
        # Generate image URL based on event title and sport - use larger seed range for variety
        event_seed = abs(hash(event_data["title"] + event_data["sport"])) % 100000
        # Use different seed range (20000-120000) to ensure unique images
        image_url = f"https://picsum.photos/seed/{event_seed + 20000}/800/600"
        
        event = Event(
            title=event_data["title"],
            description=event_data["description"],
            sport_id=sport.id,
            host_id=host.id,
            location=event_data["location"],
            start_time=start_time,
            end_time=end_time,
            max_participants=random.randint(5, 15),
            image_url=image_url
        )
        db.add(event)
        db.flush()
        
        # Host automatically RSVPs
        db.execute(
            event_rsvps.insert().values(event_id=event.id, user_id=host.id)
        )
        
        # Add random participants (2-5 additional users)
        other_users = [u for u in created_users if u.id != host.id]
        num_participants = random.randint(2, min(5, len(other_users)))
        participants = random.sample(other_users, num_participants)
        
        for participant in participants:
            db.execute(
                event_rsvps.insert().values(event_id=event.id, user_id=participant.id)
            )
        
        created_events.append(event)
        print(f"  ✅ Created event: {event_data['title']} (host: {host.full_name})")
    
    db.commit()
    print(f"✅ Created {len(created_events)} events\n")
    
    # Create some buddies
    print("🤝 Creating sample buddies...")
    buddies_created = 0
    
    # Create buddies between users
    for i, user1 in enumerate(created_users):
        for user2 in created_users[i+1:]:
            # 30% chance of creating a buddy
            if random.random() < 0.3:
                # Check if buddy already exists
                existing = db.query(Buddy).filter(
                    ((Buddy.user1_id == user1.id) & (Buddy.user2_id == user2.id)) |
                    ((Buddy.user1_id == user2.id) & (Buddy.user2_id == user1.id))
                ).first()
                
                if existing:
                    continue
                
                # Calculate buddy score (simplified)
                common_sports = set(s.id for s in user1.sports) & set(s.id for s in user2.sports)
                common_goals = set(g.id for g in user1.goals) & set(g.id for g in user2.goals)
                
                score = 30.0
                if common_sports:
                    score += len(common_sports) * 15
                if common_goals:
                    score += len(common_goals) * 10
                if user1.location and user2.location and user1.location == user2.location:
                    score += 20
                
                score = min(score, 100.0)
                
                buddy = Buddy(
                    user1_id=user1.id,
                    user2_id=user2.id,
                    match_score=round(score, 2),
                    status=random.choice([BuddyStatus.PENDING, BuddyStatus.ACCEPTED])
                )
                db.add(buddy)
                buddies_created += 1
    
    db.commit()
    print(f"✅ Created {buddies_created} buddies\n")
    
    # Create sample messages
    print("💬 Creating sample messages...")
    messages_created = 0
    
    # Sample conversation starters
    conversation_starters = [
        "Hey! Are you still up for that run tomorrow?",
        "Thanks for the buddy request! Would love to work out together sometime.",
        "Saw you're into {sport}, want to join our group session?",
        "Hey! How's your training going?",
        "Are you going to the {event} event?",
        "Would you be interested in a workout session this weekend?",
        "Hey! I noticed we have similar fitness goals. Want to connect?",
        "Thanks for accepting my buddy request! Let's plan something!",
    ]
    
    responses = [
        "Yes! I'm definitely in. What time works for you?",
        "That sounds great! I'm free most mornings.",
        "I'd love to! When were you thinking?",
        "Absolutely! Let me check my schedule and get back to you.",
        "Yes, I'm planning to go! Want to meet up there?",
        "That would be awesome! I'm free Saturday morning.",
        "Definitely! I'm always looking for workout buddies.",
        "Perfect! I'm excited to connect with you.",
        "Sounds good! Let me know the details.",
        "I'm in! What's the plan?",
    ]
    
    # Get alice (first user) to ensure she has conversations
    alice = db.query(User).filter(User.email == "alice@example.com").first()
    
    if not alice:
        print("  ⚠️  Alice not found, skipping message creation")
    else:
        # Create 1:1 conversations - prioritize conversations with alice
        accepted_buddies = db.query(Buddy).filter(Buddy.status == BuddyStatus.ACCEPTED).all()
        
        # First, create conversations with alice
        alice_buddies = [m for m in accepted_buddies if m.user1_id == alice.id or m.user2_id == alice.id]
        
        # If alice doesn't have enough buddies, create some
        if len(alice_buddies) < 8:
            # Get some random users to create buddies with alice
            other_users = [u for u in created_users if u.id != alice.id]
            needed_buddies = 8 - len(alice_buddies)
            for user in other_users[:needed_buddies]:
                # Create a buddy if it doesn't exist
                existing = db.query(Buddy).filter(
                    ((Buddy.user1_id == alice.id) & (Buddy.user2_id == user.id)) |
                    ((Buddy.user1_id == user.id) & (Buddy.user2_id == alice.id))
                ).first()
                if not existing:
                    buddy = Buddy(
                        user1_id=alice.id,
                        user2_id=user.id,
                        match_score=random.uniform(60, 95),
                        status=BuddyStatus.ACCEPTED
                    )
                    db.add(buddy)
                    db.flush()
            # Refresh buddies
            accepted_buddies = db.query(Buddy).filter(Buddy.status == BuddyStatus.ACCEPTED).all()
            alice_buddies = [m for m in accepted_buddies if m.user1_id == alice.id or m.user2_id == alice.id]
        
        for buddy in alice_buddies[:8]:  # Create 8 conversations with alice
            user1 = db.query(User).filter(User.id == buddy.user1_id).first()
            user2 = db.query(User).filter(User.id == buddy.user2_id).first()
            
            if not user1 or not user2:
                continue
        
            # Create a conversation with 4-10 messages
            num_messages = random.randint(4, 10)
            base_time = datetime.utcnow() - timedelta(days=random.randint(1, 7))
            
            for i in range(num_messages):
                is_user1 = i % 2 == 0
                sender = user1 if is_user1 else user2
                receiver = user2 if is_user1 else user1
                
                if i == 0:
                    # First message
                    content = random.choice(conversation_starters)
                    if "{sport}" in content:
                        sport = random.choice(sender.sports) if sender.sports else None
                        content = content.replace("{sport}", sport.name if sport else "fitness")
                    elif "{event}" in content:
                        event = random.choice(created_events) if created_events else None
                        content = content.replace("{event}", event.title if event else "upcoming event")
                else:
                    # Response
                    content = random.choice(responses)
                
                message = Message(
                    sender_id=sender.id,
                    receiver_id=receiver.id,
                    content=content,
                    is_read=random.choice([True, False]) if not is_user1 else True,
                    created_at=base_time + timedelta(hours=i * random.randint(1, 6))
                )
                db.add(message)
                messages_created += 1
    
    # Then create other conversations (not necessarily with alice)
    if alice:
        other_buddies = [m for m in accepted_buddies if m.user1_id != alice.id and m.user2_id != alice.id]
    else:
        other_buddies = accepted_buddies
    for buddy in other_buddies[:15]:  # Create 15 more conversations
        user1 = db.query(User).filter(User.id == buddy.user1_id).first()
        user2 = db.query(User).filter(User.id == buddy.user2_id).first()
        
        if not user1 or not user2:
            continue
        
        # Create a conversation with 3-8 messages
        num_messages = random.randint(3, 8)
        base_time = datetime.utcnow() - timedelta(days=random.randint(1, 7))
        
        for i in range(num_messages):
            is_user1 = i % 2 == 0
            sender = user1 if is_user1 else user2
            receiver = user2 if is_user1 else user1
            
            if i == 0:
                # First message
                content = random.choice(conversation_starters)
                if "{sport}" in content:
                    sport = random.choice(sender.sports) if sender.sports else None
                    content = content.replace("{sport}", sport.name if sport else "fitness")
                elif "{event}" in content:
                    event = random.choice(created_events) if created_events else None
                    content = content.replace("{event}", event.title if event else "upcoming event")
            else:
                # Response
                content = random.choice(responses)
            
            message = Message(
                sender_id=sender.id,
                receiver_id=receiver.id,
                content=content,
                is_read=random.choice([True, False]) if not is_user1 else True,
                created_at=base_time + timedelta(hours=i * random.randint(1, 6))
            )
            db.add(message)
            messages_created += 1
    
    # Create event group messages - ensure alice is in some events
    for event in created_events:  # All events
        # Get event participants
        participant_ids = db.query(event_rsvps.c.user_id).filter(event_rsvps.c.event_id == event.id).all()
        participant_ids = [p[0] for p in participant_ids]
        event_participants = [p for p in created_users if p.id in participant_ids]
        
        # Ensure alice is in at least first 3 events
        if alice and len(created_events) > 2 and event.id <= created_events[2].id:
            if alice.id not in participant_ids:
                db.execute(
                    event_rsvps.insert().values(event_id=event.id, user_id=alice.id)
                )
                event_participants.append(alice)
                db.flush()
        
        if len(event_participants) < 2:
            continue
        
        # Create 3-8 messages in event chat
        num_messages = random.randint(3, 8)
        base_time = datetime.utcnow() - timedelta(days=random.randint(1, 3))
        
        event_messages = [
            f"Excited for {event.title}!",
            f"See you all at {event.location}!",
            "What time should we meet?",
            "Can't wait! This is going to be great.",
            "Anyone need a ride?",
            f"Looking forward to {event.title}!",
            "Count me in!",
            "This is going to be fun!",
        ]
        
        for i in range(num_messages):
            sender = random.choice(event_participants)
            content = random.choice(event_messages)
            
            message = Message(
                sender_id=sender.id,
                event_id=event.id,
                content=content,
                is_read=False,
                created_at=base_time + timedelta(hours=i * random.randint(1, 3))
            )
            db.add(message)
            messages_created += 1
    
    # Create group chats
    print("👥 Creating sample group chats...")
    groups_created = 0
    
    group_names = [
        "Bay Area Runners",
        "Weekend Warriors",
        "Yoga Enthusiasts",
        "Cycling Club SF",
        "Fitness Buddies",
    ]
    
    for i, group_name in enumerate(group_names[:3]):  # Create 3 groups
        creator = created_users[i * 5] if i * 5 < len(created_users) else created_users[0]
        other_users = [u for u in created_users if u.id != creator.id]
        members = random.sample(other_users, random.randint(3, 6))
        members.append(creator)
        
        # Ensure alice is in at least 2 groups
        if i < 2 and alice and alice.id not in [m.id for m in members]:
            members.append(alice)
        
        group = GroupChat(
            name=group_name,
            description=f"A group for {group_name.lower()} to connect and plan workouts!",
            created_by_id=creator.id,
            avatar_url=f"https://picsum.photos/seed/group{i+30000}/400/400"
        )
        db.add(group)
        db.flush()
        
        # Add members
        for member in members:
            is_admin = member.id == creator.id
            db.execute(
                group_members.insert().values(
                    group_id=group.id,
                    user_id=member.id,
                    is_admin=is_admin
                )
            )
        
        # Create group messages
        group_message_templates = [
            "Hey everyone! Who's up for a workout this weekend?",
            "Great session today! Thanks everyone for coming.",
            "Anyone want to join me for a run tomorrow morning?",
            "Let's plan our next meetup!",
            "Thanks for organizing this group!",
        ]
        
        num_group_messages = random.randint(3, 6)
        base_time = datetime.utcnow() - timedelta(days=random.randint(1, 5))
        
        for j in range(num_group_messages):
            sender = random.choice(members)
            content = random.choice(group_message_templates)
            
            message = Message(
                sender_id=sender.id,
                group_id=group.id,
                content=content,
                is_read=False,
                created_at=base_time + timedelta(hours=j * random.randint(2, 5))
            )
            db.add(message)
            messages_created += 1
        
        groups_created += 1
    
    db.commit()
    print(f"✅ Created {messages_created} messages")
    print(f"✅ Created {groups_created} group chats\n")
    
    print("🎉 Sample data seeding complete!")
    print(f"\n📊 Summary:")
    print(f"   - Users: {len(created_users)}")
    print(f"   - Events: {len(created_events)}")
    print(f"   - Buddies: {buddies_created}")
    print(f"   - Messages: {messages_created}")
    print(f"   - Group Chats: {groups_created}")
    print(f"\n🔑 Test credentials:")
    print(f"   - All users have password: password123")
    print(f"   - Try logging in with: alice@example.com / password123")


def clean_sample_data(db: Session):
    """Remove all sample data (users, events, buddies)"""
    print("🧹 Cleaning sample data...")
    
    # Delete buddies
    buddies_deleted = db.query(Buddy).delete()
    print(f"  ✅ Deleted {buddies_deleted} buddies")
    
    # Delete event RSVPs
    from sqlalchemy import delete
    rsvps_deleted = db.execute(delete(event_rsvps)).rowcount
    print(f"  ✅ Deleted {rsvps_deleted} event RSVPs")
    
    # Delete events
    events_deleted = db.query(Event).delete()
    print(f"  ✅ Deleted {events_deleted} events")
    
    # Delete subscriptions
    subscriptions_deleted = db.query(Subscription).delete()
    print(f"  ✅ Deleted {subscriptions_deleted} subscriptions")
    
    # Delete users (except keep sports and goals)
    users_deleted = db.query(User).delete()
    print(f"  ✅ Deleted {users_deleted} users")
    
    db.commit()
    print("✅ Sample data cleaned!")


if __name__ == "__main__":
    import sys
    
    db = SessionLocal()
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "clean":
            clean_sample_data(db)
        else:
            seed_sample_data(db)
    finally:
        db.close()

