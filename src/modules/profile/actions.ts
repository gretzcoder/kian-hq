'use server';

import { getSession } from '@/modules/auth/session';
import { getDB, getKV } from '@/db/client';
import { generateSalt, hashPassword } from '@/modules/auth/crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

/**
 * Update the current user's display name.
 * Also refreshes the KV session so the header updates on next page load.
 */
export async function updateProfileName(name: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  name = name.trim();
  if (!name || name.length < 2) return { success: false, error: 'Nama minimal 2 karakter.' };
  if (name.length > 80) return { success: false, error: 'Nama maksimal 80 karakter.' };

  const db = await getDB();
  await db.prepare('UPDATE users SET name = ? WHERE id = ?').bind(name, session.userId).run();

  // Refresh KV session so the header name updates immediately
  try {
    const kv = await getKV();
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('session_id')?.value;
    if (sessionId) {
      const updated = { ...session, name };
      const ttlSeconds = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
      await kv.put(`session:${sessionId}`, JSON.stringify(updated), { expirationTtl: ttlSeconds || 3600 });
    }
  } catch {
    // non-fatal
  }

  revalidatePath('/dashboard/profile');
  return { success: true };
}

/**
 * Change the current user's password.
 * Requires the current password for verification.
 */
export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password baru minimal 6 karakter.' };
  }

  const db = await getDB();
  const user = await db
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .bind(session.userId)
    .first() as { password_hash: string | null } | null;

  if (!user?.password_hash) return { success: false, error: 'Akun tidak memiliki password.' };

  const [salt, storedHash] = user.password_hash.split(':');
  const computedHash = await hashPassword(currentPassword, salt);
  if (computedHash !== storedHash) {
    return { success: false, error: 'Password saat ini salah.' };
  }

  const newSalt = generateSalt();
  const newHash = await hashPassword(newPassword, newSalt);
  const dbHash = `${newSalt}:${newHash}`;

  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(dbHash, session.userId).run();

  revalidatePath('/dashboard/profile');
  return { success: true };
}
