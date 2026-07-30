'use server';

import { cookies, headers } from 'next/headers';
import { getDB, getKV } from '@/db/client';
import { generateSalt, hashPassword } from './crypto';

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const SESSION_TTL_SECONDS = 604800; // 7 days in seconds

interface UserRow {
  id: string;
  email: string;
  username: string | null;
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
  const username = (formData.get('username') as string || '').trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!name || !email || !password || !username) {
    return { success: false, error: 'All fields (name, email, username, password) are required.' };
  }

  // Validate username format: alphanumeric + underscores/hyphens, 3-20 chars
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return { success: false, error: 'Username must be 3-20 characters long and can only contain letters, numbers, underscores, or hyphens.' };
  }

  const db = await getDB();
  const kv = await getKV();

  try {
    // 1. Check if user with same email or username already exists
    const existingUser = await db
      .prepare('SELECT id, email, username FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .bind(email.toLowerCase(), username)
      .first() as { id: string; email: string; username: string | null } | null;

    if (existingUser) {
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        return { success: false, error: 'Email is already registered.' };
      }
      if (existingUser.username && existingUser.username.toLowerCase() === username) {
        return { success: false, error: 'Username is already taken.' };
      }
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

    if (isFirstUser) {
      // First user is automatically active and gets EXECUTIVE role
      await db
        .prepare('INSERT INTO users (id, email, username, name, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, email.toLowerCase(), username, name, 'ACTIVE', dbPasswordHash)
        .run();

      await db
        .prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)')
        .bind(userId, 'role_executive')
        .run();

      // Create session & cookie
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

      return { success: true, pendingApproval: false };
    } else {
      // Subsequent users register as PENDING and require manual approval & role assignment
      await db
        .prepare('INSERT INTO users (id, email, username, name, status, password_hash) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(userId, email.toLowerCase(), username, name, 'PENDING', dbPasswordHash)
        .run();

      return { success: true, pendingApproval: true };
    }
  } catch (err: any) {
    console.error('Signup error:', err);
    return { success: false, error: err.message || 'Signup failed' };
  }
}

/**
 * Server Action for User Login (Hybrid: Accepts Email OR Username)
 */
export async function loginAction(formData: FormData) {
  const identifier = ((formData.get('identifier') || formData.get('email')) as string || '').trim().toLowerCase();
  const password = formData.get('password') as string;

  if (!identifier || !password) {
    return { success: false, error: 'Username/Email and password are required.' };
  }

  const db = await getDB();
  const kv = await getKV();

  try {
    // 1. Fetch user from database by email OR username
    const user = await db
      .prepare('SELECT id, email, username, name, status, password_hash FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
      .bind(identifier, identifier)
      .first() as UserRow | null;

    if (!user || !user.password_hash) {
      return { success: false, error: 'Invalid username/email or password.' };
    }

    if (user.status === 'PENDING') {
      return { success: false, error: 'Your account is pending admin approval.' };
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
      return { success: false, error: 'Invalid username/email or password.' };
    }

    // 3. Create session & cookie
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
