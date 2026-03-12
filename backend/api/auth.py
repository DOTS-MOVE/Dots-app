from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
from core.database import get_supabase
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])

http_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    authorization: Optional[str] = Header(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> dict:
    """Get current user from Supabase JWT token"""
    token_str = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_str = parts[1]
    elif credentials:
        token_str = credentials.credentials
    
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
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)
) -> Optional[dict]:
    """Get current user from Supabase JWT token (optional - returns None if not authenticated)"""
    token_str = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token_str = parts[1]
    elif credentials:
        token_str = credentials.credentials    
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

