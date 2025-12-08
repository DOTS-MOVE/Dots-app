'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { api } from '@/lib/api';
import { Conversation, Message } from '@/types';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
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
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const messageData: any = {
        content: newMessage,
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
      await loadMessages();
      await loadConversations();
      inputRef.current?.focus();
    } catch (error: any) {
      alert(error.message || 'Failed to send message');
    }
  };

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
          <div className="bg-gradient-to-r from-[#00D9A5] to-[#00B88A] px-6 py-5 flex items-center justify-between shadow-md">
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
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Search or start new chat"
                className="w-full pl-10 pr-4 py-2.5 bg-white rounded-2xl text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00D9A5] focus:border-transparent"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <p>No conversations yet</p>
                <p className="text-sm mt-2">Start a new chat to get started!</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = selectedConversation === conv.id && conversationType === conv.type;
                return (
                  <button
                    key={`${conv.type}-${conv.id}`}
                    onClick={() => {
                      setSelectedConversation(conv.id);
                      setConversationType(conv.type);
                      router.push(`/messages?id=${conv.id}&type=${conv.type}`);
                    }}
                    className={`w-full p-4 text-left border-b border-gray-100 hover:bg-[#E6F9F4] transition-colors ${
                      isSelected ? 'bg-[#E6F9F4] border-l-4 border-l-[#00D9A5]' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        <div className="w-12 h-12 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
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
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#00D9A5] rounded-full border-2 border-white flex items-center justify-center">
                            <span className="text-xs">👥</span>
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
                            <span className="bg-[#00D9A5] text-black text-xs rounded-full w-5 h-5 flex items-center justify-center font-semibold ml-2 flex-shrink-0">
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
              <div className="bg-gradient-to-r from-[#00D9A5] to-[#00B88A] px-6 py-4 flex items-center justify-between shadow-lg">
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
                  <div className="w-10 h-10 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
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
                      <div className="text-4xl mb-4">💬</div>
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
                          <div className="w-8 h-8 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white text-xs font-semibold overflow-hidden flex-shrink-0">
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
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
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
                <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
                  <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2.5 flex items-center">
                    <button type="button" className="text-gray-500 hover:text-gray-700 mr-2 text-xl">
                      😊
                    </button>
                    <input
                      ref={inputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 bg-transparent text-sm focus:outline-none"
                    />
                    <button type="button" className="text-gray-500 hover:text-gray-700 ml-2 text-xl">
                      📎
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="w-12 h-12 bg-[#00D9A5] text-black rounded-full flex items-center justify-center hover:bg-[#00B88A] transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-md"
                  >
                    <span className="text-xl">➤</span>
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white">
              <div className="text-center text-gray-600">
                <div className="text-7xl mb-6 opacity-30">💬</div>
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
