import { cookies } from 'next/headers';
import { getKV } from '@/db/client';

export interface SessionUser {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
  googleAccessToken: string;
  googleRefreshToken?: string;
  expiresAt: number;
}

/**
 * Retrieves the current session from the cookies and Cloudflare KV.
 * Must be called in Server Components, Server Actions, or Route Handlers.
 */
export async function getSession(): Promise<SessionUser | null> {
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

    const session = JSON.parse(sessionVal) as SessionUser;

    // Check session expiration
    if (Date.now() > session.expiresAt) {
      return null;
    }

    return session;
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}
