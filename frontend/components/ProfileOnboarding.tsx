'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import LoadingScreen from '@/components/LoadingScreen';
import { Sport, Goal, UserPhoto } from '@/types';
import Image from 'next/image';
import { uploadProfileImage } from '@/lib/storage';
import { profileFieldHints } from '@/lib/profileFieldHints';
import { requestSpotlightTour } from '@/lib/spotlightTour';

const ONBOARDING_STEP_KEY = 'dots_onboarding_step';
const ONBOARDING_DISCOVERABLE_KEY = 'dots_onboarding_discoverable';

function clearOnboardingSessionKeys() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(ONBOARDING_STEP_KEY);
  sessionStorage.removeItem(ONBOARDING_DISCOVERABLE_KEY);
}

interface ProfileOnboardingProps {
  onComplete: () => void;
}

const TOTAL_STEPS = 4;

const STEP_LABELS = ['About you', 'Photos', 'Sports & goals', 'Discovery'];

function imgUnoptimized(src: string | undefined | null) {
  return !!src && (src.startsWith('data:') || src.startsWith('blob:'));
}

export default function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const { user, refreshUser } = useAuth();
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
  const restoredSessionRef = useRef(false);

  const goToStep = useCallback((n: number) => {
    setStep(n);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(ONBOARDING_STEP_KEY, String(n));
    }
  }, []);

  useEffect(() => {
    const initializeData = async () => {
      setInitializing(true);
      try {
        await loadData();

        if (user) {
          setFormData({
            full_name: user.full_name || '',
            age: user.age?.toString() || '',
            bio: user.bio || '',
            location: user.location || '',
            avatar_url: user.avatar_url || '',
            cover_image_url: user.cover_image_url || '',
            sport_ids: user.sports?.map((s) => s.id) || [],
            goal_ids: user.goals?.map((g) => g.id) || [],
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

  useLayoutEffect(() => {
    if (initializing || restoredSessionRef.current || !user) return;
    restoredSessionRef.current = true;

    if (user.is_discoverable !== true && user.is_discoverable !== false) {
      const d = sessionStorage.getItem(ONBOARDING_DISCOVERABLE_KEY);
      if (d === '1') setIsDiscoverable(true);
      else if (d === '0') setIsDiscoverable(false);
    }

    const raw = sessionStorage.getItem(ONBOARDING_STEP_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n < 1) return;
    // Older sessions may have saved step 5 (removed welcome screen)
    if (n > 4) {
      goToStep(4);
      return;
    }
    goToStep(n);
  }, [initializing, user, goToStep]);

  useEffect(() => {
    if (isDiscoverable === null) return;
    sessionStorage.setItem(ONBOARDING_DISCOVERABLE_KEY, isDiscoverable ? '1' : '0');
  }, [isDiscoverable]);

  const loadData = async () => {
    try {
      const [sportsData, goalsData] = await Promise.all([api.getSports(), api.getGoals()]);
      setSports(sportsData);
      setGoals(goalsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleImageUpload = (type: 'avatar' | 'cover' | 'photo', file: File, index?: number) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      if (type === 'avatar') {
        setAvatarFile(file);
        setFormData({ ...formData, avatar_url: result });
      } else if (type === 'cover') {
        setCoverFile(file);
        setFormData({ ...formData, cover_image_url: result });
      } else if (type === 'photo' && index !== undefined) {
        const newPhotos = [...photos];
        const newPhotoFiles = [...photoFiles];
        newPhotos[index] = result;
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
      alert(
        `You can only add ${remainingSlots} more photo${remainingSlots === 1 ? '' : 's'}. You already have ${currentPhotoCount} photo${currentPhotoCount === 1 ? '' : 's'}.`
      );
      e.target.value = '';
      return;
    }

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

    const newPhotos = [...photos];
    const newPhotoFiles = [...photoFiles];
    const availableSlots: number[] = [];

    for (let i = 0; i < maxPhotos; i++) {
      if (!newPhotos[i]) {
        availableSlots.push(i);
      }
    }

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

    Promise.all(fileReaders).then(() => {
      setPhotos([...newPhotos]);
      setPhotoFiles([...newPhotoFiles]);
    });

    e.target.value = '';
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.full_name || !formData.age) {
        alert('Please fill in your name and age');
        return;
      }
      const ageNum = parseInt(formData.age, 10);
      if (!ageNum || ageNum < 1 || ageNum > 150) {
        alert('Please enter a valid age (1-150)');
        return;
      }
      goToStep(2);
    } else if (step === 2) {
      goToStep(3);
    } else if (step === 3) {
      goToStep(4);
    } else if (step === 4) {
      if (isDiscoverable === null) {
        alert('Please choose whether you want to be discoverable before continuing');
        return;
      }
      void handleComplete();
    }
  };

  /** Advance without finishing the whole wizard (does not mark profile complete). */
  const handleSkipStep = () => {
    if (step === 2) goToStep(3);
    else if (step === 3) goToStep(4);
    else if (step === 4) {
      if (isDiscoverable === null) {
        setIsDiscoverable(false);
      }
      void handleComplete();
    }
  };

  /** Exit setup early: save text fields only, mark complete, leave photos/sports for Profile → Edit. */
  const handleSaveAndBrowseApp = async () => {
    if (!formData.full_name || !formData.age) {
      alert('Please add your name and age first');
      return;
    }
    const ageNum = parseInt(formData.age, 10);
    if (!ageNum || ageNum < 1 || ageNum > 150) {
      alert('Please enter a valid age (1-150)');
      return;
    }

    setLoading(true);
    try {
      await api.updateUser({
        full_name: formData.full_name,
        age: ageNum,
        bio: formData.bio || null,
        location: formData.location || null,
        avatar_url: formData.avatar_url || null,
        cover_image_url: formData.cover_image_url || null,
        sport_ids: formData.sport_ids || [],
        goal_ids: formData.goal_ids || [],
      });
      await api.completeProfile(false);
      clearOnboardingSessionKeys();
      requestSpotlightTour();
      await refreshUser();
      await new Promise((resolve) => setTimeout(resolve, 100));
      onComplete();
    } catch (error: unknown) {
      const err = error as { message?: string };
      const errorMessage = err.message || 'Failed to save';
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
      alert('Please go back and choose whether you want to explore other people');
      return;
    }

    setLoading(true);
    try {
      const userId = user?.id;
      if (!userId) {
        throw new Error('User not found');
      }

      let avatarUrl = formData.avatar_url;
      let coverImageUrl = formData.cover_image_url;

      if (avatarFile) {
        try {
          avatarUrl = await uploadProfileImage(avatarFile, 'avatar', userId);
        } catch (error: unknown) {
          const err = error as { message?: string };
          alert(`Failed to upload profile photo: ${err.message}`);
        }
      }

      if (coverFile) {
        try {
          coverImageUrl = await uploadProfileImage(coverFile, 'cover', userId);
        } catch (error: unknown) {
          const err = error as { message?: string };
          alert(`Failed to upload cover image: ${err.message}`);
        }
      }

      await api.updateUser({
        ...formData,
        avatar_url: avatarUrl,
        cover_image_url: coverImageUrl,
        age: formData.age ? parseInt(formData.age, 10) : null,
      });

      for (let i = 0; i < photoFiles.length; i++) {
        if (photoFiles[i]) {
          try {
            const file = photoFiles[i]!;
            const photoUrl = await uploadProfileImage(file, 'photo', userId);
            await api.addUserPhoto(photoUrl, i);
          } catch (error: unknown) {
            const err = error as { message?: string };
            const file = photoFiles[i]!;
            alert(`Failed to upload gallery photo ${i + 1}: ${err.message}`);
          }
        }
      }

      await api.completeProfile(isDiscoverable);
      clearOnboardingSessionKeys();
      requestSpotlightTour();
      await refreshUser();
      onComplete();
    } catch (error: unknown) {
      const err = error as { message?: string };
      const errorMessage = err.message || 'Failed to complete profile';
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

  const photoCount = photos.filter(Boolean).length;

  if (initializing) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <LoadingScreen message="Loading your profile..." />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 overflow-y-auto">
      <div className="h-1 w-full dots-gradient-hero shrink-0" aria-hidden />
      <div className="min-h-[calc(100vh-4px)] flex items-center justify-center p-4 py-10">
        <div className="max-w-2xl w-full space-y-6">
          {showWarning && (
            <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <p className="text-sm text-amber-900 flex-1">{warningMessage}</p>
                <button
                  type="button"
                  onClick={() => setShowWarning(false)}
                  className="text-amber-600 hover:text-amber-800 p-1 rounded-lg hover:bg-amber-100/80"
                  aria-label="Dismiss"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="w-full">
            <div className="flex justify-between items-baseline gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-900">{STEP_LABELS[step - 1]}</span>
              <span className="text-xs font-medium text-gray-500 tabular-nums">
                {step} / {TOTAL_STEPS}
              </span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0ef9b4] rounded-full transition-all duration-300 ease-out"
                style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>

          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Let’s start with the basics</h2>
                <p className="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">{profileFieldHints.basicsIntro}</p>
              </div>

              <div>
                <label htmlFor="onboarding-name" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="onboarding-name"
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]/50 focus:border-[#0ef9b4]"
                  placeholder="Alex Morgan"
                  required
                />
              </div>

              <div>
                <label htmlFor="onboarding-age" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  id="onboarding-age"
                  type="number"
                  min={1}
                  max={150}
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]/50 focus:border-[#0ef9b4]"
                  placeholder="25"
                  required
                />
              </div>

              <div>
                <label htmlFor="onboarding-location" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Location
                </label>
                <p className="text-xs text-gray-500 mb-2">{profileFieldHints.location}</p>
                <input
                  id="onboarding-location"
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Arlington, VA"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]/50 focus:border-[#0ef9b4]"
                />
              </div>

              <div>
                <label htmlFor="onboarding-bio" className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Bio
                </label>
                <p className="text-xs text-gray-500 mb-2">{profileFieldHints.bio}</p>
                <textarea
                  id="onboarding-bio"
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]/50 focus:border-[#0ef9b4] resize-y min-h-[100px]"
                  placeholder="Weekend runner, always up for a group ride…"
                />
              </div>

              <p className="text-xs text-gray-500 leading-relaxed">
                Your place in this flow is saved in this browser until you finish—close the tab and come back to pick up where you left off.
              </p>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors shadow-sm"
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndBrowseApp}
                  disabled={loading}
                  className="w-full bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 border border-gray-200/80"
                >
                  {loading ? 'Saving…' : 'Save & browse app'}
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Saves name, age, and text fields only; marks setup done with discovery off. Add photos and sports anytime in{' '}
                  <span className="font-medium text-gray-700">Profile → Edit</span>.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Photos</h2>
                <p className="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">
                  Visuals help people recognize and trust you. Everything here is optional except finishing onboarding—you can add or change photos anytime.
                </p>
              </div>

              <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Profile photo</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{profileFieldHints.profilePhoto}</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {formData.avatar_url && (
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md ring-2 ring-gray-100 shrink-0 mx-auto sm:mx-0">
                      <Image
                        src={formData.avatar_url}
                        alt="Profile photo preview"
                        width={96}
                        height={96}
                        className="object-cover w-full h-full"
                        unoptimized={imgUnoptimized(formData.avatar_url)}
                      />
                    </div>
                  )}
                  <label className="flex-1 min-w-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('avatar', file);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Cover image</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{profileFieldHints.coverPhoto}</p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {formData.cover_image_url && (
                    <div className="w-full sm:w-40 h-24 rounded-xl overflow-hidden border border-gray-200 shadow-sm shrink-0">
                      <Image
                        src={formData.cover_image_url}
                        alt="Cover image preview"
                        width={160}
                        height={96}
                        className="object-cover w-full h-full"
                        unoptimized={imgUnoptimized(formData.cover_image_url)}
                      />
                    </div>
                  )}
                  <label className="flex-1 min-w-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload('cover', file);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[#0ef9b4] file:text-black hover:file:bg-[#0dd9a0] file:cursor-pointer"
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-gray-50/60 p-5 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Gallery (up to 4)</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{profileFieldHints.gallery}</p>
                </div>

                {photoCount < 4 && (
                  <div>
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
                      className="w-full px-4 py-3 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add gallery photos ({4 - photoCount} slot{4 - photoCount === 1 ? '' : 's'} left)
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className="aspect-square border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative bg-white"
                    >
                      {photos[index] ? (
                        <>
                          <Image
                            src={photos[index]}
                            alt={`Gallery photo ${index + 1} preview`}
                            fill
                            className="object-cover"
                            unoptimized={imgUnoptimized(photos[index])}
                          />
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
                            className="absolute top-2 right-2 bg-gray-900/85 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none hover:bg-gray-900 transition-colors"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => document.getElementById('multiple-photo-upload-onboarding')?.click()}
                          disabled={loading}
                          className="w-full h-full flex items-center justify-center bg-gray-50/80 hover:bg-gray-100 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="text-center px-2">
                            <svg
                              className="w-10 h-10 text-gray-300 mx-auto mb-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-xs font-medium text-gray-500">Add</p>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 text-center">{photoCount} / 4 gallery photos</p>
              </section>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSkipStep}
                  disabled={loading}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80 disabled:opacity-50"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors shadow-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Sports & goals</h2>
                <p className="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">
                  Tell us what you like to do and what you’re working toward. We use this to match you with events and people.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-2">Sports</h3>
                <div className="max-h-72 overflow-y-auto border border-gray-200 rounded-xl scrollbar-hide">
                  <div className="divide-y divide-gray-100">
                    {sports.map((sport) => (
                      <button
                        key={sport.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            sport_ids: prev.sport_ids.includes(sport.id)
                              ? prev.sport_ids.filter((id) => id !== sport.id)
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
                          <svg className="w-5 h-5 text-[#0aa885] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">{formData.sport_ids.length} selected</p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide mb-1">Goals</h3>
                <p className="text-sm text-gray-600 mb-3">Choose up to 8 that fit you best.</p>
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl scrollbar-hide">
                  <div className="divide-y divide-gray-100">
                    {goals.map((goal) => (
                      <button
                        key={goal.id}
                        type="button"
                        onClick={() => {
                          if (formData.goal_ids.includes(goal.id)) {
                            setFormData((prev) => ({
                              ...prev,
                              goal_ids: prev.goal_ids.filter((id) => id !== goal.id),
                            }));
                          } else if (formData.goal_ids.length < 8) {
                            setFormData((prev) => ({
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
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{goal.name}</span>
                          {goal.description && <p className="text-xs text-gray-500 mt-1">{goal.description}</p>}
                        </div>
                        {formData.goal_ids.includes(goal.id) && (
                          <svg className="w-5 h-5 text-[#0aa885] shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">{formData.goal_ids.length} of 8 goals</p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSkipStep}
                  disabled={loading}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80 disabled:opacity-50"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors shadow-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Discovery</h2>
                <p className="text-gray-600 mt-2 text-sm sm:text-base leading-relaxed">
                  Control whether you appear in buddy discovery and can browse others. You can change this anytime in settings.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsDiscoverable(true)}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === true
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isDiscoverable === true ? 'border-[#0aa885] bg-[#0ef9b4]' : 'border-gray-300'
                      }`}
                    >
                      {isDiscoverable === true && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Yes, I want to explore</h3>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        Discover other people and let compatible members find you.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsDiscoverable(false)}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all ${
                    isDiscoverable === false
                      ? 'border-[#0ef9b4] bg-[#0ef9b4]/10 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isDiscoverable === false ? 'border-[#0aa885] bg-[#0ef9b4]' : 'border-gray-300'
                      }`}
                    >
                      {isDiscoverable === false && <div className="w-2 h-2 rounded-full bg-gray-900" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Not right now</h3>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        Stay off discovery lists until you’re ready—you can turn this on later.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSkipStep}
                  disabled={loading}
                  className="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-colors border border-gray-200/80 disabled:opacity-50"
                >
                  Skip this step
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={isDiscoverable === null || loading}
                  className="flex-1 bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {loading ? 'Saving…' : 'Finish & explore app'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
