import { NextResponse } from 'next/server';
import { getDB, getKV } from '@/db/client';
import { hashPassword } from '@/modules/auth/crypto';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = 604800;

export async function POST(request: Request) {
  try {
    let identifier = '';
    let password = '';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as any;
      identifier = (body?.identifier || body?.email || '').trim().toLowerCase();
      password = body?.password || '';
    } else {
      const formData = await request.formData();
      identifier = ((formData.get('identifier') || formData.get('email')) as string || '').trim().toLowerCase();
      password = (formData.get('password') as string) || '';
    }

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: 'Username/Email and password are required.' },
        { status: 400 }
      );
    }

    const db = await getDB();
    const kv = await getKV();

    const user = await db
      .prepare('SELECT id, email, username, name, status, password_hash FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .bind(identifier, identifier)
      .first() as { id: string; email: string; username: string | null; name: string; status: string; password_hash: string | null } | null;

    if (!user || !user.password_hash) {
      return NextResponse.json({ success: false, error: 'Invalid username/email or password.' }, { status: 400 });
    }

    if (user.status === 'PENDING') {
      return NextResponse.json({ success: false, error: 'Your account is pending admin approval.' }, { status: 400 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, error: 'Your account is deactivated.' }, { status: 400 });
    }

    const parts = user.password_hash.split(':');
    if (parts.length !== 2) {
      return NextResponse.json({ success: false, error: 'Invalid password format in database.' }, { status: 400 });
    }

    const [salt, storedHash] = parts;
    const computedHash = await hashPassword(password, salt);

    if (computedHash !== storedHash) {
      return NextResponse.json({ success: false, error: 'Invalid username/email or password.' }, { status: 400 });
    }

    const sessionId = `session_${crypto.randomUUID().replace(/-/g, '')}`;
    const sessionData = {
      userId: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      avatar: undefined,
      expiresAt: Date.now() + SESSION_TTL,
    };

    await kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL_SECONDS,
    });

    const referer = request.headers.get('referer') || '';
    const secure = referer.startsWith('https://');

    const response = NextResponse.json({ success: true });
    response.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  } catch (err: any) {
    console.error('API Login error:', err);
    return NextResponse.json({ success: false, error: err.message || 'Login failed' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
