'use client';

import { useAuth } from '@/lib/auth';
import { usePathname } from 'next/navigation';
import ProfileOnboarding from './ProfileOnboarding';
import SpotlightTour from './SpotlightTour';

export default function ProfileOnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { user, userFromApi, loading, refreshUser } = useAuth();
  const pathname = usePathname();

  const authPages = ['/login', '/register', '/auth', '/waitlist', '/forgot-password', '/reset-password'];
  const isAuthPage = authPages.some((page) => pathname?.startsWith(page));

  if (loading || isAuthPage) {
    return <>{children}</>;
  }

  if (!user) {
    return <>{children}</>;
  }

  if (!userFromApi) {
    return <>{children}</>;
  }

  if (user.profile_completed === true) {
    return (
      <>
        {children}
        <SpotlightTour />
      </>
    );
  }

  return (
    <ProfileOnboarding
      onComplete={async () => {
        await refreshUser();
        await new Promise((resolve) => setTimeout(resolve, 300));
      }}
    />
  );
}
