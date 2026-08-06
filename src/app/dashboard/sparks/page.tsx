import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { notFound, redirect } from 'next/navigation';
import { getSparksManagementOverview } from '@/modules/sparks/sparksActions';
import SparksManagementView from './components/SparksManagementView';

interface PageProps {
  searchParams: Promise<{
    period?: 'all' | 'month' | 'week';
  }>;
}

export default async function SparksManagementPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    ctx.userType === 'STAFF' &&
    (ctx.can('MANAGE') || ctx.roles.includes('COORDINATOR') || ctx.roles.includes('EXECUTIVE'));

  const canAccess = ctx.can('SPARKS_MANAGE') || isCoordinator || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

  if (!canAccess) {
    notFound();
  }

  const { period = 'month' } = await searchParams;
  const overview = await getSparksManagementOverview(period);

  return <SparksManagementView overview={overview} period={period} />;
}

export const dynamic = 'force-dynamic';
