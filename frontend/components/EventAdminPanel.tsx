'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, Event, Sport } from '@/types';
import { RSVPsSkeleton } from '@/components/SkeletonLoader';
import { uploadEventImage } from '@/lib/storage';
import Image from 'next/image';

interface EventAdminPanelProps {
  event: Event;
  onUpdate: () => void;
  onEventDeleted?: () => void;
}

function parseTo12h(iso: string): { date: string; hour: string; minute: string; ampm: string } {
  if (!iso) return { date: '', hour: '9', minute: '0', ampm: 'AM' };
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const min = d.getMinutes();
  return { date: `${y}-${m}-${day}`, hour: h.toString(), minute: min.toString(), ampm };
}

function toISOFrom12h(dateStr: string, hour: string, minute: string, ampm: string): string | null {
  if (!dateStr) return null;
  const h = parseInt(hour, 10);
  const m = parseInt(minute, 10) || 0;
  const h24 = ampm === 'AM' ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d, h24, m).toISOString();
}

export default function EventAdminPanel({ event, onUpdate, onEventDeleted }: EventAdminPanelProps) {
  const router = useRouter();
  const [sports, setSports] = useState<Sport[]>([]);
  const [rsvps, setRsvps] = useState<{ approved: User[]; pending: User[]; rejected: User[] }>({
    approved: [],
    pending: [],
    rejected: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'approved' | 'pending' | 'rejected'>('pending');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const start12 = parseTo12h(event.start_time);
  const end12 = event.end_time ? parseTo12h(event.end_time) : { date: '', hour: '10', minute: '0', ampm: 'AM' };
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || '',
    sport_id: event.sport_id?.toString() || event.sport?.id?.toString() || '',
    location: event.location,
    start_date: start12.date,
    start_hour: start12.hour,
    start_minute: start12.minute,
    start_ampm: start12.ampm,
    end_date: end12.date,
    end_hour: end12.hour,
    end_minute: end12.minute,
    end_ampm: end12.ampm,
    max_participants: event.max_participants?.toString() || '',
    is_public: event.is_public ?? true,
    is_cancelled: event.is_cancelled ?? false,
    cover_image_url: event.cover_image_url || event.image_url || '',
  });

  useEffect(() => {
    loadRSVPs();
  }, [event.id]);

  useEffect(() => {
    api.getSports().then(setSports).catch(() => {});
  }, []);

  useEffect(() => {
    const s = parseTo12h(event.start_time);
    const e = event.end_time ? parseTo12h(event.end_time) : { date: '', hour: '10', minute: '0', ampm: 'AM' };
    setFormData({
      title: event.title,
      description: event.description || '',
      sport_id: event.sport_id?.toString() || event.sport?.id?.toString() || '',
      location: event.location,
      start_date: s.date,
      start_hour: s.hour,
      start_minute: s.minute,
      start_ampm: s.ampm,
      end_date: e.date,
      end_hour: e.hour,
      end_minute: e.minute,
      end_ampm: e.ampm,
      max_participants: event.max_participants?.toString() || '',
      is_public: event.is_public ?? true,
      is_cancelled: event.is_cancelled ?? false,
      cover_image_url: event.cover_image_url || event.image_url || '',
    });
  }, [event]);

  const loadRSVPs = async () => {
    try {
      const data = await api.getEventRSVPs(event.id);
      setRsvps(data);
    } catch (error) {
      console.error('Failed to load RSVPs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: number) => {
    try {
      await api.approveRSVP(event.id, userId);
      await loadRSVPs();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to approve RSVP');
    }
  };

  const handleReject = async (userId: number) => {
    try {
      await api.rejectRSVP(event.id, userId);
      await loadRSVPs();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to reject RSVP');
    }
  };

  const handleRemove = async (userId: number) => {
    if (!confirm('Remove this person from the event? They will no longer be able to attend.')) return;
    try {
      await api.removeParticipant(event.id, userId);
      await loadRSVPs();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to remove participant');
    }
  };

  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }
      setCoverImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setCoverImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpdate = async () => {
    try {
      let coverImageUrl = formData.cover_image_url || null;
      if (coverImage) {
        setUploadingImage(true);
        try {
          coverImageUrl = await uploadEventImage(coverImage, event.id);
        } catch (err: any) {
          alert(`Failed to upload image: ${err.message}`);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        location: formData.location,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        is_public: formData.is_public,
        is_cancelled: formData.is_cancelled,
        cover_image_url: coverImageUrl,
      };
      if (formData.sport_id) payload.sport_id = parseInt(formData.sport_id);
      const startIso = toISOFrom12h(formData.start_date, formData.start_hour, formData.start_minute, formData.start_ampm);
      if (startIso) payload.start_time = startIso;
      const endIso = toISOFrom12h(formData.end_date, formData.end_hour, formData.end_minute, formData.end_ampm);
      if (endIso) payload.end_time = endIso;
      await api.updateEvent(event.id, payload);
      setCoverImage(null);
      setCoverImagePreview(null);
      setEditing(false);
      onUpdate();
      alert('Event updated successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to update event');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this event? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.deleteEvent(event.id);
      onEventDeleted?.();
      onUpdate();
      router.push('/profile');
    } catch (error: any) {
      alert(error.message || 'Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <RSVPsSkeleton />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-900">Event Admin</h3>
        <button
          onClick={() => setEditing(!editing)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          {editing ? 'Cancel' : 'Edit Event'}
        </button>
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sport</label>
            <select
              required
              value={formData.sport_id}
              onChange={(e) => setFormData({ ...formData, sport_id: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="">Select a sport</option>
              {sports.map((s) => (
                <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Address or venue name"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time</label>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-2"
                />
                <select value={formData.start_hour} onChange={(e) => setFormData({ ...formData, start_hour: e.target.value })} className="w-14 border border-gray-300 rounded-lg px-2 py-2">
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select value={formData.start_minute} onChange={(e) => setFormData({ ...formData, start_minute: e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-2">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => <option key={n} value={n}>{n.toString().padStart(2, '0')}</option>)}
                </select>
                <select value={formData.start_ampm} onChange={(e) => setFormData({ ...formData, start_ampm: e.target.value })} className="w-14 border border-gray-300 rounded-lg px-2 py-2">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time (optional)</label>
              <div className="flex gap-2 flex-wrap">
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-3 py-2"
                />
                <select value={formData.end_hour} onChange={(e) => setFormData({ ...formData, end_hour: e.target.value })} className="w-14 border border-gray-300 rounded-lg px-2 py-2">
                  {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="self-center text-gray-500">:</span>
                <select value={formData.end_minute} onChange={(e) => setFormData({ ...formData, end_minute: e.target.value })} className="w-16 border border-gray-300 rounded-lg px-2 py-2">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((n) => <option key={n} value={n}>{n.toString().padStart(2, '0')}</option>)}
                </select>
                <select value={formData.end_ampm} onChange={(e) => setFormData({ ...formData, end_ampm: e.target.value })} className="w-14 border border-gray-300 rounded-lg px-2 py-2">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Participants (optional)</label>
            <input
              type="number"
              min="1"
              value={formData.max_participants}
              onChange={(e) => setFormData({ ...formData, max_participants: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image (optional)</label>
            {coverImagePreview || (formData.cover_image_url && formData.cover_image_url.trim()) ? (
              <div className="mt-2 relative">
                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-gray-300 bg-gray-100">
                  <Image
                    src={coverImagePreview || formData.cover_image_url || ''}
                    alt="Cover preview"
                    fill
                    className="object-cover"
                    unoptimized={!!coverImagePreview}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCoverImage(null);
                    setCoverImagePreview(null);
                    setFormData({ ...formData, cover_image_url: '' });
                  }}
                  className="mt-2 text-sm text-red-600 hover:text-red-800"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <label className="mt-1 flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                <div className="flex flex-col items-center pt-3 pb-4">
                  <svg className="w-6 h-6 mb-1 text-gray-500" fill="none" viewBox="0 0 20 16" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                  </svg>
                  <p className="text-xs text-gray-500">Click to upload or drag and drop</p>
                </div>
                <input type="file" className="hidden" accept="image/*" onChange={handleCoverImageChange} disabled={uploadingImage} />
              </label>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_public"
              checked={formData.is_public}
              onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_public" className="text-sm font-medium text-gray-700">
              Public Event (anyone can RSVP)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_cancelled"
              checked={formData.is_cancelled}
              onChange={(e) => setFormData({ ...formData, is_cancelled: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_cancelled" className="text-sm font-medium text-gray-700">
              Event is cancelled
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleUpdate}
              disabled={uploadingImage}
              className="flex-1 bg-[#0ef9b4] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50"
            >
              {uploadingImage ? 'Uploading...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete Event'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-2 font-medium transition-colors relative ${
                activeTab === 'pending'
                  ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending
              {rsvps.pending.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {rsvps.pending.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'approved'
                  ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Approved ({rsvps.approved.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'rejected'
                  ? 'text-[#0ef9b4] border-b-2 border-[#0ef9b4]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Rejected ({rsvps.rejected.length})
            </button>
          </div>

          {/* RSVP Lists */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activeTab === 'pending' && (
              <>
                {rsvps.pending.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending requests</p>
                ) : (
                  rsvps.pending.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0ef9b4] flex items-center justify-center overflow-hidden">
                          {user.avatar_url ? (
                            <Image src={user.avatar_url} alt={user.full_name || ''} width={40} height={40} className="object-cover" />
                          ) : (
                            <span className="text-black font-bold">{user.full_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.full_name || 'User'}</p>
                          {user.location && <p className="text-sm text-gray-600">{user.location}</p>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="px-4 py-1.5 bg-[#0ef9b4] text-black rounded-lg font-medium hover:bg-[#0dd9a0] transition-colors text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'approved' && (
              <>
                {rsvps.approved.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No approved participants</p>
                ) : (
                  rsvps.approved.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0ef9b4] flex items-center justify-center overflow-hidden">
                          {user.avatar_url ? (
                            <Image src={user.avatar_url} alt={user.full_name || ''} width={40} height={40} className="object-cover" />
                          ) : (
                            <span className="text-black font-bold">{user.full_name?.charAt(0) || 'U'}</span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.full_name || 'User'}</p>
                          {user.location && <p className="text-sm text-gray-600">{user.location}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemove(user.id)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </>
            )}

            {activeTab === 'rejected' && (
              <>
                {rsvps.rejected.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No rejected RSVPs</p>
                ) : (
                  rsvps.rejected.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg opacity-60">
                      <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <Image src={user.avatar_url} alt={user.full_name || ''} width={40} height={40} className="object-cover" />
                        ) : (
                          <span className="text-gray-600 font-bold">{user.full_name?.charAt(0) || 'U'}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{user.full_name || 'User'}</p>
                        {user.location && <p className="text-sm text-gray-600">{user.location}</p>}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
