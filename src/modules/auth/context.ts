/**
 * getPageContext — Convenience helper for Server Components.
 *
 * One-call wrapper around getSessionContext that also handles the
 * common session-not-found case. Returns both the context and the session.
 *
 * @example
 * // In a Server Component:
 * const { session, ctx } = await getPageContext();
 * if (!session) redirect('/');
 *
 * const canCreate = ctx.can('CREATE_PROJECT');
 * const canManage = ctx.can('MANAGE');
 */

import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';

export type PageContext = {
  session: Awaited<ReturnType<typeof getSession>>;
  ctx: Awaited<ReturnType<typeof getSessionContext>>;
};

export async function getPageContext(): Promise<PageContext> {
  const session = await getSession();

  if (!session) {
    // Return a zero-permission context so callers can check session first
    return {
      session: null,
      ctx: {
        can: () => false,
        permissions: new Set<string>(),
        roles: [],
      },
    };
  }

  const ctx = await getSessionContext(session.userId);

  return { session, ctx };
}
