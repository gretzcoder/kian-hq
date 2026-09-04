import { cache } from 'react';
import { cookies } from 'next/headers';
import { getKV, getDB } from '@/db/client';
import { isAuthorizedForImpersonation } from '@/modules/users/impersonationActions';

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  expiresAt: number;
  realUserId?: string;
  realUserName?: string;
  isImpersonating?: boolean;
}

/**
 * Retrieves the current session from cookies, Cloudflare KV, and checks user impersonation state.
 * Must be called in Server Components, Server Actions, or Route Handlers.
 */
export const getSession = cache(async function getSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;

    if (!sessionId) {
      return null;
    }

    const kv = await getKV();
    const sessionVal = await kv.get(`session:${sessionId}`);
    if (!sessionVal) {
      return null;
    }

    const realSession = JSON.parse(sessionVal) as SessionUser;

    // Check session expiration
    if (Date.now() > realSession.expiresAt) {
      return null;
    }

    // Check user impersonation state
    const impersonateUserId = cookieStore.get('impersonate_user_id')?.value;
    if (impersonateUserId && impersonateUserId !== realSession.userId) {
      const isAuth = await isAuthorizedForImpersonation(realSession.userId);
      if (isAuth) {
        const db = await getDB();
        const targetUser = await db
          .prepare('SELECT id, name, email, avatar_url FROM users WHERE id = ? AND status = "ACTIVE"')
          .bind(impersonateUserId)
          .first() as { id: string; name: string; email: string; avatar_url?: string } | null;

        if (targetUser) {
          return {
            userId: targetUser.id,
            email: targetUser.email,
            name: targetUser.name,
            avatar: targetUser.avatar_url || realSession.avatar,
            expiresAt: realSession.expiresAt,
            realUserId: realSession.userId,
            realUserName: realSession.name,
            isImpersonating: true,
          };
        }
      }
    }

    return realSession;
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
});
