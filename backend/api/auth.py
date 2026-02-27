from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from supabase import Client
from sqlalchemy.orm import Session
from core.database import get_supabase, get_db
from core.security import verify_password, get_password_hash, create_access_token
from core.config import settings
from schemas.auth import UserRegister, Token
from models.user import User
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)


def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Depends(oauth2_scheme)
) -> dict:
    """Get current user from Supabase JWT token"""
    # Get token from header or oauth2_scheme
    token_str = None
    if authorization:
        # Extract token from "Bearer <token>"
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_str = parts[1]
    elif token:
        token_str = token
    
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify token with Supabase
    try:
        supabase: Client = get_supabase()
        user_response = supabase.auth.get_user(token_str)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        supabase_user = user_response.user
        
        # Get user data from Supabase database
        user_data_result = supabase.table("users").select("*").eq("email", supabase_user.email).execute()
        
        if not user_data_result.data or len(user_data_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found in database"
            )
        
        row = user_data_result.data[0]
        # Ensure "id" is always set (some Supabase/PostgREST setups use "uuid" or other key names)
        uid = row.get("id") or row.get("uuid")
        if uid is None and getattr(supabase_user, "id", None):
            uid = supabase_user.id
        if uid is not None:
            row = {**row, "id": uid}
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[dict]:
    """Get current user from Supabase JWT token (optional - returns None if not authenticated)"""
    # Get token from header or oauth2_scheme
    token_str = None
    if authorization:
        # Extract token from "Bearer <token>"
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_str = parts[1]
    elif token:
        token_str = token
    
    if not token_str:
        return None
    
    # Verify token with Supabase (return None on any error for optional auth)
    try:
        supabase: Client = get_supabase()
        user_response = supabase.auth.get_user(token_str)
        if not user_response or not user_response.user:
            return None
        
        supabase_user = user_response.user
        
        # Get user data from Supabase database
        user_data_result = supabase.table("users").select("*").eq("email", supabase_user.email).execute()
        
        if not user_data_result.data or len(user_data_result.data) == 0:
            return None
        
        row = user_data_result.data[0]
        uid = row.get("id") or row.get("uuid")
        if uid is None and getattr(supabase_user, "id", None):
            uid = supabase_user.id
        if uid is not None:
            row = {**row, "id": uid}
        return row
    except Exception:
        # Return None on any error for optional auth
        return None


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Create subscription for new user
    from models.subscription import Subscription, SubscriptionTier
    subscription = Subscription(
        user_id=new_user.id,
        tier=SubscriptionTier.FREE
    )
    db.add(subscription)
    db.commit()
    
    # Generate token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

