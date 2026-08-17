import { getAllBadgesWithUserProgress } from '@/modules/badges/badgeActions';
import BadgeGalleryView from './BadgeGalleryView';

export default async function BadgesPage() {
  const data = await getAllBadgesWithUserProgress();

  return (
    <BadgeGalleryView
      initialBadges={data.badges || []}
      userOwnedCount={data.userOwnedCount || 0}
      totalBadgeCount={data.totalBadgeCount || 0}
      isManager={Boolean(data.isManager)}
    />
  );
}

export const dynamic = 'force-dynamic';
