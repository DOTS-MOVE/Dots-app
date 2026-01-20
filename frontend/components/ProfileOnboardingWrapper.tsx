'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import ProfileOnboarding from './ProfileOnboarding';
import { calculateProfileCompletion } from '@/lib/profileCompletion';

export default function ProfileOnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, refreshUser } = useAuth();
  const pathname = usePathname();

  // Don't show onboarding on auth pages
  const authPages = ['/login', '/register', '/auth', '/waitlist'];
  const isAuthPage = authPages.some(page => pathname?.startsWith(page));

  // Show loading state while checking auth
  if (loading || isAuthPage) {
    return <>{children}</>;
  }

  // Don't show onboarding for non-authenticated users
  if (!user) {
    return <>{children}</>;
  }

  // Check if user has explicitly completed onboarding (via skip or complete)
  // If profile_completed is true, don't show onboarding regardless of completion percentage
  // Otherwise, check if profile is less than 80% complete
  const profileCompletion = calculateProfileCompletion(user);
  const hasCompletedOnboarding = user.profile_completed === true;
  const shouldShowOnboarding = !hasCompletedOnboarding && profileCompletion && !profileCompletion.isComplete;

  // Show onboarding if:
  // 1. User is logged in
  // 2. User hasn't explicitly completed onboarding (profile_completed is false/null)
  // 3. Profile is less than 80% complete
  if (shouldShowOnboarding) {
    return (
      <ProfileOnboarding
        onComplete={async () => {
          // Refresh user to get updated profile_completed status
          await refreshUser();
          // Small delay to ensure state propagates and wrapper re-renders
          await new Promise(resolve => setTimeout(resolve, 300));
        }}
      />
    );
  }

  return <>{children}</>;
}
