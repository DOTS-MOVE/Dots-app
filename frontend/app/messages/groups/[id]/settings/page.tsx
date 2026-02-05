'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import { api } from '@/lib/api';
import { GroupChat, User } from '@/types';
import Link from 'next/link';

export default function GroupSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const groupId = parseInt(params.id as string);
  const [group, setGroup] = useState<GroupChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    loadGroup(signal).finally(() => {
      if (!signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [user, groupId]);

  const loadGroup = async (signal?: AbortSignal) => {
    try {
      const data = await api.getGroup(groupId, { signal });
      if (signal?.aborted) return;
      setGroup(data);
      setFormData({ name: data.name, description: data.description || '' });
      setIsAdmin(data.members?.find(m => m.id === user?.id)?.is_admin || false);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.error('Failed to load group:', error);
      router.push('/messages');
    }
  };

  const handleUpdate = async () => {
    try {
      await api.updateGroup(groupId, formData);
      await loadGroup(undefined);
      setEditing(false);
    } catch (error: any) {
      alert(error.message || 'Failed to update group');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
      await api.leaveGroup(groupId);
      router.push('/messages');
    } catch (error: any) {
      alert(error.message || 'Failed to leave group');
    }
  };

  const handleRemoveMember = async (userId: number, userName: string) => {
    if (!confirm(`Remove ${userName} from the group?`)) return;
    try {
      await api.removeGroupMember(groupId, userId);
      await loadGroup(undefined);
    } catch (error: any) {
      alert(error.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!group) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Link
            href={`/messages?id=${groupId}&type=group`}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Group Settings</h1>
        </div>

        {/* Group Info Card */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
              {group.avatar_url ? (
                <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <span>{group.name[0]?.toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]"
                    placeholder="Group name"
                  />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]"
                    placeholder="Group description"
                    rows={3}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={handleUpdate}
                      className="px-4 py-2 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false);
                        setFormData({ name: group.name, description: group.description || '' });
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{group.name}</h2>
                  {group.description && (
                    <p className="text-gray-600">{group.description}</p>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setEditing(true)}
                      className="mt-2 text-[#0dd9a0] hover:text-[#0ef9b4] text-sm font-semibold"
                    >
                      Edit Group Info
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Members Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Members ({group.members?.length || 0})
            </h2>
            {isAdmin && (
              <button
                onClick={() => router.push(`/messages/groups/${groupId}/add-members`)}
                className="px-4 py-2 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors text-sm"
              >
                + Add Members
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {group.members?.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-semibold overflow-hidden">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.full_name || ''} className="w-full h-full object-cover" />
                    ) : (
                      <span>{member.full_name?.[0]?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {member.full_name || 'Anonymous'}
                      {member.is_admin && (
                        <span className="ml-2 text-xs bg-[#E6F9F4] text-[#0dd9a0] px-2 py-0.5 rounded-full">Admin</span>
                      )}
                    </p>
                    {member.id === group.created_by_id && (
                      <p className="text-xs text-gray-500">Group creator</p>
                    )}
                  </div>
                </div>
                {isAdmin && member.id !== user?.id && member.id !== group.created_by_id && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.full_name || 'Member')}
                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Danger Zone</h2>
          <button
            onClick={handleLeaveGroup}
            className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors"
          >
            Leave Group
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

