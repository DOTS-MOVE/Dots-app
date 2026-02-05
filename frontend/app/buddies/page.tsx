'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import BuddyGrid from '@/components/BuddyGrid';
import ConnectionMessageModal from '@/components/ConnectionMessageModal';
import ProfileAvatar from '@/components/ProfileAvatar';
import { BuddiesSkeleton } from '@/components/SkeletonLoader';
import { api } from '@/lib/api';
import { Buddy } from '@/types';
import Link from 'next/link';

function BuddiesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [buddies, setBuddies] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'pending' | 'buddies'>('discover');
  const [swipedUsers, setSwipedUsers] = useState<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{ userId: number; userName: string; sports?: Array<{ name: string; icon?: string }> } | null>(null);
  const [discoveryDisabled, setDiscoveryDisabled] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;

    const tab = searchParams?.get('tab');
    const newTab = tab === 'pending' ? 'pending' : tab === 'buddies' ? 'buddies' : 'discover';
    setActiveTab(newTab);

    if (!user) {
      setLoading(false);
      setLoadError(null);
      return;
    }

    loadData(true, newTab, signal).finally(() => {
      if (!cancelled) {
        setLoading(false);
        setLoadingMore(false);
      }
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user, searchParams]);

  const loadData = async (reset = false, tabOverride?: 'discover' | 'pending' | 'buddies', signal?: AbortSignal) => {
    const effectiveTab = tabOverride ?? activeTab;
    try {
      setLoadError(null);
      setDiscoveryDisabled(false);
      const promises: [Promise<any[]>, Promise<any[] | any>] = [
        api.getBuddies(undefined, { signal }),
        effectiveTab === 'discover' ? fetchSuggestedBuddies(reset, signal) : Promise.resolve([]),
      ];

      const [buddiesResult, suggestedResult] = await Promise.allSettled(promises);
      if (signal?.aborted) return;
      const buddiesData = buddiesResult.status === 'fulfilled' ? buddiesResult.value : [];
      const suggestedData = suggestedResult.status === 'fulfilled' ? suggestedResult.value : [];
      if (buddiesResult.status === 'rejected' && buddiesResult.reason?.name !== 'AbortError') {
        console.error('Failed to load buddies:', buddiesResult.reason);
        setLoadError(buddiesResult.reason?.message || 'Failed to load buddies. Please try again.');
      }
      if (suggestedResult.status === 'rejected' && suggestedResult.reason?.name !== 'AbortError') {
        const msg = (suggestedResult.reason?.message || '').toLowerCase();
        if (msg.includes('enable discovery') || msg.includes('discovery')) {
          setDiscoveryDisabled(true);
        }
      }

      if (signal?.aborted) return;
      setBuddies(Array.isArray(buddiesData) ? buddiesData : []);
      const suggestedList = Array.isArray(suggestedData) ? suggestedData : [];
      if (reset) {
        setSuggested(suggestedList);
        setCurrentIndex(0);
        setSwipedUsers(new Set());
        setHasMore(suggestedList.length >= 10);
      } else {
        setSuggested((prev) => [...prev, ...suggestedList]);
        setHasMore(suggestedList.length >= 10);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      console.error('Failed to load buddies:', error);
      setLoadError(error?.message || 'Failed to load buddies. Please try again.');
    }
  };

  const fetchSuggestedBuddies = async (reset: boolean, signal?: AbortSignal): Promise<any[]> => {
    try {
      return await api.getSuggestedBuddies(10, 0, reset ? 0 : suggested.length, { signal });
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('enable discovery') || msg.includes('discovery')) {
        setDiscoveryDisabled(true);
      }
      return [];
    }
  };

  const loadMoreBuddies = useCallback(async () => {
    if (loadingMore || !hasMore || suggested.length === 0 || discoveryDisabled) return;

    setLoadingMore(true);
    try {
      const nextBatch = await api.getSuggestedBuddies(10, 20, suggested.length);
      if (nextBatch.length === 0) {
        const fallbackBatch = await api.getSuggestedBuddies(10, 10, suggested.length);
        if (fallbackBatch.length === 0) {
          setHasMore(false);
        } else {
          setSuggested((prev) => [...prev, ...fallbackBatch]);
          setHasMore(true);
        }
      } else {
        setSuggested((prev) => [...prev, ...nextBatch]);
        setHasMore(true);
      }
    } catch (error: any) {
      console.error('Failed to load more buddies:', error);
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('enable discovery') || msg.includes('discovery')) {
        setDiscoveryDisabled(true);
      }
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, suggested.length, discoveryDisabled]);

  // Load more buddies when approaching the end
  useEffect(() => {
    if (activeTab === 'discover' && suggested.length > 0 && currentIndex >= suggested.length - 3 && hasMore && !loadingMore) {
      loadMoreBuddies();
    }
  }, [currentIndex, suggested.length, hasMore, loadingMore, activeTab, loadMoreBuddies]);

  const handleSwipe = async (direction: 'left' | 'right', user2Id: number, userData?: any) => {
    if (swipedUsers.has(user2Id)) return;
    
    if (direction === 'right') {
      // Like - show message modal first (don't mark as swiped yet)
      console.log('Opening connection modal for user:', user2Id, userData);
      setPendingConnection({
        userId: user2Id,
        userName: userData?.full_name || 'User',
        sports: userData?.sports || [],
      });
      setShowMessageModal(true);
    } else {
      // For left swipe (pass), mark as swiped and move to next
      setSwipedUsers(prev => new Set(prev).add(user2Id));
    }
  };

  const handleSendConnection = async (message: string) => {
    if (!pendingConnection) return;
    
    try {
      // Mark as swiped now that we're sending
      setSwipedUsers(prev => new Set(prev).add(pendingConnection.userId));
      
      await api.createBuddy(pendingConnection.userId, message);

      // Reload buddies and suggested (excludes newly connected user)
      setTimeout(() => {
        loadData(true, 'discover');
      }, 500);
      
      setPendingConnection(null);
      setShowMessageModal(false);
    } catch (error: any) {
      console.error('Failed to create buddy:', error);
      // Remove from swiped users on error so they can try again
      setSwipedUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(pendingConnection.userId);
        return newSet;
      });
      throw error;
    }
  };

  const handleLike = () => {
    if (currentIndex < suggested.length) {
      const currentUser = suggested[currentIndex];
      handleSwipe('right', currentUser.user.id, currentUser.user);
    }
  };

  const handlePass = () => {
    if (currentIndex < suggested.length) {
      const currentUser = suggested[currentIndex];
      handleSwipe('left', currentUser.user.id);
      // Move to next card
      if (currentIndex < suggested.length - 1) {
        setCurrentIndex(prev => prev + 1);
      }
    }
  };

  const handleNext = () => {
    if (currentIndex < suggested.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <BuddiesSkeleton />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      {/* Error Banner */}
      {loadError && !discoveryDisabled && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <p className="text-amber-800 text-sm">{loadError}</p>
            <button
              onClick={() => setLoadError(null)}
              className="text-amber-600 hover:text-amber-800 ml-2 flex-shrink-0"
              aria-label="Dismiss"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-center space-x-2 mb-6">
          <button
            onClick={() => {
              setActiveTab('discover');
              setCurrentIndex(0);
              router.push('/buddies');
            }}
            className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
              activeTab === 'discover'
                ? 'bg-[#0ef9b4] text-black shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => {
              setActiveTab('pending');
              router.push('/buddies?tab=pending');
            }}
            className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm relative ${
              activeTab === 'pending'
                ? 'bg-[#0ef9b4] text-black shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending
            {buddies.filter(m => m.status === 'pending' && m.user2_id === user?.id).length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {buddies.filter(m => m.status === 'pending' && m.user2_id === user?.id).length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('buddies');
              router.push('/buddies?tab=buddies');
            }}
            className={`px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-sm ${
              activeTab === 'buddies'
                ? 'bg-[#0ef9b4] text-black shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Buddies
            {buddies.filter(m => m.status === 'accepted').length > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                ({buddies.filter(m => m.status === 'accepted').length})
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Discover Tab */}
      {activeTab === 'discover' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="text-gray-600">Loading buddies...</div>
            </div>
          ) : suggested.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              {discoveryDisabled ? (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Enable discovery to find buddies</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    You need to turn on discovery in your profile before you can see suggested workout buddies. Go to Profile → Edit Profile → Discovery Settings and choose &quot;Yes, I want to explore.&quot;
                  </p>
                  <Link
                    href="/profile"
                    className="inline-block bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
                  >
                    Enable discovery in Profile
                  </Link>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">No buddies available</h3>
                  <p className="text-gray-600 mb-6">
                    There are no discoverable users available right now. Check back later!
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Buddy Grid */}
              <BuddyGrid
                buddies={suggested}
                onSwipe={handleSwipe}
                currentIndex={currentIndex}
                onIndexChange={setCurrentIndex}
              />

              {/* Navigation and Progress */}
              <div className="mt-12 space-y-6">
                {/* Navigation Controls */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={handlePrevious}
                    disabled={currentIndex === 0}
                    className="px-6 py-3 bg-white rounded-xl shadow-md flex items-center space-x-2 hover:shadow-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Previous"
                  >
                    <span className="text-xl text-gray-700">←</span>
                    <span className="text-sm font-medium text-gray-700">Previous</span>
                  </button>

                  <div className="flex items-center space-x-2">
                    {suggested.map((_, i) => {
                      const isActive = currentIndex === i;
                      return (
                        <button
                          key={i}
                          onClick={() => setCurrentIndex(i)}
                          className={`w-2 h-2 rounded-full transition-all duration-300 ${
                            isActive
                              ? 'bg-[#0ef9b4] w-8'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          aria-label={`Go to buddy ${i + 1}`}
                        />
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNext}
                    disabled={currentIndex >= suggested.length - 1}
                    className="px-6 py-3 bg-white rounded-xl shadow-md flex items-center space-x-2 hover:shadow-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Next"
                  >
                    <span className="text-sm font-medium text-gray-700">Next</span>
                    <span className="text-xl text-gray-700">→</span>
                  </button>
                </div>

                {/* Progress Indicator */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600">
                    Showing {Math.min(currentIndex + 1, suggested.length)} of {suggested.length}{hasMore ? '+' : ''} buddies
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                    <div 
                      className="bg-[#0ef9b4] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(((currentIndex + 1) / Math.max(suggested.length, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  {loadingMore && (
                    <p className="text-xs text-gray-500 mt-2">Loading more buddies...</p>
                  )}
                  {!hasMore && currentIndex >= suggested.length - 1 && (
                    <p className="text-xs text-gray-500 mt-2">No more buddies available</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          {/* Incoming Requests (people who want to connect with you) */}
          {buddies.filter(m => m.status === 'pending' && m.user2_id === user?.id).length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Requests</h2>
              <div className="space-y-3">
                {buddies
                  .filter(m => m.status === 'pending' && m.user2_id === user?.id)
                  .map((buddy) => {
                    const otherUser = buddy.user1;
                    return (
                      <div key={buddy.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4 flex-1">
                            <Link href={`/profile?userId=${otherUser?.id}`} className="flex items-center space-x-4 flex-1">
                              {otherUser && (
                                <ProfileAvatar
                                  userId={otherUser.id}
                                  avatarUrl={otherUser.avatar_url}
                                  fullName={otherUser.full_name}
                                  size="lg"
                                  linkToProfile={false}
                                />
                              )}
                              <div className="flex-1">
                                <p className="font-bold text-gray-900 text-lg">{otherUser?.full_name || 'Anonymous'}</p>
                                <p className="text-sm text-gray-600">
                                  {buddy.match_score && `${Math.round(buddy.match_score)}% buddy`}
                                </p>
                              </div>
                            </Link>
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={async () => {
                                try {
                                  await api.updateBuddy(buddy.id, 'accepted');
                                  await loadData();
                                } catch (error: any) {
                                  alert(error.message || 'Failed to accept buddy');
                                }
                              }}
                              className="px-6 py-2 bg-[#0ef9b4] text-black rounded-xl font-semibold hover:bg-[#0dd9a0] transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await api.updateBuddy(buddy.id, 'rejected');
                                  await loadData();
                                } catch (error: any) {
                                  alert(error.message || 'Failed to reject buddy');
                                }
                              }}
                              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Outgoing Requests (people you liked) */}
          {buddies.filter(m => m.status === 'pending' && m.user1_id === user?.id).length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">People You Liked</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buddies
                  .filter(m => m.status === 'pending' && m.user1_id === user?.id)
                  .map((buddy) => {
                    const otherUser = buddy.user2;
                    return (
                      <div key={buddy.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative">
                        <button
                          onClick={async () => {
                            if (confirm('Cancel this buddy request?')) {
                              try {
                                await api.deleteBuddy(buddy.id);
                                await loadData();
                              } catch (error: any) {
                                alert(error.message || 'Failed to cancel request');
                              }
                            }
                          }}
                          className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors z-10"
                          aria-label="Cancel request"
                        >
                          <span className="text-lg">×</span>
                        </button>
                        <Link
                          href={`/profile?userId=${otherUser?.id}`}
                          className="block cursor-pointer"
                        >
                          <div className="flex items-center space-x-4 pr-16">
                            {otherUser && (
                              <ProfileAvatar
                                userId={otherUser.id}
                                avatarUrl={otherUser.avatar_url}
                                fullName={otherUser.full_name}
                                size="lg"
                                linkToProfile={false}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-lg truncate">{otherUser?.full_name || 'Anonymous'}</p>
                              <p className="text-sm text-gray-600 truncate">
                                {otherUser?.location && `${otherUser.location}`}
                              </p>
                              {otherUser?.sports && otherUser.sports.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {otherUser.sports.slice(0, 2).map((sport: any) => (
                                    <span key={sport.id} className="text-xs bg-[#E6F9F4] text-[#0dd9a0] px-2 py-0.5 rounded-full">
                                      {sport.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-500">Waiting for response...</p>
                          </div>
                        </Link>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Empty State for Pending */}
          {buddies.filter(m => m.status === 'pending').length === 0 && (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No pending requests</h3>
              <p className="text-gray-600 mb-6">
                You don't have any pending buddy requests right now.
              </p>
              <button
                onClick={() => {
                  setActiveTab('discover');
                  router.push('/buddies');
                }}
                className="inline-block bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Start Discovering
              </button>
            </div>
          )}
        </div>
      )}

      {/* My Buddies Tab - Only Accepted Buddies */}
      {activeTab === 'buddies' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          {buddies.filter(m => m.status === 'accepted').length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No buddies yet</h3>
              <p className="text-gray-600 mb-6">
                Start swiping to find your workout buddies!
              </p>
              <button
                onClick={() => {
                  setActiveTab('discover');
                  router.push('/buddies');
                }}
                className="inline-block bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Start Discovering
              </button>
            </div>
          ) : (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Buddies</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {buddies
                  .filter(m => m.status === 'accepted')
                  .map((buddy) => {
                    const otherUser = buddy.user1_id === user?.id ? buddy.user2 : buddy.user1;
                    return (
                      <div key={buddy.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative">
                        <button
                          onClick={async () => {
                            if (confirm('Remove this buddy?')) {
                              try {
                                await api.deleteBuddy(buddy.id);
                                await loadData();
                              } catch (error: any) {
                                alert(error.message || 'Failed to remove buddy');
                              }
                            }
                          }}
                          className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors z-10"
                          aria-label="Remove buddy"
                        >
                          <span className="text-lg">×</span>
                        </button>
                        <Link
                          href={`/profile?userId=${otherUser?.id}`}
                          className="block cursor-pointer"
                        >
                          <div className="flex items-center space-x-4 pr-16">
                            {otherUser && (
                              <ProfileAvatar
                                userId={otherUser.id}
                                avatarUrl={otherUser.avatar_url}
                                fullName={otherUser.full_name}
                                size="lg"
                                linkToProfile={false}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-lg truncate">{otherUser?.full_name || 'Anonymous'}</p>
                              <p className="text-sm text-gray-600 truncate">
                                {buddy.match_score && `${Math.round(buddy.match_score)}% buddy`}
                                {otherUser?.location && ` • ${otherUser.location}`}
                              </p>
                              {otherUser?.sports && otherUser.sports.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {otherUser.sports.slice(0, 2).map((sport: any) => (
                                    <span key={sport.id} className="text-xs bg-[#E6F9F4] text-[#0dd9a0] px-2 py-0.5 rounded-full">
                                      {sport.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                        <Link
                          href={`/messages?user=${otherUser?.id}`}
                          className="absolute bottom-4 right-4 w-10 h-10 bg-[#0ef9b4] hover:bg-[#0dd9a0] rounded-full flex items-center justify-center text-black transition-colors shadow-md hover:shadow-lg z-10"
                          aria-label="Message"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </Link>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection Message Modal */}
      {pendingConnection && (
        <ConnectionMessageModal
          isOpen={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setPendingConnection(null);
            // Remove from swiped users if cancelled
            setSwipedUsers(prev => {
              const newSet = new Set(prev);
              newSet.delete(pendingConnection.userId);
              return newSet;
            });
          }}
          onSend={handleSendConnection}
          userName={pendingConnection.userName}
          userSports={pendingConnection.sports}
        />
      )}

      <BottomNav />
    </div>
  );
}

export default function BuddiesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <BuddiesSkeleton />
        <BottomNav />
      </div>
    }>
      <BuddiesPageContent />
    </Suspense>
  );
}

