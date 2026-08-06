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

  // Refresh KV session so the header name updates immediately (only if not impersonating)
  if (!session.isImpersonating) {
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
  }

  revalidatePath('/dashboard/profile');
  return { success: true };
}

/**
 * Normalizes user avatar URL (e.g. converting Google Drive view links to direct image links)
 */
export async function normalizeAvatarUrl(url: string | null | undefined): Promise<string | undefined> {
  if (!url || !url.trim()) return undefined;
  let clean = url.trim();

  // Convert Google Drive view URL to direct image link
  // e.g., https://drive.google.com/file/d/1A2B3C4D5E/view?usp=sharing
  const gdriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (gdriveMatch && gdriveMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${gdriveMatch[1]}`;
  }

  // Convert Dropbox share link to direct download link
  if (clean.includes('dropbox.com')) {
    clean = clean.replace('?dl=0', '?dl=1').replace('dl=0', 'dl=1');
  }

  return clean;
}

/**
 * Normalizes Indonesian phone/WhatsApp numbers to international format (628...)
 * e.g., '081234567890' -> '6281234567890'
 * e.g., '+62 812-3456-7890' -> '6281234567890'
 * e.g., '81234567890' -> '6281234567890'
 */
export async function normalizeWhatsappNumber(phone: string | null | undefined): Promise<string | null> {
  if (!phone || !phone.trim()) return null;
  let digits = phone.replace(/[^0-9]/g, '');

  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  } else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }

  return digits || null;
}

/**
 * Update complete OJT user profile data.
 * Updates D1 database and KV session.
 */
export async function updateOjtProfile(payload: {
  name: string;
  email?: string;
  username?: string;
  university?: string;
  student_id_number?: string;
  study_program?: string;
  semester?: string;
  whatsapp_number?: string;
  avatar_url?: string;
  main_roles?: string[]; // Multiple roles e.g. ['RESEARCHER', 'PLANNER']
  custom_role?: string;
  tools?: string;
  portfolio_url?: string;
  department?: string;
  bio?: string;
  completeOnboarding?: boolean;
}) {
  const session = await getSession();
  if (!session) return { success: false, error: 'Tidak terautentikasi.' };

  const name = payload.name.trim();
  if (!name || name.length < 2) return { success: false, error: 'Nama minimal 2 karakter.' };
  if (name.length > 80) return { success: false, error: 'Nama maksimal 80 karakter.' };

  const email = payload.email?.trim().toLowerCase();
  const username = payload.username?.trim().toLowerCase();

  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Format email tidak valid.' };
    }
  }

  if (username) {
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
      return { success: false, error: 'Username (3-30 karakter) hanya boleh berisi huruf, angka, (-), (_), dan (.).' };
    }
  }

  const isStaff = (session as any).userType === 'STAFF';
  const studentIdNumber = payload.student_id_number?.trim() || null;

  if (!isStaff && studentIdNumber) {
    if (!/^\d{8}$/.test(studentIdNumber)) {
      return { success: false, error: 'NIM harus berupa 8 digit angka.' };
    }
  }

  const db = await getDB();

  // Validate Email uniqueness if changed
  if (email && email !== session.email) {
    const existingEmail = await db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .bind(email, session.userId)
      .first();
    if (existingEmail) {
      return { success: false, error: 'Email tersebut sudah digunakan oleh pengguna lain.' };
    }
  }

  // Validate Username uniqueness if changed
  if (username) {
    const existingUsername = await db
      .prepare('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?')
      .bind(username, username, session.userId)
      .first();
    if (existingUsername) {
      return { success: false, error: 'Username tersebut sudah digunakan oleh pengguna lain.' };
    }
  }

  const normalizedAvatar = await normalizeAvatarUrl(payload.avatar_url);
  const normalizedWhatsapp = await normalizeWhatsappNumber(payload.whatsapp_number);
  const mainRolesJson = JSON.stringify(payload.main_roles || []);

  // For Staff, clear university, student_id_number, study_program, and semester
  const finalUniversity = isStaff ? null : (payload.university?.trim() || null);
  const finalStudentId = isStaff ? null : studentIdNumber;
  const finalStudyProgram = isStaff ? null : (payload.study_program?.trim() || null);
  const finalSemester = isStaff ? null : (payload.semester?.trim() || null);
  const finalMainRolesJson = mainRolesJson;
  const finalCustomRole = payload.custom_role?.trim() || null;
  const finalTools = payload.tools?.trim() || null;
  const finalPortfolioUrl = payload.portfolio_url?.trim() || null;

  if (payload.completeOnboarding) {
    await db
      .prepare(`
        UPDATE users SET
          name = ?,
          email = COALESCE(?, email),
          username = COALESCE(?, username),
          university = ?,
          student_id_number = ?,
          study_program = ?,
          semester = ?,
          whatsapp_number = ?,
          avatar_url = ?,
          main_roles = ?,
          custom_role = ?,
          tools = ?,
          portfolio_url = ?,
          department = ?,
          bio = ?,
          onboarding_completed = 1
        WHERE id = ?
      `)
      .bind(
        name,
        email || null,
        username || null,
        finalUniversity,
        finalStudentId,
        finalStudyProgram,
        finalSemester,
        normalizedWhatsapp,
        normalizedAvatar || null,
        finalMainRolesJson,
        finalCustomRole,
        finalTools,
        finalPortfolioUrl,
        payload.department?.trim() || null,
        payload.bio?.trim() || null,
        session.userId
      )
      .run();
  } else {
    await db
      .prepare(`
        UPDATE users SET
          name = ?,
          email = COALESCE(?, email),
          username = COALESCE(?, username),
          university = ?,
          study_program = ?,
          semester = ?,
          whatsapp_number = ?,
          avatar_url = ?,
          main_roles = ?,
          custom_role = ?,
          tools = ?,
          portfolio_url = ?,
          department = ?,
          bio = ?
        WHERE id = ?
      `)
      .bind(
        name,
        email || null,
        username || null,
        finalUniversity,
        finalStudyProgram,
        finalSemester,
        normalizedWhatsapp,
        normalizedAvatar || null,
        finalMainRolesJson,
        finalCustomRole,
        finalTools,
        finalPortfolioUrl,
        payload.department?.trim() || null,
        payload.bio?.trim() || null,
        session.userId
      )
      .run();
  }

  // Refresh KV session so email, avatar and name update instantly (only if not impersonating)
  if (!session.isImpersonating) {
    try {
      const kv = await getKV();
      const cookieStore = await cookies();
      const sessionId = cookieStore.get('session_id')?.value;
      if (sessionId) {
        const updated = {
          ...session,
          name,
          email: email || session.email,
          avatar: normalizedAvatar || session.avatar,
        };
        const ttlSeconds = Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000));
        await kv.put(`session:${sessionId}`, JSON.stringify(updated), { expirationTtl: ttlSeconds || 3600 });
      }
    } catch {
      // non-fatal
    }
  }

  revalidatePath('/dashboard');
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
