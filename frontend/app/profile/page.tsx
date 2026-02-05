'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { useSports, useGoals } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Sport, Goal, Post, Event, User } from '@/types';
import PostCard from '@/components/PostCard';
import CreatePostForm from '@/components/CreatePostForm';
import ProfileAvatar from '@/components/ProfileAvatar';
import EventManagementMenu from '@/components/EventManagementMenu';
import { ProfileHeaderSkeleton, PostSkeleton, EventSkeleton, FormSkeleton } from '@/components/SkeletonLoader';
import ConnectionMessageModal from '@/components/ConnectionMessageModal';
import Link from 'next/link';
import Image from 'next/image';
import { Buddy } from '@/types';
import { uploadProfileImage } from '@/lib/storage';

type Tab = 'posts' | 'events' | 'edit';

function ProfilePageContent() {
  const { user: currentUser, loading: authLoading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [viewingUserLoading, setViewingUserLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [contentLoading, setContentLoading] = useState(true);

  // Support ?tab=events or ?tab=edit in URL
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'events' || tabParam === 'edit' || tabParam === 'posts') {
      setActiveTab(tabParam as Tab);
    }
  }, [searchParams]);
  const [saving, setSaving] = useState(false);
  const { sports } = useSports();
  const { goals } = useGoals();
  const [posts, setPosts] = useState<Post[]>([]);
  const [userEvents, setUserEvents] = useState<{ owned: Event[]; attending: Event[]; attended: Event[] }>({
    owned: [],
    attending: [],
    attended: [],
  });
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState<boolean>(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [buddyStatus, setBuddyStatus] = useState<'none' | 'pending' | 'accepted' | 'rejected' | 'loading'>('loading');
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    bio: '',
    location: '',
    avatar_url: '',
    cover_image_url: '',
    sport_ids: [] as number[],
    goal_ids: [] as number[],
  });

  // Determine which user to display
  const user = viewingUser || currentUser;
  const isViewingOtherUser = viewingUser !== null;

  // Check for userId query param to view another user's profile
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const userIdParam = searchParams?.get('userId');
    if (userIdParam) {
      const userId = parseInt(userIdParam);
      if (!isNaN(userId) && userId !== currentUser?.id) {
        setViewingUserId(userId);
        setViewingUserLoading(true);
        setError(null);
        api.getUser(userId, { signal })
          .then((userData) => {
            if (signal.aborted) return;
            setViewingUser(userData);
            checkBuddyStatus(userId);
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return;
            console.error('Failed to load user profile:', err);
            setError('Failed to load user profile');
            setViewingUser(null);
          })
          .finally(() => {
            if (!signal.aborted) setViewingUserLoading(false);
          });
      } else {
        setViewingUserId(null);
        setViewingUser(null);
        setBuddyStatus('none');
        setViewingUserLoading(false);
      }
    } else {
      setViewingUserId(null);
      setViewingUser(null);
      setBuddyStatus('none');
      setViewingUserLoading(false);
    }

    return () => controller.abort();
  }, [searchParams, currentUser?.id]);

  const checkBuddyStatus = async (otherUserId: number) => {
    if (!currentUser?.id) {
      setBuddyStatus('none');
      return;
    }

    try {
      setBuddyStatus('loading');
      const buddies = await api.getBuddies();
      const buddy = buddies.find((b: Buddy) => 
        (b.user1_id === currentUser.id && b.user2_id === otherUserId) ||
        (b.user1_id === otherUserId && b.user2_id === currentUser.id)
      );
      
      if (buddy) {
        setBuddyStatus(buddy.status as 'pending' | 'accepted' | 'rejected');
      } else {
        setBuddyStatus('none');
      }
    } catch (error) {
      console.error('Failed to check buddy status:', error);
      setBuddyStatus('none');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleConnect = () => {
    if (!viewingUser) return;
    setShowConnectionModal(true);
  };

  const handleSendConnection = async (message: string) => {
    if (!viewingUser) return;
    
    setConnecting(true);
    try {
      await api.createBuddy(viewingUser.id, message);
      await checkBuddyStatus(viewingUser.id);
      setShowConnectionModal(false);
    } catch (error: any) {
      console.error('Failed to connect:', error);
      alert(error.message || 'Failed to send connection request');
    } finally {
      setConnecting(false);
    }
  };

  // Profile is ready when we have user to display (no blocking on posts/events)
  const profileLoading = isViewingOtherUser ? viewingUserLoading : authLoading;
  const loading = profileLoading; // alias for compatibility

  // Sync form data when user changes (for edit tab)
  useEffect(() => {
    if (user && !isViewingOtherUser) {
      const userPhotos = user.photos?.map((p: { photo_url: string }) => p.photo_url) || [];
      setFormData({
        full_name: user.full_name || '',
        age: user.age?.toString() || '',
        bio: user.bio || '',
        location: user.location || '',
        avatar_url: user.avatar_url || '',
        cover_image_url: user.cover_image_url || '',
        sport_ids: user.sports?.map(s => s.id).filter(Boolean) || [],
        goal_ids: user.goals?.map(g => g.id).filter(Boolean) || [],
      });
      setPhotos(userPhotos);
      setIsDiscoverable(user.is_discoverable || false);
    } else if (!user) {
      setFormData({
        full_name: '', age: '', bio: '', location: '',
        avatar_url: '', cover_image_url: '', sport_ids: [], goal_ids: [],
      });
      setPhotos([]);
      setIsDiscoverable(false);
    }
  }, [user, isViewingOtherUser]);

  // Load posts and events in background - doesn't block profile display
  useEffect(() => {
    if (!user?.id) {
      setPosts([]);
      setUserEvents({ owned: [], attending: [], attended: [] });
      setContentLoading(false);
      return;
    }
    const controller = new AbortController();
    const signal = controller.signal;
    setContentLoading(true);
    setError(null);

    const loadContent = async () => {
      try {
        if (isViewingOtherUser) {
          const postsData = await api.getPosts(user.id, 20, 0, { signal }).catch(() => []);
          if (signal.aborted) return;
          setPosts(postsData || []);
          setUserEvents({ owned: [], attending: [], attended: [] });
        } else {
          const [postsData, eventsData] = await Promise.all([
            api.getPosts(user.id, 20, 0, { signal }).catch(() => []),
            api.getMyEvents({ signal }).catch(() => ({ owned: [], attending: [], attended: [] })),
          ]);
          if (signal.aborted) return;
          setPosts(postsData || []);
          setUserEvents(eventsData || { owned: [], attending: [], attended: [] });
        }
      } catch {
        if (!signal.aborted) setPosts([]);
      } finally {
        if (!signal.aborted) setContentLoading(false);
      }
    };
    loadContent();
    return () => controller.abort();
  }, [user?.id, isViewingOtherUser]);

  const loadData = async () => {
    // Reload all data
    if (user && user.id) {
      try {
        const [postsData, eventsData] = await Promise.all([
          api.getPosts(user.id).catch((err) => {
            console.error('Failed to reload posts:', err);
            return [];
          }),
          api.getMyEvents().catch((err) => {
            console.error('Failed to reload events:', err);
            return { owned: [], attending: [], attended: [] };
          }),
        ]);
        setPosts(postsData || []);
        setUserEvents(eventsData || { owned: [], attending: [], attended: [] });
      } catch (error) {
        console.error('Failed to reload data:', error);
        // Set empty defaults on error
        setPosts([]);
        setUserEvents({ owned: [], attending: [], attended: [] });
      }
    }
  };

  const handlePostCreated = (newPost: Post) => {
    setPosts([newPost, ...posts]);
    setShowCreatePost(false);
  };

  const handlePostDeleted = (postId: number) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const handlePostUpdated = (updatedPost: Post) => {
    setPosts(posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  };

  const handleImageUpload = (type: 'avatar' | 'cover' | 'photo', file: File, index?: number) => {
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

    // Create preview using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === 'avatar') {
        setAvatarFile(file);
        setFormData({ ...formData, avatar_url: result }); // Preview URL
      } else if (type === 'cover') {
        setCoverFile(file);
        setFormData({ ...formData, cover_image_url: result }); // Preview URL
      } else if (type === 'photo' && index !== undefined) {
        const newPhotos = [...photos];
        const newPhotoFiles = [...photoFiles];
        newPhotos[index] = result; // Preview URL
        newPhotoFiles[index] = file;
        setPhotos(newPhotos);
        setPhotoFiles(newPhotoFiles);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleMultiplePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentPhotoCount = photos.filter(Boolean).length;
    const maxPhotos = 4;
    const remainingSlots = maxPhotos - currentPhotoCount;

    if (files.length > remainingSlots) {
      alert(`You can only add ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'}. You already have ${currentPhotoCount} photo${currentPhotoCount === 1 ? '' : 's'}.`);
      e.target.value = '';
      return;
    }

    // Validate all files
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} (not an image)`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} (larger than 5MB)`);
        continue;
      }
      validFiles.push(file);
    }

    if (invalidFiles.length > 0) {
      alert(`Some files were skipped:\n${invalidFiles.join('\n')}`);
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Find available slots
    const newPhotos = [...photos];
    const newPhotoFiles = [...photoFiles];
    const availableSlots: number[] = [];
    
    for (let i = 0; i < maxPhotos; i++) {
      if (!newPhotos[i]) {
        availableSlots.push(i);
      }
    }

    // Process files and fill available slots
    const fileReaders: Promise<void>[] = [];
    
    for (let i = 0; i < Math.min(validFiles.length, availableSlots.length); i++) {
      const file = validFiles[i];
      const slotIndex = availableSlots[i];
      
      const readerPromise = new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPhotos[slotIndex] = reader.result as string;
          newPhotoFiles[slotIndex] = file;
          resolve();
        };
        reader.readAsDataURL(file);
      });
      
      fileReaders.push(readerPromise);
    }

    // Update state once all files are processed
    Promise.all(fileReaders).then(() => {
      setPhotos([...newPhotos]);
      setPhotoFiles([...newPhotoFiles]);
    });

    // Reset input so same files can be selected again if needed
    e.target.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setUploadingImages(true);

    try {
      const userId = currentUser?.id;
      if (!userId) {
        throw new Error('User not found');
      }

      // Upload avatar and cover in parallel for faster saves
      const [avatarUrl, coverImageUrl] = await Promise.all([
        avatarFile
          ? uploadProfileImage(avatarFile, 'avatar', userId).catch((err: Error) => {
              alert(`Failed to upload avatar: ${err.message}`);
              throw err;
            })
          : Promise.resolve(formData.avatar_url),
        coverFile
          ? uploadProfileImage(coverFile, 'cover', userId).catch((err: Error) => {
              alert(`Failed to upload cover image: ${err.message}`);
              throw err;
            })
          : Promise.resolve(formData.cover_image_url),
      ]);

      // Update basic profile info with uploaded image URLs
      const updateData = {
        ...formData,
        avatar_url: avatarUrl,
        cover_image_url: coverImageUrl,
        age: formData.age ? parseInt(formData.age) : null,
        is_discoverable: isDiscoverable,
      };
      await api.updateUser(updateData);

      // Delete existing photos in parallel (don't block on failures)
      if (user?.photos?.length) {
        await Promise.allSettled(user.photos.map((p) => api.deleteUserPhoto(p.id)));
      }

      // Upload new photos and add to profile in parallel
      const photoPromises = photoFiles
        .map((file, index) => (file ? { file, index } : null))
        .filter((x): x is { file: File; index: number } => x !== null);

      const photoResults = await Promise.allSettled(
        photoPromises.map(async ({ file, index }) => {
          const photoUrl = await uploadProfileImage(file, 'photo', userId);
          await api.addUserPhoto(photoUrl, index);
        })
      );

      const photoError = photoResults.find((r) => r.status === 'rejected');
      if (photoError && photoError.status === 'rejected') {
        throw photoError.reason;
      }

      // Reset file states
      setAvatarFile(null);
      setCoverFile(null);
      setPhotoFiles([]);

      await refreshUser();
      setActiveTab('posts');
      alert('Profile updated successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
      setUploadingImages(false);
    }
  };

  const toggleSport = (sportId: number) => {
    setFormData(prev => ({
      ...prev,
      sport_ids: prev.sport_ids.includes(sportId)
        ? prev.sport_ids.filter(id => id !== sportId)
        : [...prev.sport_ids, sportId],
    }));
  };

  const toggleGoal = (goalId: number) => {
    setFormData(prev => ({
      ...prev,
      goal_ids: prev.goal_ids.includes(goalId)
        ? prev.goal_ids.filter(id => id !== goalId)
        : [...prev.goal_ids, goalId],
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <ProfileHeaderSkeleton />
        <div className="max-w-4xl mx-auto px-4 py-6">
          {activeTab === 'posts' && (
            <div>
              <PostSkeleton />
              <PostSkeleton />
            </div>
          )}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div>
                <div className="h-6 w-24 mb-4 bg-gray-200 rounded animate-pulse"></div>
                <EventSkeleton />
                <EventSkeleton />
              </div>
            </div>
          )}
          {activeTab === 'edit' && <FormSkeleton />}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mx-4 mt-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Profile Header - Facebook-style */}
      <div className="bg-white border-b border-gray-200">
        {/* Cover Photo - full width, ~2.5:1 aspect ratio like Facebook */}
        <div className="relative w-full h-48 sm:h-56 md:h-64 bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] overflow-hidden">
          {user?.cover_image_url ? (
            <Image
              src={user.cover_image_url ?? undefined}
              alt="Cover"
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4]" />
          )}
          {/* Edit Cover Button - only when on edit tab */}
          {user && activeTab === 'edit' && (
            <div className="absolute bottom-4 right-4">
              <label
                htmlFor="header-cover-upload"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-black/60 hover:bg-black/80 text-white rounded-lg font-medium text-sm transition-colors backdrop-blur-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                </svg>
                {user.cover_image_url ? 'Change Cover' : 'Add Cover Photo'}
                <input
                  id="header-cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload('cover', file);
                    e.target.value = '';
                  }}
                  disabled={saving || uploadingImages}
                />
              </label>
            </div>
          )}
        </div>

        {/* Profile section - overlapping profile pic like Facebook */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 -mt-16 sm:-mt-20 pb-4">
            {/* Profile Picture - large, overlaps cover, bottom-left */}
            <div className="relative flex-shrink-0 w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full ring-4 ring-white shadow-xl overflow-hidden bg-white">
              {user?.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.full_name || 'User'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#0ef9b4] flex items-center justify-center">
                  <span className="text-4xl sm:text-5xl text-black font-bold">
                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
              )}
            </div>
            {/* Name and actions row */}
            <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-1">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{user?.full_name || 'Guest User'}</h1>
                {!isViewingOtherUser && currentUser && (
                  <button
                    onClick={handleLogout}
                    className="mt-2 md:hidden inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Log out
                  </button>
                )}
                {(user?.location || (user?.sports && user.sports.length > 0)) && (
                  <p className="text-gray-600 text-sm mt-0.5 truncate">
                    {[user?.location, user?.sports?.map(s => s.name).join(', ')].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {isViewingOtherUser && currentUser && (
                <div className="flex-shrink-0">
                  {buddyStatus === 'loading' ? (
                    <div className="px-5 py-2 bg-gray-100 rounded-lg text-gray-600 text-sm">Loading...</div>
                  ) : buddyStatus === 'none' ? (
                    <button
                      onClick={handleConnect}
                      className="px-5 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors text-sm"
                    >
                      Connect
                    </button>
                  ) : buddyStatus === 'pending' ? (
                    <div className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm">
                      Request Sent
                    </div>
                  ) : buddyStatus === 'accepted' ? (
                    <Link
                      href={'/messages?user=' + viewingUser.id}
                      className="inline-block px-5 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors text-sm"
                    >
                      Message
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Bio - below name row, full width */}
          {user?.bio && (
            <p className="text-gray-600 text-sm leading-relaxed break-words max-w-2xl mb-4">{user.bio}</p>
          )}
          {!user && (
            <p className="text-gray-500 text-sm mb-4">Sign in to view your profile</p>
          )}

          {/* Tabs - Hide edit tab when viewing other user's profile */}
          <div className="flex gap-4 border-b border-gray-200 -mb-px pt-1">
            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'posts'
                  ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Posts
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'events'
                  ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Events
            </button>
            {!isViewingOtherUser && (
              <button
                onClick={() => setActiveTab('edit')}
                className={`px-4 py-2 font-medium transition-colors ${
                  activeTab === 'edit'
                    ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div>
            {user ? (
              <>
                {contentLoading ? (
                  <div>
                    <PostSkeleton />
                    <PostSkeleton />
                  </div>
                ) : (
                  <>
                {!isViewingOtherUser && (
                  <>
                    {!showCreatePost ? (
                      <div className="flex items-center gap-3 w-full mb-4 px-4 py-3 bg-white border border-gray-200 rounded-xl">
                        {user && (
                          <ProfileAvatar
                            userId={user.id}
                            avatarUrl={user.avatar_url}
                            fullName={user.full_name}
                            size="sm"
                          />
                        )}
                        {!user && (
                          <div className="w-10 h-10 rounded-full bg-[#0ef9b4] flex items-center justify-center flex-shrink-0">
                            <span className="text-black font-semibold">U</span>
                          </div>
                        )}
                        <button
                          onClick={() => setShowCreatePost(true)}
                          className="flex-1 text-left text-gray-500 hover:text-gray-700 transition-colors"
                        >
                          What's on your mind?
                        </button>
                      </div>
                    ) : (
                      <CreatePostForm
                        onPostCreated={handlePostCreated}
                        onCancel={() => setShowCreatePost(false)}
                      />
                    )}
                  </>
                )}

                <div>
                  {posts.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                      <p className="text-gray-500 mb-4">
                        {isViewingOtherUser ? 'No posts yet' : 'No posts yet'}
                      </p>
                      {!isViewingOtherUser && (
                        <button
                          onClick={() => setShowCreatePost(true)}
                          className="px-4 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
                        >
                          Create Your First Post
                        </button>
                      )}
                    </div>
                  ) : (
                    posts.filter(post => post && post.id).map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onDelete={handlePostDeleted}
                        onUpdate={handlePostUpdated}
                      />
                    ))
                  )}
                </div>
                  </>
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-500 mb-4">Please sign in to view and create posts</p>
                <Link
                  href="/login"
                  className="inline-block px-4 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            {user ? (
              contentLoading ? (
                <div className="space-y-6">
                  <div>
                    <div className="h-6 w-24 mb-4 bg-gray-200 rounded animate-pulse" />
                    <EventSkeleton />
                    <EventSkeleton />
                  </div>
                </div>
              ) : (
              <>
                {/* Owned Events */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">My Events</h2>
                    <Link
                      href="/events/create"
                      className="px-4 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors text-sm"
                    >
                      + Create Event
                    </Link>
                  </div>
                  {userEvents.owned && userEvents.owned.length > 0 ? (
                    userEvents.owned.map(event => (
                      <EventManagementMenu 
                        key={event.id} 
                        event={event} 
                        onEventUpdated={loadData} 
                        onEventDeleted={loadData} 
                      />
                    ))
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                      <p className="text-gray-500">No events created yet</p>
                    </div>
                  )}
                </div>

            {/* Attending Events */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Attending</h2>
              {!userEvents.attending || userEvents.attending.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-gray-500">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userEvents.attending.filter(event => event && event.id).map(event => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900">{event.title || 'Untitled Event'}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {event.start_time ? new Date(event.start_time).toLocaleDateString() : 'Date TBD'} • {event.location || 'Location TBD'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Attended Events */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Past Events</h2>
              {!userEvents.attended || userEvents.attended.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
                  <p className="text-gray-500">No past events</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userEvents.attended.filter(event => event && event.id).map(event => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <h3 className="font-semibold text-gray-900">{event.title || 'Untitled Event'}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {event.start_time ? new Date(event.start_time).toLocaleDateString() : 'Date TBD'} • {event.location || 'Location TBD'}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
              </>
              )
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
                <p className="text-gray-500 mb-4">Please sign in to view your events</p>
                <Link
                  href="/login"
                  className="inline-block px-4 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Edit Profile Tab */}
        {activeTab === 'edit' && (
          <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Age</label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="City, State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bio</label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="Tell us about yourself..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
              <div className="flex items-center gap-4">
                {formData.avatar_url && (
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200">
                    <Image
                      src={formData.avatar_url}
                      alt="Profile"
                      width={80}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <label className="block">
                    <span className="sr-only">Upload profile picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('avatar', file);
                      }}
                      disabled={saving || uploadingImages}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer disabled:opacity-50"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
              <div className="flex items-center gap-4">
                {formData.cover_image_url && (
                  <div className="w-32 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                    <Image
                      src={formData.cover_image_url ?? undefined}
                      alt="Cover"
                      width={128}
                      height={80}
                      className="object-cover w-full h-full"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <label className="block">
                    <span className="sr-only">Upload cover image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('cover', file);
                      }}
                      disabled={saving || uploadingImages}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer disabled:opacity-50"
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">Recommended: 1200x400px landscape image</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sports Interests</label>
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                {sports && sports.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {sports.filter(sport => sport && sport.id).map((sport) => (
                      <button
                        key={sport.id}
                        type="button"
                        onClick={() => toggleSport(sport.id)}
                        className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                          formData.sport_ids.includes(sport.id)
                            ? 'bg-[#0ef9b4]/10 text-gray-900 border-l-4 border-[#0ef9b4]'
                            : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="text-xl flex-shrink-0">{sport.icon || '🏃'}</span>
                        <span className="flex-1 font-medium">{sport.name || 'Unknown Sport'}</span>
                        {formData.sport_ids.includes(sport.id) && (
                          <svg className="w-5 h-5 text-[#0ef9b4] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500">Loading sports...</div>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {formData.sport_ids.length} sport{formData.sport_ids.length !== 1 ? 's' : ''} selected
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fitness Goals ({Math.min(formData.goal_ids.length, 8)}/8)</label>
              {goals && goals.length > 0 ? (
                <div className="max-h-60 overflow-y-auto border border-gray-300 rounded-lg p-2">
                  <div className="flex flex-wrap gap-2">
                    {goals.filter(goal => goal && goal.id).map((goal) => (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => {
                          setFormData(prev => {
                            const newGoalIds = prev.goal_ids.includes(goal.id)
                              ? prev.goal_ids.filter(id => id !== goal.id)
                              : [...prev.goal_ids, goal.id];
                            
                            if (newGoalIds.length > 8) {
                              alert('You can select a maximum of 8 goals.');
                              return prev;
                            }
                            return { ...prev, goal_ids: newGoalIds };
                          });
                        }}
                        className={`px-4 py-2 rounded-full border transition-colors ${
                          formData.goal_ids.includes(goal.id)
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {goal.name || 'Unknown Goal'}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500">Loading goals...</div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile Photos (up to 4)</label>
              
              {/* Multiple photo upload button */}
              {photos.filter(Boolean).length < 4 && (
                <div className="mb-4">
                  <label className="block">
                    <span className="sr-only">Upload photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultiplePhotoUpload}
                      disabled={saving || uploadingImages}
                      className="hidden"
                      id="multiple-photo-upload"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('multiple-photo-upload')?.click()}
                      disabled={saving || uploadingImages}
                      className="w-full px-4 py-3 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Select {4 - photos.filter(Boolean).length} Photo{4 - photos.filter(Boolean).length === 1 ? '' : 's'}
                    </button>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg overflow-hidden relative">
                    {photos[index] ? (
                      <>
                        <Image src={photos[index]} alt={`Photo ${index + 1}`} fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const newPhotos = [...photos];
                            const newPhotoFiles = [...photoFiles];
                            newPhotos[index] = '';
                            newPhotoFiles[index] = null;
                            setPhotos(newPhotos);
                            setPhotoFiles(newPhotoFiles);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          ×
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => document.getElementById('multiple-photo-upload')?.click()}
                        disabled={saving || uploadingImages}
                        className="w-full h-full flex items-center justify-center bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p className="text-sm text-gray-500">Add Photo</p>
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">{photos.filter(Boolean).length}/4 photos added</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Discovery Settings</label>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsDiscoverable(true)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === true
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isDiscoverable === true ? 'border-[#0ef9b4] bg-[#0ef9b4]' : 'border-gray-300'
                    }`}>
                      {isDiscoverable === true && (
                        <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Yes, I want to explore</h3>
                      <p className="text-sm text-gray-600">You can discover other people and they can discover you</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDiscoverable(false)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === false
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isDiscoverable === false ? 'border-[#0ef9b4] bg-[#0ef9b4]' : 'border-gray-300'
                    }`}>
                      {isDiscoverable === false && (
                        <div className="w-2.5 h-2.5 rounded-full bg-black"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">No, not right now</h3>
                      <p className="text-sm text-gray-600">You won't be able to discover others or be discovered</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving || uploadingImages}
                className="px-6 py-3 bg-[#0ef9b4] text-black rounded-lg font-medium hover:bg-[#0dd9a0] transition-colors disabled:opacity-50"
              >
                {uploadingImages ? 'Uploading images...' : saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </div>
      
      {/* Connection Message Modal */}
      {viewingUser && (
        <ConnectionMessageModal
          isOpen={showConnectionModal}
          onClose={() => setShowConnectionModal(false)}
          onSend={handleSendConnection}
          userName={viewingUser.full_name || 'User'}
          userSports={viewingUser.sports || []}
        />
      )}
      
      <BottomNav />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <ProfileHeaderSkeleton />
        <div className="max-w-4xl mx-auto px-4 py-6">
          <PostSkeleton />
          <PostSkeleton />
        </div>
        <BottomNav />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}
