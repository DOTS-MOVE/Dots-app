import Navbar from '@/components/Navbar';
import { EventDetailSkeleton } from '@/components/SkeletonLoader';

export default function EventDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <EventDetailSkeleton />
    </div>
  );
}
