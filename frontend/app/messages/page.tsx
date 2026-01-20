'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { api } from '@/lib/api';
import { Conversation, Message } from '@/types';
import { uploadImage } from '@/lib/storage';
import Link from 'next/link';

function MessagesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [conversationType, setConversationType] = useState<'user' | 'event' | 'group'>('user');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    
    // Check URL params for conversation
    const convId = searchParams?.get('id');
    const convType = searchParams?.get('type') as 'user' | 'event' | 'group' | null;
    if (convId && convType) {
      setSelectedConversation(parseInt(convId));
      setConversationType(convType);
    }
  }, [user, searchParams]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages();
    }
  }, [selectedConversation, conversationType]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedConversation) return;
    try {
      const data = await api.getConversation(selectedConversation, conversationType);
      setMessages(data);
      // Mark as read and reload conversations to update unread counts
      await api.markConversationRead(selectedConversation, conversationType);
      await loadConversations();
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !selectedConversation) return;

    setUploadingImage(false);
    try {
      let imageUrl: string | undefined = undefined;

      // Upload image if provided
      if (imageFile) {
        setUploadingImage(true);
        try {
          const folder = conversationType === 'group' 
            ? `messages/groups/${selectedConversation}`
            : conversationType === 'event'
            ? `messages/events/${selectedConversation}`
            : `messages/users/${selectedConversation}`;
          imageUrl = await uploadImage(imageFile, 'images', folder);
        } catch (error: any) {
          console.error('Failed to upload image:', error);
          alert(`Failed to upload image: ${error.message}`);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      const messageData: any = {
        content: newMessage.trim() || (imageUrl ? '📷' : ''),
        image_url: imageUrl,
      };
      
      if (conversationType === 'user') {
        messageData.receiver_id = selectedConversation;
      } else if (conversationType === 'event') {
        messageData.event_id = selectedConversation;
      } else if (conversationType === 'group') {
        messageData.group_id = selectedConversation;
      }

      await api.sendMessage(messageData);
      setNewMessage('');
      setImageFile(null);
      setImagePreview(null);
      setShowEmojiPicker(false);
      await loadMessages();
      await loadConversations();
      inputRef.current?.focus();
    } catch (error: any) {
      alert(error.message || 'Failed to send message');
      setUploadingImage(false);
    }
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Common emojis for quick access
  const commonEmojis = ['😊', '👍', '❤️', '🎉', '🔥', '💪', '🏃', '⚽', '🏀', '🎾', '🏊', '🚴', '🧘', '🥾', '🏋️', '👏', '🙌', '🤝', '😄', '😎', '😍', '🥰', '🤔', '😮', '👍', '👎', '💯', '✨', '🌟', '⭐'];

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E5DDD5]">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      <div className="max-w-7xl mx-auto h-[calc(100vh-4rem)] flex bg-white rounded-3xl shadow-2xl overflow-hidden m-4">
        {/* Sidebar - Conversations List */}
        <div className={`w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Sidebar Header */}
          <div className="bg-gradient-to-r from-[#0ef9b4] to-[#0dd9a0] px-6 py-5 flex items-center justify-between shadow-md">
            <h1 className="text-xl font-bold text-black">Chats</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-black text-xl font-bold transition-colors"
              title="New chat"
            >
              +
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search or start new chat"
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>No conversations yet</p>
                <p className="text-sm mt-2">Start a new chat to get started!</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation === conv.id && conversationType === conv.type;
                return (
                  <button
                    key={`${conv.type}-${conv.id}`}
                    onClick={async () => {
                      setSelectedConversation(conv.id);
                      setConversationType(conv.type);
                      router.push(`/messages?id=${conv.id}&type=${conv.type}`);
                      // Mark as read immediately when opening
                      if (conv.unread_count > 0) {
                        await api.markConversationRead(conv.id, conv.type);
                        await loadConversations();
                      }
                    }}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-[#E6F9F4] transition-colors ${
                      isSelected ? 'bg-[#E6F9F4] border-l-4 border-l-[#0ef9b4]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
                          {conv.avatar_url ? (
                            <img 
                              src={conv.avatar_url} 
                              alt={conv.name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <span className="text-lg">{conv.name[0]?.toUpperCase() || '?'}</span>
                          )}
                        </div>
                        {conv.type === 'group' && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0ef9b4] rounded-full border-2 border-white flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Conversation Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-semibold text-gray-900 truncate text-sm">{conv.name}</p>
                          {conv.last_message.created_at && (
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                              {formatTime(conv.last_message.created_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate">
                            {conv.last_message.content || 'No messages'}
                          </p>
                          {conv.unread_count > 0 && (
                            <span className="bg-[#0ef9b4] text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold ml-2 flex-shrink-0">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col bg-white ${
          selectedConversation ? 'flex' : 'hidden md:flex'
        }`}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-[#0ef9b4] to-[#0dd9a0] px-6 py-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      router.push('/messages');
                    }}
                    className="md:hidden text-gray-600 hover:text-gray-900 mr-2"
                  >
                    ←
                  </button>
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
                    {selectedConv?.avatar_url ? (
                      <img 
                        src={selectedConv.avatar_url} 
                        alt={selectedConv.name} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span>{selectedConv?.name[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={conversationType === 'group' 
                        ? `/messages/groups/${selectedConversation}/settings`
                        : conversationType === 'event'
                        ? `/events/${selectedConversation}`
                        : `/profile/${selectedConversation}`
                      }
                      className="block"
                    >
                      <h2 className="font-semibold text-gray-900 truncate">{selectedConv?.name}</h2>
                      {conversationType === 'group' && (
                        <p className="text-xs text-gray-500">Group • {selectedConv?.member_count || 0} members</p>
                      )}
                    </Link>
                  </div>
                </div>
                <Link
                  href={conversationType === 'group' 
                    ? `/messages/groups/${selectedConversation}/settings`
                    : '/messages/settings'
                  }
                  className="text-gray-600 hover:text-gray-900 p-2"
                  title="Settings"
                >
                  ⚙️
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-1 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p>No messages yet</p>
                      <p className="text-sm mt-2">Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isMe = message.sender_id === user?.id;
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const showAvatar = !isMe && (
                      !prevMessage || 
                      prevMessage.sender_id !== message.sender_id ||
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000 // 5 minutes
                    );
                    const showTime = !prevMessage || 
                      new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime() > 300000;

                    return (
                      <div key={message.id} className={`flex items-end space-x-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {!isMe && showAvatar && (
                          <div className="w-8 h-8 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0">
                            {message.sender?.avatar_url ? (
                              <img 
                                src={message.sender.avatar_url} 
                                alt={message.sender.full_name || ''} 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <span>{message.sender?.full_name?.[0]?.toUpperCase() || '?'}</span>
                            )}
                          </div>
                        )}
                        {!isMe && !showAvatar && <div className="w-8" />}
                        <div className={`flex flex-col max-w-[70%] md:max-w-[60%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && showAvatar && conversationType !== 'user' && (
                            <span className="text-xs text-gray-600 mb-1 px-2 font-medium">
                              {message.sender?.full_name || 'Anonymous'}
                            </span>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl shadow-md ${
                              isMe
                                ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-sm'
                                : 'bg-white text-gray-900 rounded-tl-sm'
                            }`}
                          >
                            {message.image_url && (
                              <img 
                                src={message.image_url ?? undefined} 
                                alt="Message attachment" 
                                className="max-w-full h-auto rounded-lg mb-2 max-h-64 object-cover"
                              />
                            )}
                            {message.content && (
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                            )}
                            {showTime && (
                              <p className={`text-xs mt-1.5 flex items-center gap-1 ${isMe ? 'text-gray-600' : 'text-gray-500'}`}>
                                <span>{formatMessageTime(message.created_at)}</span>
                                {isMe && (
                                  <span className={message.is_read ? 'text-blue-500' : 'text-gray-400'}>
                                    {message.is_read ? '✓✓' : '✓'}
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="bg-white px-6 py-4 border-t border-gray-200 shadow-lg">
                {/* Image Preview */}
                {imagePreview && (
                  <div className="mb-4 relative inline-block bg-gray-100 p-2 rounded-xl border-2 border-[#0ef9b4]">
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      className="max-w-sm max-h-48 w-auto h-auto object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-md font-bold"
                      aria-label="Remove image"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      {imageFile?.name || 'Image preview'}
                    </div>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
                  <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2.5 flex items-center relative">
                    {/* Emoji Picker Button */}
                    <button 
                      type="button" 
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-gray-500 hover:text-gray-700 mr-2 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                      <div 
                        ref={emojiPickerRef}
                        className="absolute bottom-full left-0 mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 p-3 z-50 max-h-64 overflow-y-auto w-80"
                      >
                        <div className="grid grid-cols-8 gap-2">
                          {commonEmojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleEmojiClick(emoji)}
                              className="text-2xl hover:bg-gray-100 rounded-lg p-2 transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    
                    {/* Image Attachment Button */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-gray-500 hover:text-gray-700 ml-2 flex-shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !imageFile) || uploadingImage}
                    className="w-12 h-12 bg-[#0ef9b4] text-black rounded-full flex items-center justify-center hover:bg-[#0dd9a0] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
                  >
                    {uploadingImage ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center text-gray-600">
                <svg className="w-20 h-20 mx-auto mb-6 opacity-30 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-2xl font-bold mb-2 text-gray-700">Select a conversation</p>
                <p className="text-sm text-gray-500">Choose a chat from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
