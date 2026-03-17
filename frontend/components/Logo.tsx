'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Logo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const logoSize = size === 'large' ? 80 : 60;
  
  return (
    <Link href="/" className="flex items-center justify-center">
      <div className="flex items-center justify-center" style={{ width: logoSize, height: logoSize }}>
        <Image
          src="/logo.png"
          alt="DOTS Logo"
          width={logoSize}
          height={logoSize}
          className="object-contain"
          priority
        />
      </div>
    </Link>
  );
}
