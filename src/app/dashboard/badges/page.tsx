import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import BadgeGalleryView from './BadgeGalleryView';

export default async function BadgesPage() {
  const session = await getSession();
  let isManager = false;

  if (session) {
    const ctx = await getSessionContext(session.userId);
    isManager =
      ctx.can('BADGES_MANAGE') ||
      ctx.can('BADGE_MANAGE') ||
      ctx.userType === 'STAFF' ||
      ctx.roles.includes('COORDINATOR') ||
      ctx.roles.includes('EXECUTIVE') ||
      ctx.can('MANAGE') ||
      ctx.permissions.has('ADMIN_SYSTEM');
  }

  return <BadgeGalleryView isManager={isManager} />;
}

export const dynamic = 'force-dynamic';

