from fastapi import APIRouter, Depends, HTTPException, status, Query
from supabase import Client
from typing import Optional, List
import logging
from core.database import get_supabase
from api.auth import get_current_user, get_current_user_optional
from schemas.post import PostCreate, PostResponse

router = APIRouter(prefix="/posts", tags=["posts"])
logger = logging.getLogger(__name__)


@router.post("", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post(
    post_data: PostCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new post"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Create post
    post_result = supabase.table("posts").insert({
        "user_id": user_id,
        "content": post_data.content,
        "image_url": post_data.image_url
    }).execute()
    
    if not post_result.data or len(post_result.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create post"
        )
    
    new_post = post_result.data[0]
    
    # Get like count
    likes_result = supabase.table("likes").select("id", count="exact").eq("post_id", new_post["id"]).execute()
    like_count = likes_result.count if likes_result.count is not None else 0
    
    # Check if current user liked it
    user_like = supabase.table("likes").select("id").eq("post_id", new_post["id"]).eq("user_id", user_id).execute()
    is_liked = len(user_like.data) > 0 if user_like.data else False
    
    # Get user info (with error handling for missing users)
    user_dict = None
    try:
        user_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", user_id).single().execute()
        if user_result.data:
            user_dict = {
                "id": user_result.data.get("id"),
                "full_name": user_result.data.get("full_name") or "Unknown User",
                "avatar_url": user_result.data.get("avatar_url")
            }
    except Exception:
        # User not found, use defaults
        user_dict = {
            "id": user_id,
            "full_name": "Unknown User",
            "avatar_url": None
        }
    
    return PostResponse(
        id=new_post["id"],
        user_id=new_post["user_id"],
        content=new_post["content"],
        image_url=new_post.get("image_url"),
        created_at=new_post["created_at"],
        updated_at=new_post.get("updated_at"),
        like_count=like_count,
        is_liked=is_liked,
        user=user_dict
    )


@router.get("", response_model=List[PostResponse])
async def get_posts(
    user_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get posts, optionally filtered by user_id"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    # Build query
    query = supabase.table("posts").select("*")
    
    if user_id:
        query = query.eq("user_id", user_id)
    
    # Order by created_at desc, apply limit and offset - handle errors gracefully
    try:
        posts_result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    except Exception:
        logger.exception(
            "Operational failure listing posts",
            extra={
                "user_id": user_id,
                "limit": limit,
                "offset": offset,
                "has_current_user": bool(current_user and isinstance(current_user, dict)),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable"
        )
    
    if not posts_result.data:
        return []
    
    result = []
    current_user_id = current_user.get("id") if current_user and isinstance(current_user, dict) else None
    
    for post in posts_result.data:
        # Get like count - handle errors gracefully
        like_count = 0
        try:
            likes_result = supabase.table("likes").select("id", count="exact").eq("post_id", post["id"]).execute()
            like_count = likes_result.count if likes_result.count is not None else 0
        except Exception:
            like_count = 0
        
        # Check if current user liked it - handle errors gracefully
        is_liked = False
        if current_user_id:
            try:
                user_like = supabase.table("likes").select("id").eq("post_id", post["id"]).eq("user_id", current_user_id).execute()
                is_liked = len(user_like.data) > 0 if user_like.data else False
            except Exception:
                is_liked = False
        
        # Get user info (with error handling for missing users)
        user_dict = None
        try:
            user_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", post["user_id"]).single().execute()
            if user_result.data:
                user_dict = {
                    "id": user_result.data.get("id"),
                    "full_name": user_result.data.get("full_name") or "Unknown User",
                    "avatar_url": user_result.data.get("avatar_url")
                }
        except Exception:
            # User not found, use defaults
            user_dict = {
                "id": post["user_id"],
                "full_name": "Unknown User",
                "avatar_url": None
            }
        
        result.append(PostResponse(
            id=post["id"],
            user_id=post["user_id"],
            content=post["content"],
            image_url=post.get("image_url"),
            created_at=post["created_at"],
            updated_at=post.get("updated_at"),
            like_count=like_count,
            is_liked=is_liked,
            user=user_dict
        ))
    
    return result


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: int,
    current_user: Optional[dict] = Depends(get_current_user_optional)
):
    """Get a specific post by ID"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    post_result = supabase.table("posts").select("*").eq("id", post_id).single().execute()
    
    if not post_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    post = post_result.data
    
    # Get like count
    likes_result = supabase.table("likes").select("id", count="exact").eq("post_id", post_id).execute()
    like_count = likes_result.count if likes_result.count is not None else 0
    
    # Check if current user liked it
    is_liked = False
    if current_user:
        current_user_id = current_user.get("id") if isinstance(current_user, dict) else None
        if current_user_id:
            user_like = supabase.table("likes").select("id").eq("post_id", post_id).eq("user_id", current_user_id).execute()
            is_liked = len(user_like.data) > 0 if user_like.data else False
    
    # Get user info
    user_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", post["user_id"]).single().execute()
    user_dict = None
    if user_result.data:
        user_dict = {
            "id": user_result.data.get("id"),
            "full_name": user_result.data.get("full_name"),
            "avatar_url": user_result.data.get("avatar_url")
        }
    
    return PostResponse(
        id=post["id"],
        user_id=post["user_id"],
        content=post["content"],
        image_url=post.get("image_url"),
        created_at=post["created_at"],
        updated_at=post.get("updated_at"),
        like_count=like_count,
        is_liked=is_liked,
        user=user_dict
    )


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a post (only by the owner)"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Check if post exists and belongs to user
    post_result = supabase.table("posts").select("user_id").eq("id", post_id).single().execute()
    
    if not post_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    if post_result.data.get("user_id") != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this post"
        )
    
    # Delete post (cascade should handle likes)
    supabase.table("posts").delete().eq("id", post_id).execute()
    
    return None


@router.post("/{post_id}/like", response_model=PostResponse)
async def like_post(
    post_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Like or unlike a post"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    user_id = current_user.get("id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    # Check if post exists
    post_result = supabase.table("posts").select("*").eq("id", post_id).single().execute()
    
    if not post_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    post = post_result.data
    
    # Check if already liked
    existing_like = supabase.table("likes").select("id").eq("post_id", post_id).eq("user_id", user_id).execute()
    
    if existing_like.data and len(existing_like.data) > 0:
        # Unlike - delete the like
        supabase.table("likes").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
        is_liked = False
    else:
        # Like - create the like
        try:
            supabase.table("likes").insert({
                "post_id": post_id,
                "user_id": user_id
            }).execute()
            is_liked = True
        except Exception as e:
            # If unique constraint violation, it means like already exists (race condition)
            if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                # Try to delete it
                supabase.table("likes").delete().eq("post_id", post_id).eq("user_id", user_id).execute()
                is_liked = False
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to like post"
                )
    
    # Get updated like count
    likes_result = supabase.table("likes").select("id", count="exact").eq("post_id", post_id).execute()
    like_count = likes_result.count if likes_result.count is not None else 0
    
    # Get user info
    user_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", post["user_id"]).single().execute()
    user_dict = None
    if user_result.data:
        user_dict = {
            "id": user_result.data.get("id"),
            "full_name": user_result.data.get("full_name"),
            "avatar_url": user_result.data.get("avatar_url")
        }
    
    return PostResponse(
        id=post["id"],
        user_id=post["user_id"],
        content=post["content"],
        image_url=post.get("image_url"),
        created_at=post["created_at"],
        updated_at=post.get("updated_at"),
        like_count=like_count,
        is_liked=is_liked,
        user=user_dict
    )
