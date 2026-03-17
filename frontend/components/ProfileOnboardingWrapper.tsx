'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import ProfileOnboarding from './ProfileOnboarding';
import { calculateProfileCompletion } from '@/lib/profileCompletion';

export default function ProfileOnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, userFromApi, loading, refreshUser } = useAuth();
  const pathname = usePathname();

  // Don't show onboarding on auth pages
  const authPages = ['/login', '/register', '/auth', '/waitlist', '/forgot-password', '/reset-password'];
  const isAuthPage = authPages.some(page => pathname?.startsWith(page));

  // Show loading state while checking auth
  if (loading || isAuthPage) {
    return <>{children}</>;
  }

  // Don't show onboarding for non-authenticated users
  if (!user) {
    return <>{children}</>;
  }

  // Only check users table - never trigger onboarding when using fallback (API failed)
  if (!userFromApi) {
    return <>{children}</>;
  }

  // If profile_completed is true in users table, don't show onboarding
  if (user.profile_completed === true) {
    return <>{children}</>;
  }

  // Profile incomplete - show onboarding
  const profileCompletion = calculateProfileCompletion(user);
  const shouldShowOnboarding = profileCompletion && !profileCompletion.isComplete;
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
