'use client';

interface LoadingScreenProps {
  message?: string;
  fullPage?: boolean;
  className?: string;
}

export default function LoadingScreen({ message = 'Loading...', fullPage = false, className = '' }: LoadingScreenProps) {
  const content = (
    <div className={`flex flex-col items-center justify-center gap-6 ${className}`}>
      <div className="relative" aria-hidden>
        <svg className="w-12 h-12 animate-spin" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="rgba(17, 24, 39, 0.10)"
            strokeWidth="3"
          />
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="#0ef9b4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="42 14"
          />
        </svg>
        <div className="absolute inset-0 rounded-full bg-[#0ef9b4]/10 blur-md" />
      </div>
      <p className="text-gray-600 text-sm font-medium">{message}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        {content}
      </div>
    );
  }

  return content;
}
