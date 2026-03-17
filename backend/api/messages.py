from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from supabase import Client
from typing import List, Optional
from datetime import datetime
from core.database import get_supabase
from api.auth import get_current_user
from schemas.message import MessageCreate, MessageResponse, MessageDetail
from core.security import verify_token
import json

router = APIRouter(prefix="/messages", tags=["messages"])

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[int, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)
    
    async def broadcast_to_event(self, message: dict, event_id: int, supabase: Client):
        """Broadcast message to all event participants using Supabase"""
        try:
            # Get all participants of the event (approved RSVPs)
            rsvps_result = supabase.table("event_rsvps").select("user_id").eq("event_id", event_id).eq("status", "approved").execute()
            if rsvps_result.data:
                participant_ids = [rsvp.get("user_id") for rsvp in rsvps_result.data]
                for user_id in participant_ids:
                    if user_id in self.active_connections:
                        await self.active_connections[user_id].send_json(message)
        except Exception:
            # If query fails, just continue (participants won't get message)
            pass

manager = ConnectionManager()


@router.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    """WebSocket endpoint for real-time messaging"""
    try:
        supabase: Client = get_supabase()
    except Exception:
        await websocket.close(code=1008, reason="Supabase connection error")
        return
    
    # Verify token with Supabase
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        supabase_user = user_response.user
        email = supabase_user.email
        
        # Get user data from Supabase database
        user_result = supabase.table("users").select("id, email").eq("email", email).single().execute()
        if not user_result.data:
            await websocket.close(code=1008, reason="User not found")
            return
        
        user_id = user_result.data.get("id")
        await manager.connect(websocket, user_id)
        
        try:
            while True:
                data = await websocket.receive_json()
                message_type = data.get("type")
                
                if message_type == "message":
                    # Create message
                    content = data.get("content")
                    receiver_id = data.get("receiver_id")
                    event_id = data.get("event_id")
                    group_id = data.get("group_id")
                    
                    if not content:
                        continue
                    
                    # Validate receiver, event, or group
                    if receiver_id:
                        try:
                            receiver_result = supabase.table("users").select("id").eq("id", receiver_id).single().execute()
                            if not receiver_result.data:
                                continue
                        except Exception:
                            continue
                    elif event_id:
                        try:
                            event_result = supabase.table("events").select("id").eq("id", event_id).single().execute()
                            if not event_result.data:
                                continue
                        except Exception:
                            continue
                    elif group_id:
                        try:
                            # Check if user is a member
                            member_result = supabase.table("group_members").select("user_id").eq("group_id", group_id).eq("user_id", user_id).execute()
                            if not member_result.data or len(member_result.data) == 0:
                                continue
                        except Exception:
                            continue
                    else:
                        continue
                    
                    # Create message in database
                    try:
                        message_result = supabase.table("messages").insert({
                            "sender_id": user_id,
                            "receiver_id": receiver_id,
                            "event_id": event_id,
                            "group_id": group_id,
                            "content": content,
                            "is_read": False
                        }).execute()
                        
                        if not message_result.data or len(message_result.data) == 0:
                            continue
                        
                        new_message = message_result.data[0]
                        
                        # Get sender info
                        sender_result = supabase.table("users").select("id, full_name, avatar_url").eq("id", user_id).single().execute()
                        sender_data = sender_result.data if sender_result.data else {}
                        
                        # Prepare message response
                        message_data = {
                            "id": new_message.get("id"),
                            "sender_id": new_message.get("sender_id"),
                            "receiver_id": new_message.get("receiver_id"),
                            "event_id": new_message.get("event_id"),
                            "group_id": new_message.get("group_id"),
                            "content": new_message.get("content"),
                            "is_read": new_message.get("is_read", False),
                            "created_at": new_message.get("created_at"),
                            "sender": {
                                "id": sender_data.get("id"),
                                "full_name": sender_data.get("full_name"),
                                "avatar_url": sender_data.get("avatar_url")
                            }
                        }
                        
                        # Send to receiver or broadcast to event/group
                        if receiver_id:
                            await manager.send_personal_message(message_data, receiver_id)
                        elif event_id:
                            await manager.broadcast_to_event(message_data, event_id, supabase)
                        elif group_id:
                            # Get all group members and send to them
                            try:
                                members_result = supabase.table("group_members").select("user_id").eq("group_id", group_id).execute()
                                if members_result.data:
                                    for member in members_result.data:
                                        member_id = member.get("user_id")
                                        if member_id != user_id and member_id in manager.active_connections:
                                            await manager.send_personal_message(message_data, member_id)
                            except Exception:
                                pass
                        
                        # Echo back to sender
                        await manager.send_personal_message(message_data, user_id)
                    except Exception:
                        # If message creation fails, continue
                        continue
                
                elif message_type == "read":
                    # Mark message as read
                    message_id = data.get("message_id")
                    if message_id:
                        try:
                            # Get message and verify receiver
                            msg_result = supabase.table("messages").select("receiver_id").eq("id", message_id).single().execute()
                            if msg_result.data and msg_result.data.get("receiver_id") == user_id:
                                supabase.table("messages").update({"is_read": True}).eq("id", message_id).execute()
                        except Exception:
                            pass
        
        except WebSocketDisconnect:
            manager.disconnect(user_id)
    except Exception as e:
        await websocket.close(code=1008, reason=f"Connection error: {str(e)}")


