'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Post } from '@/types';
import { useAuth } from '@/lib/auth';

interface CreatePostFormProps {
  onPostCreated: (post: Post) => void;
  onCancel?: () => void;
}

export default function CreatePostForm({ onPostCreated, onCancel }: CreatePostFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear URL input when file is selected
      setImageUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setPosting(true);
    setUploadingImage(false);

    try {
      let finalImageUrl = imageUrl.trim();

      // Upload image file to Supabase Storage if provided
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await uploadImage(imageFile, 'images', 'posts');
        } catch (error: any) {
          alert(`Failed to upload image: ${error.message}`);
          setUploadingImage(false);
          setPosting(false);
          return;
        }
        setUploadingImage(false);
      }

      const newPost = await api.createPost({
        content: content.trim(),
        image_url: finalImageUrl || undefined,
      });
      onPostCreated(newPost);
      setContent('');
      setImageUrl('');
      setImageFile(null);
      setImagePreview(null);
      if (onCancel) {
        onCancel();
      }
    } catch (error: any) {
      console.error('Failed to create post:', error);
      alert(error.message || 'Failed to create post');
    } finally {
      setPosting(false);
      setUploadingImage(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#0ef9b4] flex items-center justify-center flex-shrink-0">
          <span className="text-black font-semibold">
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </span>
        </div>
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
            rows={4}
            disabled={posting}
          />
        </div>
      </div>

      <div className="mb-3 space-y-2">
        {imagePreview && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-gray-300">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => {
                setImageFile(null);
                setImagePreview(null);
              }}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <label className="block">
          <span className="sr-only">Upload image</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            disabled={posting || uploadingImage}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer disabled:opacity-50"
          />
        </label>
        <p className="text-xs text-gray-500">Or enter an image URL:</p>
        <input
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent"
          disabled={posting || uploadingImage || !!imageFile}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={posting}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={posting || uploadingImage || !content.trim()}
          className="px-6 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingImage ? 'Uploading image...' : posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </form>
  );
}
