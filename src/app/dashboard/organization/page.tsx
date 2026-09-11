import { getSession } from '@/modules/auth/session';
import { getSessionContext, hasPermission } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';
import { getOrganizationTree, getFlatOrgNodes } from '@/modules/organization/orgActions';
import { OrganizationManager } from '@/modules/organization/components/OrganizationManager';

export const metadata = {
  title: 'Struktur Organisasi | KIAN HQ',
  description: 'Bagan dan struktur hierarki organisasi KIAN Troopers beserta pengelolaan hak khusus divisi.',
};

export default async function OrganizationPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);

  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  const [treeNodes, flatNodes] = await Promise.all([
    getOrganizationTree(),
    getFlatOrgNodes(),
  ]);

  return (
    <OrganizationManager
      treeNodes={treeNodes}
      flatNodes={flatNodes}
      canManage={canManage}
    />
  );
}