@router.post("", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def create_message(
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a message (1:1, event, or group chat)"""
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
    
    # Validate receiver, event, or group
    if message_data.receiver_id:
        try:
            receiver_result = supabase.table("users").select("id").eq("id", message_data.receiver_id).single().execute()
            if not receiver_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Receiver not found"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receiver not found"
            )
    elif message_data.event_id:
        try:
            event_result = supabase.table("events").select("id").eq("id", message_data.event_id).single().execute()
            if not event_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Event not found"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Event not found"
            )
    elif message_data.group_id:
        try:
            group_result = supabase.table("group_chats").select("id").eq("id", message_data.group_id).single().execute()
            if not group_result.data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Group not found"
                )
            
            # Check if user is a member
            member_result = supabase.table("group_members").select("user_id").eq("group_id", message_data.group_id).eq("user_id", user_id).execute()
            if not member_result.data or len(member_result.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not a member of this group"
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group not found"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either receiver_id, event_id, or group_id must be provided"
        )
    
    # Create message
    try:
        message_data_dict = {
            "sender_id": user_id,
            "receiver_id": message_data.receiver_id,
            "event_id": message_data.event_id,
            "group_id": message_data.group_id,
            "content": message_data.content,
            "is_read": False
        }
        
        # Add image_url if provided
        if message_data.image_url:
            message_data_dict["image_url"] = message_data.image_url
        
        message_result = supabase.table("messages").insert(message_data_dict).execute()
        
        if not message_result.data or len(message_result.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create message"
            )
        
        new_message = message_result.data[0]
        return MessageResponse(
            id=new_message["id"],
            sender_id=new_message["sender_id"],
            receiver_id=new_message.get("receiver_id"),
            event_id=new_message.get("event_id"),
            group_id=new_message.get("group_id"),
            content=new_message["content"],
            image_url=new_message.get("image_url"),
            is_read=new_message.get("is_read", False),
            created_at=datetime.fromisoformat(new_message["created_at"].replace("Z", "+00:00")) if isinstance(new_message.get("created_at"), str) else new_message.get("created_at")
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create message: {str(e)}"
        )


@router.get("/conversations", response_model=List[dict])
async def list_conversations(
    current_user: dict = Depends(get_current_user)
):
    """List all conversations for current user"""
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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User session invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        conversations_result = supabase.rpc("list_conversations_for_user", {"_user_id": user_id}).execute()
        conversations_rows = conversations_result.data if conversations_result.data else []
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to load conversations: {str(e)}"
        )

    conversations = []
    for row in conversations_rows:
        conversations.append({
            "type": row.get("conversation_type"),
            "id": row.get("conversation_id"),
            "name": row.get("name"),
            "avatar_url": row.get("avatar_url"),
            "member_count": row.get("member_count"),
            "last_message": {
                "content": row.get("last_message_content"),
                "created_at": row.get("last_message_created_at")
            },
            "unread_count": row.get("unread_count", 0)
        })
    
    return conversations


@router.post("/conversations/{conversation_id}/mark-read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_conversation_read(
    conversation_id: int,
    conversation_type: str = Query("user", description="Type: user, event, or group"),
    current_user: dict = Depends(get_current_user)
):
    """Mark all messages in a conversation as read"""
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
        if conversation_type == "user":
            # Mark all messages from this user as read
            supabase.table("messages").update({"is_read": True}).eq("sender_id", conversation_id).eq("receiver_id", user_id).eq("is_read", False).execute()
        elif conversation_type == "event":
            # Mark all messages in this event as read (where user is receiver)
            supabase.table("messages").update({"is_read": True}).eq("event_id", conversation_id).eq("receiver_id", user_id).eq("is_read", False).execute()
        elif conversation_type == "group":
            # Mark all messages in this group as read (where user is receiver)
            supabase.table("messages").update({"is_read": True}).eq("group_id", conversation_id).eq("receiver_id", user_id).eq("is_read", False).execute()
    except Exception as e:
        # If marking as read fails, continue (don't block the user)
        pass
    
    return None


@router.get("/conversations/{conversation_id}", response_model=List[MessageDetail])
async def get_conversation(
    conversation_id: int,
    conversation_type: str = Query("user", description="Type: user, event, or group"),
    current_user: dict = Depends(get_current_user)
):
    """Get messages in a conversation"""
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
    
    messages_data = []
    
    if conversation_type == "user":
        # Get messages between current user and conversation user
        try:
            # Get messages where current user is sender and conversation user is receiver
            sent_result = supabase.table("messages").select("*").eq("sender_id", user_id).eq("receiver_id", conversation_id).is_("event_id", "null").is_("group_id", "null").order("created_at", desc=False).execute()
            if sent_result.data:
                messages_data.extend(sent_result.data)
            
            # Get messages where conversation user is sender and current user is receiver
            received_result = supabase.table("messages").select("*").eq("sender_id", conversation_id).eq("receiver_id", user_id).is_("event_id", "null").is_("group_id", "null").order("created_at", desc=False).execute()
            if received_result.data:
                messages_data.extend(received_result.data)
        except Exception:
            messages_data = []
    elif conversation_type == "event":
        # Get messages for event
        try:
            messages_result = supabase.table("messages").select("*").eq("event_id", conversation_id).order("created_at", desc=False).execute()
            messages_data = messages_result.data if messages_result.data else []
        except Exception:
            messages_data = []
    else:  # group
        # Check if user is a member
        try:
            member_result = supabase.table("group_members").select("user_id").eq("group_id", conversation_id).eq("user_id", user_id).execute()
            if not member_result.data or len(member_result.data) == 0:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not a member of this group"
                )
            
            # Get messages for group
            messages_result = supabase.table("messages").select("*").eq("group_id", conversation_id).order("created_at", desc=False).execute()
            messages_data = messages_result.data if messages_result.data else []
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not a member of this group"
            )
    
    # Sort messages by created_at
    messages_data.sort(key=lambda x: x.get("created_at", ""))

    sender_ids = {msg.get("sender_id") for msg in messages_data if msg.get("sender_id") is not None}
    receiver_ids = {msg.get("receiver_id") for msg in messages_data if msg.get("receiver_id") is not None}
    message_event_ids = {msg.get("event_id") for msg in messages_data if msg.get("event_id") is not None}

    users_by_id = {}
    if sender_ids or receiver_ids:
        try:
            user_ids = list(sender_ids.union(receiver_ids))
            users_result = supabase.table("users").select("id, full_name, avatar_url").in_("id", user_ids).execute()
            if users_result.data:
                users_by_id = {u["id"]: u for u in users_result.data}
        except Exception:
            users_by_id = {}

    events_by_id = {}
    if message_event_ids:
        try:
            events_result = supabase.table("events").select("id, title").in_("id", list(message_event_ids)).execute()
            if events_result.data:
                events_by_id = {e["id"]: e for e in events_result.data}
        except Exception:
            events_by_id = {}
    
    # Build result with user/event details
    result = []
    for msg in messages_data:
        # Get sender info
        sender_info = users_by_id.get(msg.get("sender_id")) if msg.get("sender_id") is not None else None
        if sender_info:
            sender_data = {
                "id": sender_info.get("id"),
                "full_name": sender_info.get("full_name") or "Unknown",
                "avatar_url": sender_info.get("avatar_url")
            }
        else:
            sender_data = {"id": msg.get("sender_id"), "full_name": "Unknown", "avatar_url": None}
        
        # Get receiver info (if exists)
        receiver_data = None
        if msg.get("receiver_id"):
            receiver_info = users_by_id.get(msg.get("receiver_id"))
            if receiver_info:
                receiver_data = {
                    "id": receiver_info.get("id"),
                    "full_name": receiver_info.get("full_name") or "Unknown",
                    "avatar_url": receiver_info.get("avatar_url")
                }
            else:
                receiver_data = {"id": msg.get("receiver_id"), "full_name": "Unknown", "avatar_url": None}
        
        # Get event info (if exists)
        event_data = None
        if msg.get("event_id"):
            event_info = events_by_id.get(msg.get("event_id"))
            if event_info:
                event_data = {
                    "id": event_info.get("id"),
                    "title": event_info.get("title") or "Unknown Event"
                }
            else:
                event_data = {"id": msg.get("event_id"), "title": "Unknown Event"}
        
        result.append(MessageDetail(
            id=msg.get("id"),
            sender_id=msg.get("sender_id"),
            receiver_id=msg.get("receiver_id"),
            event_id=msg.get("event_id"),
            group_id=msg.get("group_id"),
            content=msg.get("content"),
            image_url=msg.get("image_url"),
            is_read=msg.get("is_read", False),
            created_at=datetime.fromisoformat(msg["created_at"].replace("Z", "+00:00")) if isinstance(msg.get("created_at"), str) else msg.get("created_at"),
            sender=sender_data,
            receiver=receiver_data,
            event=event_data
        ))
    
    return result
