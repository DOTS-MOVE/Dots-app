'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, Suspense } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { MessagesSkeleton } from '@/components/SkeletonLoader';
import LoadingScreen from '@/components/LoadingScreen';
import { CogIcon } from '@/components/Icons';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useConversations } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Conversation, Message } from '@/types';
import { uploadImage } from '@/lib/storage';
import Link from 'next/link';

function MessagesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { conversations, isLoading: isConversationsLoading, mutate: mutateConversations } = useConversations();
  const [selectedConversation, setSelectedConversation] = useState<number | null>(null);
  const [conversationType, setConversationType] = useState<'user' | 'event' | 'group'>('user');
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading: isMessagesLoading, mutate: mutateMessages } = useSWR<Message[]>(
    user && selectedConversation && conversationType
      ? ['conversation', selectedConversation, conversationType]
      : null,
    () => api.getConversation(selectedConversation!, conversationType!),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  );

  const loading = isConversationsLoading && conversations.length === 0;

  useEffect(() => {
    const convId = searchParams?.get('id');
    const convType = searchParams?.get('type') as 'user' | 'event' | 'group' | null;
    if (convId && convType) {
      setSelectedConversation(parseInt(convId));
      setConversationType(convType);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!selectedConversation || !conversationType) return;
    api.markConversationRead(selectedConversation, conversationType).catch(() => {});
    mutateConversations().catch(() => {});
  }, [selectedConversation, conversationType, mutateConversations]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
        content: newMessage.trim() || (imageUrl ? 'Photo' : ''),
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
      mutateMessages();
      mutateConversations();
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
      <div className="min-h-screen pb-20 md:pb-0 dots-gradient-bg">
        <Navbar />
        <MessagesSkeleton />
        <BottomNav />
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.id === selectedConversation);

  return (
    <div className="min-h-screen pb-20 md:pb-0 dots-gradient-bg">
      <Navbar />

      <div className="max-w-6xl mx-auto h-[calc(100vh-4rem)] flex bg-white rounded-2xl shadow-xl border border-white/50 overflow-hidden m-4">
        {/* Sidebar - Conversations List */}
        <div className={`w-full md:w-[340px] bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 ${
          selectedConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Sidebar Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">Messages</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="w-9 h-9 rounded-xl bg-[#0ef9b4] text-black flex items-center justify-center hover:bg-[#0dd9a0] transition-colors shadow-sm"
              title="New chat"
              aria-label="New chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-3 py-2.5 border-b border-gray-100">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search conversations"
                className="w-full pl-9 pr-4 py-2 bg-gray-50 rounded-xl text-sm border-0 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]/50 focus:bg-white placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="font-semibold text-gray-700">No conversations yet</p>
                <p className="text-sm text-gray-500 mt-1">Start a new chat from the button above</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation === conv.id && conversationType === conv.type;
                return (
                  <div
                    key={`${conv.type}-${conv.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedConversation(conv.id);
                      setConversationType(conv.type);
                      router.push(`/messages?id=${conv.id}&type=${conv.type}`);
                      if (conv.unread_count > 0) {
                        api.markConversationRead(conv.id, conv.type).catch(() => {});
                        mutateConversations().catch(() => {});
                      }
                    }}
                    className={`w-full px-4 py-3 text-left border-b border-gray-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#E6F9F4] border-l-4 border-l-[#0dd9a0]' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar - links to profile for user convs */}
                      <div className="relative flex-shrink-0" onClick={(e) => conv.type === 'user' && e.stopPropagation()}>
                        {conv.type === 'user' ? (
                          <ProfileAvatar
                            userId={conv.id}
                            avatarUrl={conv.avatar_url}
                            fullName={conv.name}
                            size="md"
                          />
                        ) : (
                          <>
                            <div className="w-12 h-12 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
                              {conv.avatar_url ? (
                                <img src={conv.avatar_url} alt={conv.name} className="w-full h-full object-cover" />
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
                          </>
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
                  </div>
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
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedConversation(null);
                      router.push('/messages');
                    }}
                    className="md:hidden p-2 -ml-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                    aria-label="Back to conversations"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {conversationType === 'user' ? (
                    <ProfileAvatar
                      userId={selectedConversation}
                      avatarUrl={selectedConv?.avatar_url}
                      fullName={selectedConv?.name}
                      size="sm"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
                      {selectedConv?.avatar_url ? (
                        <img src={selectedConv.avatar_url} alt={selectedConv.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{selectedConv?.name[0]?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={conversationType === 'group' 
                        ? `/messages/groups/${selectedConversation}/settings`
                        : conversationType === 'event'
                        ? `/events/${selectedConversation}`
                        : `/profile?userId=${selectedConversation}`
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
                  className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
                  title="Settings"
                  aria-label="Chat settings"
                >
                  <CogIcon className="w-5 h-5" aria-hidden />
                </Link>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 bg-[#f8fafc] min-h-0">
                {isMessagesLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <LoadingScreen message="Loading messages..." />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="font-semibold text-gray-700">No messages yet</p>
                    <p className="text-sm text-gray-500 mt-1">Send a message to start the conversation</p>
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
                      <div key={message.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        {!isMe && showAvatar && message.sender && (
                          <ProfileAvatar
                            userId={message.sender.id}
                            avatarUrl={message.sender.avatar_url}
                            fullName={message.sender.full_name}
                            size="xs"
                          />
                        )}
                        {!isMe && !showAvatar && <div className="w-8 shrink-0" />}
                        <div className={`flex flex-col max-w-[75%] md:max-w-[65%] ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && showAvatar && conversationType !== 'user' && (
                            <span className="text-[11px] text-gray-500 mb-1 font-medium">
                              {message.sender?.full_name || 'Anonymous'}
                            </span>
                          )}
                          <div
                            className={`px-4 py-2.5 rounded-2xl ${
                              isMe
                                ? 'bg-[#0ef9b4] text-gray-900 rounded-br-md shadow-sm'
                                : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                            }`}
                          >
                            {message.image_url && (
                              <img
                                src={message.image_url ?? undefined}
                                alt="Attachment"
                                className="max-w-full h-auto rounded-lg mb-2 max-h-64 object-cover"
                              />
                            )}
                            {message.content && (
                              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                            )}
                            {showTime && (
                              <p className={`text-[11px] mt-1.5 flex items-center gap-1 ${isMe ? 'text-gray-700/80' : 'text-gray-400'}`}>
                                <span>{formatMessageTime(message.created_at)}</span>
                                {isMe && (
                                  <span className={`inline-flex items-center gap-px ${message.is_read ? 'text-gray-800' : 'text-gray-500'}`} title={message.is_read ? 'Read' : 'Sent'}>
                                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                    {message.is_read && <svg className="w-3.5 h-3.5 -ml-2" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
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
              <div className="bg-white px-4 md:px-6 py-3 border-t border-gray-200 shrink-0">
                {/* Image Preview */}
                {imagePreview && (
                  <div className="mb-3 relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-w-[200px] max-h-36 w-auto h-auto object-cover rounded-xl border border-gray-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-900 transition-colors shadow"
                      aria-label="Remove image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-100 rounded-2xl pl-3 pr-2 py-2 flex items-center gap-1 relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/80 transition-colors flex-shrink-0"
                      aria-label="Insert emoji"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>

                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-3 z-50 max-h-56 overflow-y-auto w-72"
                      >
                        <div className="grid grid-cols-8 gap-1">
                          {commonEmojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleEmojiClick(emoji)}
                              className="text-xl hover:bg-gray-100 rounded-lg p-1.5 transition-colors"
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
                      placeholder="Message..."
                      className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-gray-400 py-1"
                    />

                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-200/80 transition-colors flex-shrink-0"
                      aria-label="Attach image"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !imageFile) || uploadingImage}
                    className="w-11 h-11 rounded-xl bg-[#0ef9b4] text-black flex items-center justify-center hover:bg-[#0dd9a0] transition-all shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Send message"
                  >
                    {uploadingImage ? (
                      <svg className="w-5 h-5 animate-spin text-gray-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
            <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] min-h-0">
              <div className="w-20 h-20 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mb-5">
                <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-gray-700 mb-1">Select a conversation</p>
              <p className="text-sm text-gray-500">Choose a chat from the list or start a new one</p>
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
      <div className="min-h-screen pb-20 md:pb-0 dots-gradient-bg">
        <Navbar />
        <MessagesSkeleton />
        <BottomNav />
      </div>
    }>
      <MessagesPageContent />
    </Suspense>
  );
}
