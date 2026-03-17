from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from typing import List
from datetime import datetime
from core.database import get_supabase
from api.auth import get_current_user
from schemas.group_chat import GroupChatCreate, GroupChatUpdate, GroupChatResponse, GroupChatDetail

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=GroupChatResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupChatCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group chat"""
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
    
    if not group_data.member_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one member is required"
        )
    
    # Ensure creator is in members
    member_ids = list(set([user_id] + group_data.member_ids))
    
    # Verify all members exist
    try:
        for member_id in member_ids:
            user_result = supabase.table("users").select("id").eq("id", member_id).single().execute()
            if not user_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User {member_id} not found"
                )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more users not found"
        )
    
    # Create group
    try:
        group_result = supabase.table("group_chats").insert({
            "name": group_data.name,
            "description": group_data.description,
            "avatar_url": group_data.avatar_url,
            "created_by_id": user_id
        }).execute()
        
        if not group_result.data or len(group_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create group"
            )
        
        new_group = group_result.data[0]
        group_id = new_group["id"]
        
        # Add members
        for member_id in member_ids:
            is_admin = member_id == user_id
            try:
                supabase.table("group_members").insert({
                    "group_id": group_id,
                    "user_id": member_id,
                    "is_admin": is_admin
                }).execute()
            except Exception:
                # If member already exists, continue
                pass
        
        return GroupChatResponse(
            id=new_group["id"],
            name=new_group["name"],
            description=new_group.get("description"),
            avatar_url=new_group.get("avatar_url"),
            created_by_id=new_group["created_by_id"],
            created_at=datetime.fromisoformat(new_group["created_at"].replace("Z", "+00:00")) if isinstance(new_group.get("created_at"), str) else new_group.get("created_at"),
            updated_at=datetime.fromisoformat(new_group["updated_at"].replace("Z", "+00:00")) if new_group.get("updated_at") and isinstance(new_group.get("updated_at"), str) else new_group.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create group: {str(e)}"
        )


@router.get("", response_model=List[GroupChatResponse])
async def list_groups(
    current_user: dict = Depends(get_current_user)
):
    """List all groups the current user is a member of"""
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
    
    try:
        # Get groups user is a member of
        member_result = supabase.table("group_members").select("group_id").eq("user_id", user_id).execute()
        if not member_result.data:
            return []
        
        group_ids = [m.get("group_id") for m in member_result.data if m.get("group_id")]
        if not group_ids:
            return []
        
        # Get group details
        groups_result = supabase.table("group_chats").select("*").in_("id", group_ids).execute()
        if not groups_result.data:
            return []
        
        groups = []
        for group_data in groups_result.data:
            groups.append(GroupChatResponse(
                id=group_data["id"],
                name=group_data["name"],
                description=group_data.get("description"),
                avatar_url=group_data.get("avatar_url"),
                created_by_id=group_data["created_by_id"],
                created_at=datetime.fromisoformat(group_data["created_at"].replace("Z", "+00:00")) if isinstance(group_data.get("created_at"), str) else group_data.get("created_at"),
                updated_at=datetime.fromisoformat(group_data["updated_at"].replace("Z", "+00:00")) if group_data.get("updated_at") and isinstance(group_data.get("updated_at"), str) else group_data.get("updated_at")
            ))
        
        return groups
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list groups: {str(e)}"
        )


@router.get("/{group_id}", response_model=GroupChatDetail)
async def get_group(
    group_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get group details"""
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
    
    try:
        # Get group
        group_result = supabase.table("group_chats").select("*").eq("id", group_id).single().execute()
        if not group_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        group_data = group_result.data
        
        # Check if user is a member
        member_result = supabase.table("group_members").select("user_id").eq("group_id", group_id).eq("user_id", user_id).execute()
        if not member_result.data or len(member_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group"
            )
        
        # Get members
        members_result = supabase.table("group_members").select("user_id, is_admin").eq("group_id", group_id).execute()
        member_data_list = []
        
        if members_result.data:
            # Get user details for each member
            for member_row in members_result.data:
                member_user_id = member_row.get("user_id")
                is_admin = member_row.get("is_admin", False)
                
                try:
                    user_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", member_user_id).single().execute()
                    if user_result.data:
                        member_data_list.append({
                            "id": user_result.data.get("id"),
                            "full_name": user_result.data.get("full_name") or "Unknown",
                            "avatar_url": user_result.data.get("avatar_url"),
                            "is_admin": is_admin
                        })
                except Exception:
                    # Skip members that can't be found
                    pass
        
        # Get created_by user
        created_by_data = {}
        try:
            created_by_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", group_data.get("created_by_id")).single().execute()
            if created_by_result.data:
                created_by_data = {
                    "id": created_by_result.data.get("id"),
                    "full_name": created_by_result.data.get("full_name") or "Unknown",
                    "avatar_url": created_by_result.data.get("avatar_url")
                }
        except Exception:
            created_by_data = {"id": group_data.get("created_by_id"), "full_name": "Unknown", "avatar_url": None}
        
        return GroupChatDetail(
            id=group_data["id"],
            name=group_data["name"],
            description=group_data.get("description"),
            avatar_url=group_data.get("avatar_url"),
            created_by_id=group_data["created_by_id"],
            created_at=datetime.fromisoformat(group_data["created_at"].replace("Z", "+00:00")) if isinstance(group_data.get("created_at"), str) else group_data.get("created_at"),
            updated_at=datetime.fromisoformat(group_data["updated_at"].replace("Z", "+00:00")) if group_data.get("updated_at") and isinstance(group_data.get("updated_at"), str) else group_data.get("updated_at"),
            members=member_data_list,
            created_by=created_by_data
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get group: {str(e)}"
        )


