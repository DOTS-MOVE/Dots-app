'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import MatchGrid from '@/components/MatchGrid';
import { api } from '@/lib/api';
import { Match } from '@/types';
import Link from 'next/link';

function MatchesPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'my-matches'>('discover');
  const [swipedUsers, setSwipedUsers] = useState<Set<number>>(new Set());
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    // Check URL params for tab
    const tab = searchParams?.get('tab');
    if (tab === 'my-matches') {
      setActiveTab('my-matches');
    }
    
    loadData(true); // Reset on initial load
  }, [user, searchParams]);

  const loadData = async (reset = false) => {
    try {
      const [matchesData, suggestedData] = await Promise.all([
        api.getMatches(),
        api.getSuggestedMatches(10, 20, reset ? 0 : suggested.length), // Lowered min_score to 20 for more matches
      ]);
      setMatches(matchesData);
      if (reset) {
        setSuggested(suggestedData);
        setCurrentIndex(0);
        setSwipedUsers(new Set());
        setHasMore(suggestedData.length > 0); // Always true if we got any matches
      } else {
        setSuggested(prev => [...prev, ...suggestedData]);
        setHasMore(suggestedData.length > 0);
      }
    } catch (error) {
      console.error('Failed to load matches:', error);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreMatches = useCallback(async () => {
    if (loadingMore || !hasMore || suggested.length === 0) return;
    
    setLoadingMore(true);
    try {
      const nextBatch = await api.getSuggestedMatches(10, 20, suggested.length); // Lowered min_score to 20
      if (nextBatch.length === 0) {
        // Try with even lower threshold
        const fallbackBatch = await api.getSuggestedMatches(10, 10, suggested.length);
        if (fallbackBatch.length === 0) {
          setHasMore(false);
        } else {
          setSuggested(prev => [...prev, ...fallbackBatch]);
          setHasMore(true); // Keep trying
        }
      } else {
        setSuggested(prev => [...prev, ...nextBatch]);
        setHasMore(true); // Always assume more available
      }
    } catch (error) {
      console.error('Failed to load more matches:', error);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, suggested.length]);

  // Load more matches when approaching the end
  useEffect(() => {
    if (activeTab === 'discover' && suggested.length > 0 && currentIndex >= suggested.length - 3 && hasMore && !loadingMore) {
      loadMoreMatches();
    }
  }, [currentIndex, suggested.length, hasMore, loadingMore, activeTab, loadMoreMatches]);

  const handleSwipe = async (direction: 'left' | 'right', user2Id: number) => {
    if (swipedUsers.has(user2Id)) return;
    
    setSwipedUsers(prev => new Set(prev).add(user2Id));

    if (direction === 'right') {
      // Like - create match request
      try {
        await api.createMatch(user2Id);
        // Reload matches to show the new match
        setTimeout(() => {
          loadData();
        }, 500);
      } catch (error: any) {
        console.error('Failed to create match:', error);
        setSwipedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user2Id);
          return newSet;
        });
      }
    }
    // For left swipe (pass), we just move to next - no API call needed
  };

  const handleLike = () => {
    if (currentIndex < suggested.length) {
      const currentUser = suggested[currentIndex];
      handleSwipe('right', currentUser.user.id);
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  const currentMatch = suggested[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      {/* Tab Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-center space-x-4 mb-6">
          <button
            onClick={() => {
              setActiveTab('discover');
              setCurrentIndex(0);
              router.push('/matches');
            }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
              activeTab === 'discover'
                ? 'bg-[#00D9A5] text-black shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Discover
          </button>
          <button
            onClick={() => {
              setActiveTab('my-matches');
              router.push('/matches?tab=my-matches');
            }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all duration-300 relative ${
              activeTab === 'my-matches'
                ? 'bg-[#00D9A5] text-black shadow-lg'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            My Matches
            {matches.length > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {matches.filter(m => m.status === 'accepted' || (m.status === 'pending' && m.user2_id === user?.id)).length}
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
              <div className="text-gray-600">Loading matches...</div>
            </div>
          ) : suggested.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="text-6xl mb-4">⏳</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Loading more matches...</h3>
              <p className="text-gray-600 mb-6">
                We're finding great matches for you!
              </p>
            </div>
          ) : (
            <>
              {/* Match Grid */}
              <MatchGrid
                matches={suggested}
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
                              ? 'bg-[#00D9A5] w-8'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          aria-label={`Go to match ${i + 1}`}
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
                    Showing {Math.min(currentIndex + 1, suggested.length)} of {suggested.length}{hasMore ? '+' : ''} matches
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 max-w-md mx-auto">
                    <div 
                      className="bg-[#00D9A5] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(((currentIndex + 1) / Math.max(suggested.length, 1)) * 100, 100)}%` }}
                    />
                  </div>
                  {loadingMore && (
                    <p className="text-xs text-gray-500 mt-2">Loading more matches...</p>
                  )}
                  {!hasMore && currentIndex >= suggested.length - 1 && (
                    <p className="text-xs text-gray-500 mt-2">No more matches available</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* My Matches Tab */}
      {activeTab === 'my-matches' && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          {matches.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl shadow-lg">
              <div className="text-6xl mb-4">💔</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">No matches yet</h3>
              <p className="text-gray-600 mb-6">
                Start swiping to find your workout buddies!
              </p>
              <button
                onClick={() => {
                  setActiveTab('discover');
                  router.push('/matches');
                }}
                className="inline-block bg-[#00D9A5] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#00B88A] transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Start Discovering
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pending Matches (incoming requests) */}
              {matches.filter(m => m.status === 'pending' && m.user2_id === user?.id).length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Requests</h2>
                  <div className="space-y-3">
                    {matches
                      .filter(m => m.status === 'pending' && m.user2_id === user?.id)
                      .map((match) => {
                        const otherUser = match.user1;
                        return (
                          <div key={match.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4 flex-1">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white font-bold text-xl">
                                  {otherUser?.avatar_url ? (
                                    <img src={otherUser.avatar_url} alt={otherUser.full_name || ''} className="w-16 h-16 rounded-full object-cover" />
                                  ) : (
                                    <span>{otherUser?.full_name?.[0] || 'U'}</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-lg">{otherUser?.full_name || 'Anonymous'}</p>
                                  <p className="text-sm text-gray-600">
                                    {match.match_score && `${Math.round(match.match_score)}% match`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateMatch(match.id, 'accepted');
                                      await loadData();
                                    } catch (error: any) {
                                      alert(error.message || 'Failed to accept match');
                                    }
                                  }}
                                  className="px-6 py-2 bg-[#00D9A5] text-black rounded-xl font-semibold hover:bg-[#00B88A] transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      await api.updateMatch(match.id, 'rejected');
                                      await loadData();
                                    } catch (error: any) {
                                      alert(error.message || 'Failed to reject match');
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

              {/* Pending Matches (outgoing likes - people you liked) */}
              {matches.filter(m => m.status === 'pending' && m.user1_id === user?.id).length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">People You Liked</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches
                      .filter(m => m.status === 'pending' && m.user1_id === user?.id)
                      .map((match) => {
                        const otherUser = match.user2;
                        return (
                          <div key={match.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative">
                            <button
                              onClick={async () => {
                                if (confirm('Remove this match?')) {
                                  try {
                                    await api.deleteMatch(match.id);
                                    await loadData();
                                  } catch (error: any) {
                                    alert(error.message || 'Failed to remove match');
                                  }
                                }
                              }}
                              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                              aria-label="Remove match"
                            >
                              <span className="text-lg">×</span>
                            </button>
                            <div className="flex items-center space-x-4">
                              <div className="w-16 h-16 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white font-bold text-xl">
                                {otherUser?.avatar_url ? (
                                  <img src={otherUser.avatar_url} alt={otherUser.full_name || ''} className="w-16 h-16 rounded-full object-cover" />
                                ) : (
                                  <span>{otherUser?.full_name?.[0] || 'U'}</span>
                                )}
                              </div>
                              <div className="flex-1 pr-8">
                                <p className="font-bold text-gray-900 text-lg">{otherUser?.full_name || 'Anonymous'}</p>
                                <p className="text-sm text-gray-600">
                                  {otherUser?.location && `${otherUser.location}`}
                                </p>
                                {otherUser?.sports && otherUser.sports.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {otherUser.sports.slice(0, 2).map((sport: any) => (
                                      <span key={sport.id} className="text-xs bg-[#E6F9F4] text-[#00B88A] px-2 py-0.5 rounded-full">
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
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Accepted Matches */}
              {matches.filter(m => m.status === 'accepted').length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Your Matches</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {matches
                      .filter(m => m.status === 'accepted')
                      .map((match) => {
                        const otherUser = match.user1_id === user?.id ? match.user2 : match.user1;
                        return (
                          <div key={match.id} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 relative">
                            <button
                              onClick={async () => {
                                if (confirm('Remove this match?')) {
                                  try {
                                    await api.deleteMatch(match.id);
                                    await loadData();
                                  } catch (error: any) {
                                    alert(error.message || 'Failed to remove match');
                                  }
                                }
                              }}
                              className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
                              aria-label="Remove match"
                            >
                              <span className="text-lg">×</span>
                            </button>
                            <Link
                              href={`/messages?user=${otherUser?.id}`}
                              className="block"
                            >
                              <div className="flex items-center space-x-4 pr-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#00D9A5] to-[#00B88A] rounded-full flex items-center justify-center text-white font-bold text-xl">
                                  {otherUser?.avatar_url ? (
                                    <img src={otherUser.avatar_url} alt={otherUser.full_name || ''} className="w-16 h-16 rounded-full object-cover" />
                                  ) : (
                                    <span>{otherUser?.full_name?.[0] || 'U'}</span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-bold text-gray-900 text-lg">{otherUser?.full_name || 'Anonymous'}</p>
                                  <p className="text-sm text-gray-600">
                                    {match.match_score && `${Math.round(match.match_score)}% match`}
                                    {otherUser?.location && ` • ${otherUser.location}`}
                                  </p>
                                  {otherUser?.sports && otherUser.sports.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {otherUser.sports.slice(0, 2).map((sport: any) => (
                                        <span key={sport.id} className="text-xs bg-[#E6F9F4] text-[#00B88A] px-2 py-0.5 rounded-full">
                                          {sport.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <span className="text-2xl">💬</span>
                              </div>
                            </Link>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}

export default function MatchesPage() {
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
      <MatchesPageContent />
    </Suspense>
  );
}

