import { NextResponse } from 'next/server';
import { getDB, getKV } from '@/db/client';
import { generateSalt, hashPassword } from '@/modules/auth/crypto';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = 604800;

export async function POST(request: Request) {
  try {
    let name = '';
    let email = '';
    let username = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as any;
      name = (body?.name || '').trim();
      email = (body?.email || '').trim();
      username = (body?.username || '').trim().toLowerCase();
      password = body?.password || '';
    } else {
      const formData = await request.formData();
      name = ((formData.get('name') as string) || '').trim();
      email = ((formData.get('email') as string) || '').trim();
      username = ((formData.get('username') as string) || '').trim().toLowerCase();
      password = (formData.get('password') as string) || '';
    }

    if (!name || !email || !password || !username) {
      return NextResponse.json(
        { success: false, error: 'All fields (name, email, username, password) are required.' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return NextResponse.json(
        { success: false, error: 'Username must be 3-20 characters long (letters, numbers, _, -).' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const kv = await getKV();

    const existingUser = await db
      .prepare('SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .bind(email.toLowerCase(), username)
      .first() as { id: string; email: string; username: string | null } | null;

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return NextResponse.json({ success: false, error: 'Email is already registered.' }, { status: 400 });
      }
      if (existingUser.username && existingUser.username.toLowerCase() === username) {
        return NextResponse.json({ success: false, error: 'Username is already taken.' }, { status: 400 });
      }
    }

    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const dbPasswordHash = `${salt}:${hash}`;
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;

    const countResult = await db.prepare('SELECT COUNT(*) as count FROM users').first() as { count: number };
    const isFirstUser = countResult.count === 0;

    if (isFirstUser) {
      await db
        .prepare('INSERT INTO users (id, email, username, name, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, email.toLowerCase(), username, name, 'ACTIVE', dbPasswordHash)
        .run();

      await db
        .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
        .bind(userId, 'role_executive')
        .run();

      const sessionId = `session_${crypto.randomUUID().replace(/-/g, '')}`;
      const sessionData = {
        userId,
        email: email.toLowerCase(),
        username,
        name,
        avatar: undefined,
        expiresAt: Date.now() + SESSION_TTL,
      };

      await kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
        expirationTtl: SESSION_TTL_SECONDS,
      });

      const referer = request.headers.get('referer') || '';
      const secure = referer.startsWith('https://');

      const response = NextResponse.json({ success: true, pendingApproval: false });
      response.cookies.set('session_id', sessionId, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_SECONDS,
      });

      return response;
    } else {
      await db
        .prepare('INSERT INTO users (id, email, username, name, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, email.toLowerCase(), username, name, 'PENDING', dbPasswordHash)
        .run();

      return NextResponse.json({ success: true, pendingApproval: true });
    }
  } catch (err: any) {
    console.error('API Signup error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Signup failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
