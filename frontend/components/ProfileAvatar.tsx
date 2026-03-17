'use client';

import Link from 'next/link';

interface ProfileAvatarProps {
  userId: number;
  avatarUrl?: string | null;
  fullName?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /** When true (default), avatar links to profile. Set false when inside another Link. */
  linkToProfile?: boolean;
}

const sizeClasses = {
  xs: 'w-8 h-8 text-xs',
  sm: 'w-10 h-10 text-sm',
  md: 'w-12 h-12 text-base',
  lg: 'w-16 h-16 text-lg',
  xl: 'w-32 h-32 text-3xl',
};

const avatarContent = (
  avatarUrl: string | null | undefined,
  fullName: string | null | undefined,
  initials: string
) => (
  <>
    {avatarUrl ? (
      <img
        src={avatarUrl}
        alt={fullName || 'Avatar'}
        className="w-full h-full object-cover"
      />
    ) : (
      <span>{initials}</span>
    )}
  </>
);

export default function ProfileAvatar({
  userId,
  avatarUrl,
  fullName,
  size = 'md',
  className = '',
  linkToProfile = true,
}: ProfileAvatarProps) {
  const initials = fullName
    ? fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const sizeClass = sizeClasses[size];
  const baseClasses = `flex-shrink-0 rounded-full bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] flex items-center justify-center overflow-hidden text-black font-bold transition-all ${sizeClass} ${className}`;

  if (linkToProfile) {
    return (
      <Link
        href={`/profile?userId=${userId}`}
        className={`${baseClasses} hover:ring-2 hover:ring-[#0dd9a0] hover:ring-offset-2`}
        title={`View ${fullName || 'Profile'}`}
      >
        {avatarContent(avatarUrl, fullName, initials)}
      </Link>
    );
  }

  return (
    <div className={baseClasses}>
      {avatarContent(avatarUrl, fullName, initials)}
    </div>
  );
}
