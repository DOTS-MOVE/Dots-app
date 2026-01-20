'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Sport, Goal, UserPhoto } from '@/types';
import Image from 'next/image';
import { uploadProfileImage } from '@/lib/storage';

interface ProfileOnboardingProps {
  onComplete: () => void;
}

export default function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sports, setSports] = useState<Sport[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  
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
  
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<(File | null)[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isDiscoverable, setIsDiscoverable] = useState<boolean | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  // Load user data and initialize form
  useEffect(() => {
    const initializeData = async () => {
      setInitializing(true);
      try {
        // Load sports and goals
        await loadData();
        
        // Load current user data if available
        if (user) {
          setFormData({
            full_name: user.full_name || '',
            age: user.age?.toString() || '',
            bio: user.bio || '',
            location: user.location || '',
            avatar_url: user.avatar_url || '',
            cover_image_url: user.cover_image_url || '',
            sport_ids: user.sports?.map(s => s.id) || [],
            goal_ids: user.goals?.map(g => g.id) || [],
          });
          
          setPhotos(user.photos?.map((p: UserPhoto) => p.photo_url) || []);
          setIsDiscoverable(user.is_discoverable ?? null);
        }
      } catch (error) {
        console.error('Failed to initialize profile data:', error);
      } finally {
        setInitializing(false);
      }
    };
    
    initializeData();
  }, [user]);

  const loadData = async () => {
    try {
      const [sportsData, goalsData] = await Promise.all([
        api.getSports(),
        api.getGoals(),
      ]);
      setSports(sportsData);
      setGoals(goalsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
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

  const handleNext = async () => {
    if (step === 1) {
      // Validate only name and age
      if (!formData.full_name || !formData.age) {
        alert('Please fill in your name and age');
        return;
      }
      // Validate age is a valid number
      const ageNum = parseInt(formData.age);
      if (!ageNum || ageNum < 1 || ageNum > 150) {
        alert('Please enter a valid age (1-150)');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      // Photos are optional, can skip
      setStep(3);
    } else if (step === 3) {
      // Sports are optional, can skip
      setStep(4);
    }
  };

  const handleSkip = async () => {
    // Validate only name and age
    if (!formData.full_name || !formData.age) {
      alert('Please fill in at least your name and age to continue');
      return;
    }

    // Validate age is a valid number
    const ageNum = formData.age ? parseInt(formData.age) : null;
    if (!ageNum || ageNum < 1 || ageNum > 150) {
      alert('Please enter a valid age (1-150)');
      return;
    }

    setLoading(true);
    try {
      console.log('Updating user profile...', { full_name: formData.full_name, age: ageNum });
      // Update profile with minimal info
      const updatedUser = await api.updateUser({
        full_name: formData.full_name,
        age: ageNum,
        bio: formData.bio || null,
        location: formData.location || null,
        avatar_url: formData.avatar_url || null,
        cover_image_url: formData.cover_image_url || null,
        sport_ids: formData.sport_ids || [],
        goal_ids: formData.goal_ids || [],
      });
      console.log('User updated:', updatedUser);

      console.log('Completing profile...');
      // Complete profile with discoverable set to false by default when skipping
      const completedUser = await api.completeProfile(false);
      console.log('Profile completed:', completedUser);
      
      // Refresh user data to get updated profile_completed flag
      await refreshUser();
      
      // Small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onComplete();
    } catch (error: any) {
      console.error('Error in handleSkip:', error);
      const errorMessage = error.message || 'Failed to complete profile';
      if (errorMessage.includes('Unable to connect') || errorMessage.includes('Failed to fetch')) {
        setWarningMessage('Unable to connect to the server. Please check your connection and try again.');
      } else {
        setWarningMessage(errorMessage || 'Something went wrong. Please try again.');
      }
      setShowWarning(true);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (isDiscoverable === null) {
      alert('Please choose whether you want to explore other people');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting profile completion...', { isDiscoverable });
      // Upload images to Supabase Storage if provided
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not found');
      }

      let avatarUrl = formData.avatar_url;
      let coverImageUrl = formData.cover_image_url;

      if (avatarFile) {
        try {
          console.log(`[Profile Onboarding] Uploading avatar for user ${userId}...`);
          avatarUrl = await uploadProfileImage(avatarFile, 'avatar', userId);
          console.log(`[Profile Onboarding] Avatar uploaded successfully: ${avatarUrl}`);
        } catch (error: any) {
          console.error(`[Profile Onboarding Error] Failed to upload avatar for user ${userId}:`, {
            fileName: avatarFile.name,
            fileSize: `${(avatarFile.size / 1024 / 1024).toFixed(2)} MB`,
            fileType: avatarFile.type,
            userId,
            error: error.message,
            stack: error.stack
          });
          alert(`Failed to upload avatar: ${error.message}`);
        }
      }

      if (coverFile) {
        try {
          console.log(`[Profile Onboarding] Uploading cover image for user ${userId}...`);
          coverImageUrl = await uploadProfileImage(coverFile, 'cover', userId);
          console.log(`[Profile Onboarding] Cover image uploaded successfully: ${coverImageUrl}`);
        } catch (error: any) {
          console.error(`[Profile Onboarding Error] Failed to upload cover image for user ${userId}:`, {
            fileName: coverFile.name,
            fileSize: `${(coverFile.size / 1024 / 1024).toFixed(2)} MB`,
            fileType: coverFile.type,
            userId,
            error: error.message,
            stack: error.stack
          });
          alert(`Failed to upload cover image: ${error.message}`);
        }
      }

      // Update profile
      console.log('Updating user profile...');
      const updatedUser = await api.updateUser({
        ...formData,
        avatar_url: avatarUrl,
        cover_image_url: coverImageUrl,
        age: formData.age ? parseInt(formData.age) : null,
      });
      console.log('User updated:', updatedUser);

      // Upload photos to Supabase Storage
      console.log(`Uploading ${photoFiles.length} photos...`);
      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          try {
            const file = photoFiles[i]!;
            console.log(`[Profile Onboarding] Uploading photo ${i + 1} for user ${userId}...`);
            const photoUrl = await uploadProfileImage(file, 'photo', userId);
            console.log(`[Profile Onboarding] Photo ${i + 1} uploaded successfully: ${photoUrl}`);
            await api.addUserPhoto(photoUrl, i);
            console.log(`[Profile Onboarding] Photo ${i + 1} added to user profile`);
          } catch (error: any) {
            const file = photoFiles[i]!;
            console.error(`[Profile Onboarding Error] Failed to upload photo ${i + 1} for user ${userId}:`, {
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

      // Complete profile
      console.log('Completing profile...');
      const completedUser = await api.completeProfile(isDiscoverable);
      console.log('Profile completed:', completedUser);
      
      await refreshUser();
      onComplete();
    } catch (error: any) {
      console.error('Error in handleComplete:', error);
      const errorMessage = error.message || 'Failed to complete profile';
      if (errorMessage.includes('Unable to connect') || errorMessage.includes('Failed to fetch')) {
        setWarningMessage('Unable to connect to the server. Please check your connection and try again.');
      } else {
        setWarningMessage(errorMessage || 'Something went wrong. Please try again.');
      }
      setShowWarning(true);
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#0ef9b4] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your profile...</p>
          </div>
        </div>
      </div>
    );
  }

      return (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="min-h-screen flex items-center justify-center p-4">
            <div className="max-w-2xl w-full space-y-8">
              {/* Warning Banner */}
              {showWarning && (
                <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-lg mb-4 animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm text-amber-800">{warningMessage}</p>
                    </div>
                    <button
                      onClick={() => setShowWarning(false)}
                      className="ml-4 flex-shrink-0 text-amber-400 hover:text-amber-600"
                    >
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
          {/* Progress Indicator */}
          <div className="flex items-center justify-center space-x-2 mb-8">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step >= s
                      ? 'bg-[#0ef9b4] text-black'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step > s ? '✓' : s}
                </div>
                {s < 4 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
                      step > s ? 'bg-[#0ef9b4]' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Let's set up your profile</h2>
              <p className="text-gray-600">Start by adding your basic information</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, State"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2"
                  placeholder="Tell us about yourself..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
                <div className="flex items-center gap-4">
                  {formData.avatar_url && (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200">
                      <Image src={formData.avatar_url} alt="Profile" width={96} height={96} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('avatar', file);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
                <div className="flex items-center gap-4">
                  {formData.cover_image_url && (
                    <div className="w-32 h-20 rounded-lg overflow-hidden border-2 border-gray-200">
                      <Image src={formData.cover_image_url ?? undefined} alt="Cover" width={128} height={80} className="object-cover w-full h-full" />
                    </div>
                  )}
                  <label className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('cover', file);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Photos */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Add Your Photos</h2>
              <p className="text-gray-600">Upload up to 4 photos for your profile (optional)</p>

              {/* Multiple photo upload button */}
              {photos.filter(Boolean).length < 4 && (
                <div>
                  <label className="block">
                    <span className="sr-only">Upload photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMultiplePhotoUpload}
                      disabled={loading}
                      className="hidden"
                      id="multiple-photo-upload-onboarding"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('multiple-photo-upload-onboarding')?.click()}
                      disabled={loading}
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
                        onClick={() => document.getElementById('multiple-photo-upload-onboarding')?.click()}
                        disabled={loading}
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
              <p className="text-xs text-gray-500 text-center">{photos.filter(Boolean).length}/4 photos added</p>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  Continue ({photos.length}/4)
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Sports */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Select Your Sports</h2>
              <p className="text-gray-600">Choose sports you're interested in (optional)</p>

              <div className="max-h-96 overflow-y-auto border border-gray-300 rounded-lg">
                <div className="divide-y divide-gray-200">
                  {sports.map((sport) => (
                    <button
                      key={sport.id}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          sport_ids: prev.sport_ids.includes(sport.id)
                            ? prev.sport_ids.filter(id => id !== sport.id)
                            : [...prev.sport_ids, sport.id],
                        }));
                      }}
                      className={`flex items-center justify-between w-full px-4 py-3 text-left transition-colors ${
                        formData.sport_ids.includes(sport.id)
                          ? 'bg-[#0ef9b4]/10 border-l-4 border-[#0ef9b4] text-gray-900 font-medium'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {sport.icon && <span className="text-xl">{sport.icon}</span>}
                        {sport.name}
                      </span>
                      {formData.sport_ids.includes(sport.id) && (
                        <svg className="w-5 h-5 text-[#0ef9b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {formData.sport_ids.length} sport(s) selected
              </p>

              {/* Goals Section */}
              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Your Goals</h3>
                <p className="text-gray-600 mb-4 text-sm">What are you looking to achieve? (optional, up to 8)</p>

                <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg">
                  <div className="divide-y divide-gray-200">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => {
                          // Limit to 8 goals
                          if (formData.goal_ids.includes(goal.id)) {
                            setFormData(prev => ({
                              ...prev,
                              goal_ids: prev.goal_ids.filter(id => id !== goal.id),
                            }));
                          } else if (formData.goal_ids.length < 8) {
                            setFormData(prev => ({
                              ...prev,
                              goal_ids: [...prev.goal_ids, goal.id],
                            }));
                          } else {
                            alert('You can select up to 8 goals');
                          }
                        }}
                        disabled={!formData.goal_ids.includes(goal.id) && formData.goal_ids.length >= 8}
                        className={`flex items-center justify-between w-full px-4 py-3 text-left transition-colors ${
                          formData.goal_ids.includes(goal.id)
                            ? 'bg-[#0ef9b4]/10 border-l-4 border-[#0ef9b4] text-gray-900 font-medium'
                            : formData.goal_ids.length >= 8
                            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex-1">
                          <span className="font-medium">{goal.name}</span>
                          {goal.description && (
                            <p className="text-xs text-gray-500 mt-1">{goal.description}</p>
                          )}
                        </div>
                        {formData.goal_ids.includes(goal.id) && (
                          <svg className="w-5 h-5 text-[#0ef9b4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  {formData.goal_ids.length} of 8 goal(s) selected
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Discoverability */}
          {step === 4 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900">Explore Other People?</h2>
              <p className="text-gray-600">Choose whether you want to discover and be discovered by other users (you can change this later)</p>

              <div className="space-y-4">
                <button
                  onClick={() => setIsDiscoverable(true)}
                  className={`w-full p-6 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === true
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isDiscoverable === true ? 'border-[#0ef9b4] bg-[#0ef9b4]' : 'border-gray-300'
                    }`}>
                      {isDiscoverable === true && (
                        <div className="w-3 h-3 rounded-full bg-black"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">Yes, I want to explore</h3>
                      <p className="text-sm text-gray-600">You can discover other people and they can discover you</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setIsDiscoverable(false)}
                  className={`w-full p-6 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === false
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isDiscoverable === false ? 'border-[#0ef9b4] bg-[#0ef9b4]' : 'border-gray-300'
                    }`}>
                      {isDiscoverable === false && (
                        <div className="w-3 h-3 rounded-full bg-black"></div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">No, not right now</h3>
                      <p className="text-sm text-gray-600">You won't be able to discover others or be discovered</p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSkip}
                  disabled={loading}
                  className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
                <button
                  onClick={handleComplete}
                  disabled={isDiscoverable === null || loading}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Completing...' : 'Complete Profile'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
