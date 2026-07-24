import { ReactNode } from 'react';

interface PermissionGuardProps {
  /** True if the user has the required permission */
  has: boolean;
  /** Content to render when permission is granted */
  children: ReactNode;
  /** Optional fallback — defaults to null (renders nothing) */
  fallback?: ReactNode;
}

/**
 * PermissionGuard — Server Component wrapper.
 *
 * Conditionally renders children based on a boolean permission flag
 * computed server-side via getSessionContext().
 *
 * @example
 * const ctx = await getSessionContext(session.userId);
 *
 * <PermissionGuard has={ctx.can('CREATE_PROJECT')}>
 *   <CreateProjectButton />
 * </PermissionGuard>
 *
 * <PermissionGuard has={ctx.can('MANAGE')} fallback={<AccessDenied />}>
 *   <AdminPanel />
 * </PermissionGuard>
 */
export default function PermissionGuard({ has, children, fallback = null }: PermissionGuardProps) {
  if (!has) return <>{fallback}</>;
  return <>{children}</>;
}
