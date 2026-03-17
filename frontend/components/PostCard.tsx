'use client';

import { Post } from '@/types';
import { api } from '@/lib/api';
import { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import ProfileAvatar from './ProfileAvatar';

interface PostCardProps {
  post: Post;
  onDelete?: (postId: number) => void;
  onUpdate?: (post: Post) => void;
}

export default function PostCard({ post, onDelete, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [liking, setLiking] = useState(false);

  const handleLike = async () => {
    if (liking) return;
    setLiking(true);
    try {
      const updatedPost = await api.likePost(post.id);
      setIsLiked(updatedPost.is_liked);
      setLikeCount(updatedPost.like_count);
      if (onUpdate) {
        onUpdate(updatedPost);
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    try {
      await api.deletePost(post.id);
      if (onDelete) {
        onDelete(post.id);
      }
    } catch (error) {
      console.error('Failed to delete post:', error);
      alert('Failed to delete post');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {post.user && (
            <ProfileAvatar
              userId={post.user.id}
              avatarUrl={post.user.avatar_url}
              fullName={post.user.full_name}
              size="sm"
            />
          )}
          {!post.user && (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
              <span className="text-gray-500 font-semibold">U</span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900">
              {post.user?.full_name || 'Anonymous'}
            </p>
            <p className="text-xs text-gray-500">{formatDate(post.created_at)}</p>
          </div>
        </div>
        {user?.id === post.user_id && (
          <button
            onClick={handleDelete}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Delete post"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-gray-800 mb-3 whitespace-pre-wrap">{post.content}</p>

      {/* Image */}
      {post.image_url && (
        <div className="mb-3 rounded-lg overflow-hidden">
          <Image
            src={post.image_url ?? undefined}
            alt="Post image"
            width={600}
            height={400}
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
        <button
          onClick={handleLike}
          disabled={liking}
          className={`flex items-center gap-2 transition-colors ${
            isLiked
              ? 'text-[#0ef9b4]'
              : 'text-gray-500 hover:text-[#0ef9b4]'
          }`}
        >
          <svg
            className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
          <span className="text-sm font-medium">{likeCount}</span>
        </button>
      </div>
    </div>
  );
}
