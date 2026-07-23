'use server';

import { cookies, headers } from 'next/headers';
import { getDB, getKV } from '@/db/client';
import { generateSalt, hashPassword } from './crypto';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const SESSION_TTL_SECONDS = 604800; // 7 days in seconds

interface UserRow {
  id: string;
  email: string;
  name: string;
  status: string;
  password_hash: string | null;
}

/**
 * Server Action for User Signup
 */
export async function signupAction(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!name || !email || !password) {
    return { success: false, error: 'All fields are required.' };
  }

  const db = await getDB();
  const kv = await getKV();

  try {
    // 1. Check if user already exists
    const existingUser = await db
      .prepare('SELECT id FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first() as { id: string } | null;

    if (existingUser) {
      return { success: false, error: 'Email is already registered.' };
    }

    // 2. Hash Password (stored as salt:hash_hex)
    const salt = generateSalt();
    const hash = await hashPassword(password, salt);
    const dbPasswordHash = `${salt}:${hash}`;

    // 3. Create User ID and insert into database
    const userId = `usr_${crypto.randomUUID().replace(/-/g, '')}`;
    
    // Check if this is the first user
    const countResult = await db.prepare('SELECT COUNT(*) as count FROM users').first() as { count: number };
    const isFirstUser = countResult.count === 0;
    const initialRoleId = isFirstUser ? 'role_executive' : 'role_creator';

    // Insert user row
    await db
      .prepare('INSERT INTO users (id, email, name, status, password_hash) VALUES (?, ?, ?, ?, ?)')
      .bind(userId, email.toLowerCase(), name, 'ACTIVE', dbPasswordHash)
      .run();

    // Assign role
    await db
      .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
      .bind(userId, initialRoleId)
      .run();

    // 4. Create session & cookie
    const sessionId = `session_${crypto.randomUUID().replace(/-/g, '')}`;
    const sessionData = {
      userId,
      email: email.toLowerCase(),
      name,
      avatar: undefined,
      expiresAt: Date.now() + SESSION_TTL,
    };

    await kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL_SECONDS,
    });

    const headersStore = await headers();
    const referer = headersStore.get('referer') || '';
    const secure = referer.startsWith('https://');

    const cookieStore = await cookies();
    cookieStore.set('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Signup error:', err);
    return { success: false, error: err.message || 'Signup failed' };
  }
}

/**
 * Server Action for User Login
 */
export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const db = await getDB();
  const kv = await getKV();

  try {
    // 1. Fetch user from database
    const user = await db
      .prepare('SELECT id, email, name, status, password_hash FROM users WHERE email = ?')
      .bind(email.toLowerCase())
      .first() as UserRow | null;

    if (!user || !user.password_hash) {
      return { success: false, error: 'Invalid email or password.' };
    }

    if (user.status !== 'ACTIVE') {
      return { success: false, error: 'Your account is deactivated.' };
    }

    // 2. Parse hash value & verify password
    const parts = user.password_hash.split(':');
    if (parts.length !== 2) {
      return { success: false, error: 'Invalid password format in database.' };
    }
    const [salt, storedHash] = parts;
    const computedHash = await hashPassword(password, salt);

    if (computedHash !== storedHash) {
      return { success: false, error: 'Invalid email or password.' };
    }

    // 3. Create session & cookie
    const sessionId = `session_${crypto.randomUUID().replace(/-/g, '')}`;
    const sessionData = {
      userId: user.id,
      email: user.email,
      name: user.name,
      avatar: undefined,
      expiresAt: Date.now() + SESSION_TTL,
    };

    await kv.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_TTL_SECONDS,
    });

    const headersStore = await headers();
    const referer = headersStore.get('referer') || '';
    const secure = referer.startsWith('https://');

    const cookieStore = await cookies();
    cookieStore.set('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return { success: true };
  } catch (err: any) {
    console.error('Login error:', err);
    return { success: false, error: err.message || 'Login failed' };
  }
}
