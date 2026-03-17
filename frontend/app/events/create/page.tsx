'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { api } from '@/lib/api';
import { Sport } from '@/types';
import { uploadEventImage } from '@/lib/storage';
import Image from 'next/image';

export default function CreateEventPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    sport_id: '',
    location: '',
    start_date: '',
    start_hour: '9',
    start_minute: '0',
    start_ampm: 'AM',
    end_date: '',
    end_hour: '10',
    end_minute: '0',
    end_ampm: 'AM',
    max_participants: '',
  });

  const toISO = (dateStr: string, hour: string, minute: string, ampm: string) => {
    if (!dateStr) return null;
    const h = parseInt(hour, 10);
    const m = parseInt(minute, 10) || 0;
    let h24 = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    const [y, mo, d] = dateStr.split('-').map(Number);
    return new Date(y, mo - 1, d, h24, m).toISOString();
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }
    
    // Redirect to login if not authenticated
    if (!user) {
      router.push('/login?redirect=/events/create');
      return;
    }
    
    // Load sports only if user is authenticated
    loadSports();
  }, [user, authLoading, router]);

  const loadSports = async () => {
    try {
      const sportsData = await api.getSports();
      setSports(sportsData);
    } catch (error) {
      console.error('Failed to load sports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setCoverImage(file);
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      let coverImageUrl: string | null = null;
      
      // Upload cover image if provided
      if (coverImage) {
        setUploadingImage(true);
        try {
          coverImageUrl = await uploadEventImage(coverImage);
        } catch (uploadError: any) {
          alert(`Failed to upload image: ${uploadError.message}`);
          setUploadingImage(false);
          setSaving(false);
          return;
        }
        setUploadingImage(false);
      }

      const start_time = toISO(formData.start_date, formData.start_hour, formData.start_minute, formData.start_ampm);
      const end_time = formData.end_date
        ? toISO(formData.end_date, formData.end_hour, formData.end_minute, formData.end_ampm)
        : null;
      const eventData = {
        title: formData.title,
        description: formData.description,
        sport_id: parseInt(formData.sport_id),
        location: formData.location,
        start_time: start_time!,
        end_time,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        cover_image_url: coverImageUrl,
      };
      const event = await api.createEvent(eventData);
      router.push(`/events/${event.id}`);
    } catch (error: any) {
      alert(error.message || 'Failed to create event');
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // Show loading while checking auth or loading sports
  if (authLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      <BottomNav />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/events"
          className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium mb-6 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Events
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Event</h1>
        
        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Sport</label>
            <select
              required
              value={formData.sport_id}
              onChange={(e) => setFormData({ ...formData, sport_id: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Select a sport</option>
              {sports.map(sport => (
                <option key={sport.id} value={sport.id}>{sport.icon} {sport.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Address or venue name"
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Start Date & Time</label>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2"
                />
                <select
                  value={formData.start_hour}
                  onChange={(e) => setFormData({ ...formData, start_hour: e.target.value })}
                  className="w-16 border border-gray-300 rounded-md px-2 py-2"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select
                  value={formData.start_minute}
                  onChange={(e) => setFormData({ ...formData, start_minute: e.target.value })}
                  className="w-20 border border-gray-300 rounded-md px-2 py-2"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => (
                    <option key={n} value={n}>{n.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={formData.start_ampm}
                  onChange={(e) => setFormData({ ...formData, start_ampm: e.target.value })}
                  className="w-16 border border-gray-300 rounded-md px-2 py-2"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">End Date & Time (optional)</label>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="flex-1 min-w-[140px] border border-gray-300 rounded-md px-3 py-2"
                />
                <select
                  value={formData.end_hour}
                  onChange={(e) => setFormData({ ...formData, end_hour: e.target.value })}
                  className="w-16 border border-gray-300 rounded-md px-2 py-2"
                >
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select
                  value={formData.end_minute}
                  onChange={(e) => setFormData({ ...formData, end_minute: e.target.value })}
                  className="w-20 border border-gray-300 rounded-md px-2 py-2"
                >
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => (
                    <option key={n} value={n}>{n.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={formData.end_ampm}
                  onChange={(e) => setFormData({ ...formData, end_ampm: e.target.value })}
                  className="w-16 border border-gray-300 rounded-md px-2 py-2"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Max Participants (optional)</label>
            <input
              type="number"
              min="1"
              value={formData.max_participants}
              onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
              className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cover Image (optional)
            </label>
            {coverImagePreview ? (
              <div className="mt-2 relative">
                <div className="relative w-full h-64 rounded-lg overflow-hidden border border-gray-300">
                  <Image
                    src={coverImagePreview}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCoverImage(null);
                    setCoverImagePreview(null);
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <label className="mt-1 flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg className="w-8 h-8 mb-2 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                  </svg>
                  <p className="mb-2 text-sm text-gray-500">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleCoverImageChange}
                  disabled={saving || uploadingImage}
                />
              </label>
            )}
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="px-6 py-3 bg-[#0ef9b4] text-black rounded-lg font-medium hover:bg-[#0dd9a0] transition-colors disabled:opacity-50"
            >
              {uploadingImage ? 'Uploading image...' : saving ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