@router.put("/{group_id}", response_model=GroupChatResponse)
async def update_group(
    group_id: int,
    group_update: GroupChatUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update group (admin only)"""
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
    
    try:
        # Get group
        group_result = supabase.table("group_chats").select("*").eq("id", group_id).single().execute()
        if not group_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Check if user is admin
        member_result = supabase.table("group_members").select("is_admin").eq("group_id", group_id).eq("user_id", user_id).eq("is_admin", True).execute()
        if not member_result.data or len(member_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can update the group"
            )
        
        # Update group
        update_data = {}
        if group_update.name:
            update_data["name"] = group_update.name
        if group_update.description is not None:
            update_data["description"] = group_update.description
        if group_update.avatar_url is not None:
            update_data["avatar_url"] = group_update.avatar_url
        
        if update_data:
            update_data["updated_at"] = datetime.utcnow().isoformat()
            updated_result = supabase.table("group_chats").update(update_data).eq("id", group_id).execute()
            
            if not updated_result.data or len(updated_result.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update group"
                )
            
            updated_group = updated_result.data[0]
        else:
            updated_group = group_result.data
        
        return GroupChatResponse(
            id=updated_group["id"],
            name=updated_group["name"],
            description=updated_group.get("description"),
            avatar_url=updated_group.get("avatar_url"),
            created_by_id=updated_group["created_by_id"],
            created_at=datetime.fromisoformat(updated_group["created_at"].replace("Z", "+00:00")) if isinstance(updated_group.get("created_at"), str) else updated_group.get("created_at"),
            updated_at=datetime.fromisoformat(updated_group["updated_at"].replace("Z", "+00:00")) if updated_group.get("updated_at") and isinstance(updated_group.get("updated_at"), str) else updated_group.get("updated_at")
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update group: {str(e)}"
        )


@router.post("/{group_id}/members", response_model=dict)
async def add_members(
    group_id: int,
    data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add members to group (admin only)"""
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
    
    try:
        # Get group
        group_result = supabase.table("group_chats").select("*").eq("id", group_id).single().execute()
        if not group_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        # Check if user is admin
        member_result = supabase.table("group_members").select("is_admin").eq("group_id", group_id).eq("user_id", user_id).eq("is_admin", True).execute()
        if not member_result.data or len(member_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can add members"
            )
        
        user_ids = data.get("user_ids", [])
        if not user_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No user IDs provided"
            )
        
        # Verify users exist and add them
        for user_id_to_add in user_ids:
            try:
                # Verify user exists
                user_result = supabase.table("users").select("id").eq("id", user_id_to_add).single().execute()
                if not user_result.data:
                    continue
                
                # Check if already a member
                existing_result = supabase.table("group_members").select("user_id").eq("group_id", group_id).eq("user_id", user_id_to_add).execute()
                if existing_result.data and len(existing_result.data) > 0:
                    continue
                
                # Add member
                supabase.table("group_members").insert({
                    "group_id": group_id,
                    "user_id": user_id_to_add,
                    "is_admin": False
                }).execute()
            except Exception:
                # Skip users that can't be added
                continue
        
        return {"message": "Members added successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add members: {str(e)}"
        )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove member from group (admin or self)"""
    try:
        supabase: Client = get_supabase()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Supabase connection error: {str(e)}"
        )
    
    current_user_id = current_user.get("id")
    if not current_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID not found"
        )
    
    try:
        # Get group
        group_result = supabase.table("group_chats").select("created_by_id").eq("id", group_id).single().execute()
        if not group_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        created_by_id = group_result.data.get("created_by_id")
        
        # Don't allow removing the creator
        if user_id == created_by_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove group creator"
            )
        
        # Check if user is admin or removing themselves
        is_admin_result = supabase.table("group_members").select("is_admin").eq("group_id", group_id).eq("user_id", current_user_id).eq("is_admin", True).execute()
        is_admin = is_admin_result.data and len(is_admin_result.data) > 0
        
        if not is_admin and user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can remove other members"
            )
        
        # Remove member
        supabase.table("group_members").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove member: {str(e)}"
        )


@router.post("/{group_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
async def leave_group(
    group_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Leave a group"""
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
    
    try:
        # Get group
        group_result = supabase.table("group_chats").select("created_by_id").eq("id", group_id).single().execute()
        if not group_result.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
        
        created_by_id = group_result.data.get("created_by_id")
        
        # Don't allow creator to leave
        if created_by_id == user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group creator cannot leave the group"
            )
        
        # Remove member
        supabase.table("group_members").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to leave group: {str(e)}"
        )
