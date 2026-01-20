'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { api } from '@/lib/api';
import { Sport, Goal, Post, Event, User } from '@/types';
import PostCard from '@/components/PostCard';
import CreatePostForm from '@/components/CreatePostForm';
import EventManagementMenu from '@/components/EventManagementMenu';
import { ProfileHeaderSkeleton, PostSkeleton, EventSkeleton, FormSkeleton } from '@/components/SkeletonLoader';
import ConnectionMessageModal from '@/components/ConnectionMessageModal';
import Link from 'next/link';
import Image from 'next/image';
import { Buddy } from '@/types';
import { uploadProfileImage } from '@/lib/storage';

type Tab = 'posts' | 'events' | 'edit';

function ProfilePageContent() {
  const { user: currentUser, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sports, setSports] = useState<Sport[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
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
    const userIdParam = searchParams?.get('userId');
    if (userIdParam) {
      const userId = parseInt(userIdParam);
      if (!isNaN(userId) && userId !== currentUser?.id) {
        setViewingUserId(userId);
        // Load the other user's profile
        api.getUser(userId)
          .then((userData) => {
            setViewingUser(userData);
            // Check buddy status
            checkBuddyStatus(userId);
          })
          .catch((err) => {
            console.error('Failed to load user profile:', err);
            setError('Failed to load user profile');
          });
      } else {
        setViewingUserId(null);
        setViewingUser(null);
        setBuddyStatus('none');
      }
    } else {
      setViewingUserId(null);
      setViewingUser(null);
      setBuddyStatus('none');
    }
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

  useEffect(() => {
    let isMounted = true;
    const loadDataWithTimeout = async () => {
      setLoading(true);
      
      // Set a timeout to ensure loading doesn't hang forever
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Profile data loading timeout - setting loading to false');
          setLoading(false);
        }
      }, 10000); // 10 second timeout

      try {
        // Load sports and goals regardless of user (they're needed for the form)
        const [sportsData, goalsData] = await Promise.all([
          api.getSports().catch((err) => {
            console.error('Failed to load sports:', err);
            return [];
          }),
          api.getGoals().catch((err) => {
            console.error('Failed to load goals:', err);
            return [];
          }),
        ]);
        
        if (!isMounted) return;
        
        setSports(sportsData);
        setGoals(goalsData);

        // Only load user-specific data if user exists and has an ID
        if (user && user.id) {
          try {
            setError(null); // Clear any previous errors
            
            if (isViewingOtherUser) {
              // Viewing another user - only load their posts
              const postsData = await api.getPosts(user.id).catch((err) => {
                console.error('Failed to load posts:', err);
                return [];
              });
              
              if (!isMounted) return;
              
              setPosts(postsData || []);
              setUserEvents({ owned: [], attending: [], attended: [] });
            } else {
              // Viewing own profile - load posts and events
              const [postsData, eventsData] = await Promise.all([
                api.getPosts(user.id).catch((err) => {
                  console.error('Failed to load posts:', err);
                  return [];
                }),
                api.getMyEvents().catch((err) => {
                  console.error('Failed to load events:', err);
                  return { owned: [], attending: [], attended: [] };
                }),
              ]);
              
              if (!isMounted) return;
              
              setPosts(postsData || []);
              setUserEvents(eventsData || { owned: [], attending: [], attended: [] });

              // Set form data and photos
              const userPhotos = user?.photos?.map((p: any) => p.photo_url) || [];
              setFormData({
                full_name: user?.full_name || '',
                age: user?.age?.toString() || '',
                bio: user?.bio || '',
                location: user?.location || '',
                avatar_url: user?.avatar_url || '',
                cover_image_url: user?.cover_image_url || '',
                sport_ids: user?.sports?.map(s => s.id).filter(Boolean) || [],
                goal_ids: user?.goals?.map(g => g.id).filter(Boolean) || [],
              });
              setPhotos(userPhotos);
              setIsDiscoverable(user?.is_discoverable || false);
            }
          } catch (error) {
            console.error('Failed to load user-specific data:', error);
            // Set defaults even on error
            if (isMounted) {
              setPosts([]);
              setUserEvents({ owned: [], attending: [], attended: [] });
              const userPhotos = user?.photos?.map((p: any) => p.photo_url) || [];
              setFormData({
                full_name: user?.full_name || '',
                age: user?.age?.toString() || '',
                bio: user?.bio || '',
                location: user?.location || '',
                avatar_url: user?.avatar_url || '',
                cover_image_url: user?.cover_image_url || '',
                sport_ids: user?.sports?.map(s => s.id).filter(Boolean) || [],
                goal_ids: user?.goals?.map(g => g.id).filter(Boolean) || [],
              });
              setPhotos(userPhotos);
              setIsDiscoverable(user?.is_discoverable || false);
            }
          }
        } else {
          // Reset user-specific data if no user
          if (isMounted) {
            setPosts([]);
            setUserEvents({ owned: [], attending: [], attended: [] });
            setFormData({
              full_name: '',
              age: '',
              bio: '',
              location: '',
              avatar_url: '',
              cover_image_url: '',
              sport_ids: [],
              goal_ids: [],
            });
            setPhotos([]);
            setIsDiscoverable(false);
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadDataWithTimeout();

    return () => {
      isMounted = false;
    };
  }, [user]);

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

      // Upload images to Supabase Storage
      let avatarUrl = formData.avatar_url;
      let coverImageUrl = formData.cover_image_url;

      if (avatarFile) {
        try {
          console.log(`[Profile Update] Uploading avatar for user ${userId}...`);
          avatarUrl = await uploadProfileImage(avatarFile, 'avatar', userId);
          console.log(`[Profile Update] Avatar uploaded successfully: ${avatarUrl}`);
        } catch (error: any) {
          console.error(`[Profile Update Error] Failed to upload avatar for user ${userId}:`, {
            fileName: avatarFile.name,
            fileSize: `${(avatarFile.size / 1024 / 1024).toFixed(2)} MB`,
            fileType: avatarFile.type,
            userId,
            error: error.message,
            stack: error.stack
          });
          alert(`Failed to upload avatar: ${error.message}`);
          setUploadingImages(false);
          setSaving(false);
          return;
        }
      }

      if (coverFile) {
        try {
          console.log(`[Profile Update] Uploading cover image for user ${userId}...`);
          coverImageUrl = await uploadProfileImage(coverFile, 'cover', userId);
          console.log(`[Profile Update] Cover image uploaded successfully: ${coverImageUrl}`);
        } catch (error: any) {
          console.error(`[Profile Update Error] Failed to upload cover image for user ${userId}:`, {
            fileName: coverFile.name,
            fileSize: `${(coverFile.size / 1024 / 1024).toFixed(2)} MB`,
            fileType: coverFile.type,
            userId,
            error: error.message,
            stack: error.stack
          });
          alert(`Failed to upload cover image: ${error.message}`);
          setUploadingImages(false);
          setSaving(false);
          return;
        }
      }

      // Update basic profile info with uploaded image URLs
      const updateData = {
        ...formData,
        avatar_url: avatarUrl,
        cover_image_url: coverImageUrl,
        age: formData.age ? parseInt(formData.age) : null,
        is_discoverable: isDiscoverable,
      };
      await api.updateUser(updateData);

      // Update photos - delete existing and add new ones
      if (user?.photos) {
        for (const p of user.photos) {
          try {
            await api.deleteUserPhoto(p.id);
          } catch (error) {
            console.error('Failed to delete photo:', error);
          }
        }
      }
      
      // Upload new photos to Supabase Storage
      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          try {
            const file = photoFiles[i]!;
            console.log(`[Profile Update] Uploading photo ${i + 1} for user ${userId}...`);
            const photoUrl = await uploadProfileImage(file, 'photo', userId);
            console.log(`[Profile Update] Photo ${i + 1} uploaded successfully: ${photoUrl}`);
            await api.addUserPhoto(photoUrl, i);
            console.log(`[Profile Update] Photo ${i + 1} added to user profile`);
          } catch (error: any) {
            const file = photoFiles[i]!;
            console.error(`[Profile Update Error] Failed to upload photo ${i + 1} for user ${userId}:`, {
              photoIndex: i + 1,
              fileName: file.name,
              fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              fileType: file.type,
              userId,
              error: error.message,
              stack: error.stack
            });
            alert(`Failed to upload photo ${i + 1}: ${error.message}`);
          }
        }
      }

      // Reset file states
      setAvatarFile(null);
      setCoverFile(null);
      setPhotoFiles([]);

      await refreshUser();
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
      
      {/* Profile Header with Cover Image */}
      <div className="bg-white border-b border-gray-200">
        {/* Cover Image */}
        <div className="relative h-64 md:h-80 bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] overflow-hidden">
          {user?.cover_image_url ? (
            <Image
              src={user.cover_image_url ?? undefined}
              alt="Cover"
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4]"></div>
          )}
          {/* Edit Cover Button (only for own profile when on edit tab) */}
          {user && activeTab === 'edit' && (
            <div className="absolute top-[45px] right-4">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-black/50 hover:bg-black/70 text-white rounded-lg font-medium transition-colors backdrop-blur-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Change Cover
              </label>
            </div>
          )}
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-6">
          {/* Profile Picture and Info */}
          <div className="flex items-end gap-4 -mt-16 mb-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-white p-1 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg">
                <div className="w-full h-full rounded-full bg-[#0ef9b4] flex items-center justify-center overflow-hidden">
                  {user?.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.full_name || 'User'}
                      width={128}
                      height={128}
                      className="object-cover"
                    />
                  ) : (
                    <span className="text-4xl text-black font-bold">
                      {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex-1 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 mb-1">{user?.full_name || 'Guest User'}</h1>
                  {user?.location && (
                    <p className="text-gray-600 mb-2">{user.location}</p>
                  )}
                  {user?.bio && (
                    <p className="text-gray-600">{user.bio}</p>
                  )}
                  {!user && (
                    <p className="text-gray-500 text-sm">Sign in to view your profile</p>
                  )}
                </div>
                {/* Connect Button - Show when viewing another user */}
                {isViewingOtherUser && currentUser && (
                  <div className="ml-4">
                    {buddyStatus === 'loading' ? (
                      <div className="px-6 py-2 bg-gray-100 rounded-xl text-gray-600">Loading...</div>
                    ) : buddyStatus === 'none' ? (
                      <button
                        onClick={handleConnect}
                        className="px-6 py-2 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors shadow-md hover:shadow-lg"
                      >
                        Connect
                      </button>
                    ) : buddyStatus === 'pending' ? (
                      <div className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-semibold">
                        Request Sent
                      </div>
                    ) : buddyStatus === 'accepted' ? (
                      <Link
                        href={`/messages?user=${viewingUser.id}`}
                        className="inline-block px-6 py-2 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors shadow-md hover:shadow-lg"
                      >
                        Message
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs - Hide edit tab when viewing other user's profile */}
          <div className="flex gap-4 border-b border-gray-200">
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
                {!isViewingOtherUser && (
                  <>
                    {!showCreatePost ? (
                      <button
                        onClick={() => setShowCreatePost(true)}
                        className="w-full mb-4 px-4 py-3 bg-white border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#0ef9b4] flex items-center justify-center">
                            <span className="text-black font-semibold">
                              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                            </span>
                          </div>
                          <span className="text-gray-500">What's on your mind?</span>
                        </div>
                      </button>
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    }>
      <ProfilePageContent />
    </Suspense>
  );
}
