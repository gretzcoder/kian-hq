'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import {
  AvailabilityType,
  CreateAvailabilityPayload,
  DayAvailabilitySummary,
  DayOfWeekNumber,
  DAY_OF_WEEK_NAMES,
  SuratTugasDutyItem,
  UpdateAvailabilityPayload,
  UserAvailabilityItem,
  UserDateAvailabilityDetail,
  UserProfileSnapshot,
} from './availabilityTypes';

/**
 * Ensures table existence and index creation for user_availabilities.
 */
export async function ensureAvailabilityTables(): Promise<void> {
  const db = await getDB();
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_availabilities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        semester_label TEXT,
        course_code TEXT,
        course_name TEXT,
        class_code TEXT,
        campus_name TEXT,
        lecturer_code TEXT,
        lecturer_name TEXT,
        room TEXT,
        day_of_week INTEGER,
        specific_date TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        is_all_day INTEGER DEFAULT 0,
        location TEXT,
        notes TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_availabilities_user ON user_availabilities(user_id)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_availabilities_day ON user_availabilities(day_of_week)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_availabilities_date ON user_availabilities(specific_date)').run();
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_availabilities_sem ON user_availabilities(semester_label)').run();
  } catch (err) {
    console.error('ensureAvailabilityTables error:', err);
  }
}

/**
 * Parses Indonesian month name to 1-indexed number (1..12).
 */
function parseIndonesianMonth(monthStr: string): number | null {
  const m = monthStr.toLowerCase().trim();
  const months: Record<string, number> = {
    januari: 1, jan: 1, january: 1,
    februari: 2, feb: 2, february: 2,
    maret: 3, mar: 3, march: 3,
    april: 4, apr: 4,
    mei: 5, may: 5,
    juni: 6, jun: 6, june: 6,
    juli: 7, jul: 7, july: 7,
    agustus: 8, agu: 8, agt: 8, august: 8,
    september: 9, sep: 9, sept: 9,
    oktober: 10, okt: 10, oct: 10, october: 10,
    november: 11, nov: 11,
    desember: 12, des: 12, dec: 12, december: 12,
  };
  return months[m] || null;
}

/**
 * Checks if a target date (YYYY-MM-DD) falls within an event date string or range.
 */
function isDateMatchingEventDays(targetDateStr: string, eventDaysText: string): boolean {
  if (!eventDaysText || !targetDateStr) return false;

  // Direct ISO match
  if (eventDaysText.includes(targetDateStr)) return true;

  const [tYearStr, tMonthStr, tDayStr] = targetDateStr.split('-');
  const tYear = parseInt(tYearStr, 10);
  const tMonth = parseInt(tMonthStr, 10);
  const tDay = parseInt(tDayStr, 10);

  const cleanText = eventDaysText.replace(/[\n\r]/g, ' ').trim();

  // Pattern 1: e.g. "11 - 12 September 2026" or "Jum'at - Sabtu, 11 - 12 September 2026"
  const rangeMatch = cleanText.match(/(\d{1,2})\s*[-–s\/d]+\s*(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (rangeMatch) {
    const startDay = parseInt(rangeMatch[1], 10);
    const endDay = parseInt(rangeMatch[2], 10);
    const monthName = rangeMatch[3];
    const year = parseInt(rangeMatch[4], 10);
    const monthNum = parseIndonesianMonth(monthName);

    if (year === tYear && monthNum === tMonth && tDay >= startDay && tDay <= endDay) {
      return true;
    }
  }

  // Pattern 2: e.g. "12 September 2026" or "Sabtu, 12 September 2026"
  const singleDateMatch = cleanText.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (singleDateMatch) {
    const day = parseInt(singleDateMatch[1], 10);
    const monthName = singleDateMatch[2];
    const year = parseInt(singleDateMatch[3], 10);
    const monthNum = parseIndonesianMonth(monthName);

    if (year === tYear && monthNum === tMonth && tDay === day) {
      return true;
    }
  }

  // Pattern 3: e.g. "11 September 2026 - 15 September 2026"
  const fullRangeMatch = cleanText.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})\s*[-–s\/d]+\s*(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/i);
  if (fullRangeMatch) {
    const startDay = parseInt(fullRangeMatch[1], 10);
    const startMonth = parseIndonesianMonth(fullRangeMatch[2]);
    const startYear = parseInt(fullRangeMatch[3], 10);

    const endDay = parseInt(fullRangeMatch[4], 10);
    const endMonth = parseIndonesianMonth(fullRangeMatch[5]);
    const endYear = parseInt(fullRangeMatch[6], 10);

    if (startMonth && endMonth) {
      const targetTs = new Date(tYear, tMonth - 1, tDay).getTime();
      const startTs = new Date(startYear, startMonth - 1, startDay).getTime();
      const endTs = new Date(endYear, endMonth - 1, endDay).getTime();

      if (targetTs >= startTs && targetTs <= endTs) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fetch all active users with role and profile metadata.
 */
async function getAllActiveUsers(db: any): Promise<UserProfileSnapshot[]> {
  const { results } = await db.prepare(`
    SELECT 
      u.id, 
      u.name, 
      u.email, 
      u.avatar_url, 
      u.university, 
      u.study_program, 
      u.semester, 
      u.student_id_number, 
      u.user_type,
      u.whatsapp_number,
      (
        SELECT r.name 
        FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = u.id 
        LIMIT 1
      ) as role_name
    FROM users u
    WHERE u.status = 'ACTIVE'
    ORDER BY u.name ASC
  `).all();

  return (results || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarUrl: r.avatar_url || null,
    university: r.university || null,
    studyProgram: r.study_program || null,
    semester: r.semester || null,
    studentIdNumber: r.student_id_number || null,
    userType: r.user_type || null,
    roleName: r.role_name || (r.user_type === 'OJT' ? 'Trooper' : 'Staff'),
    whatsappNumber: r.whatsapp_number || null,
  }));
}

/**
 * Fetch all active Surat Tugas documents from database.
 */
async function getIssuedSuratTugasDocuments(db: any): Promise<any[]> {
  try {
    const { results } = await db.prepare(`
      SELECT 
        id, document_number, title, form_data, status, created_at
      FROM generated_documents
      WHERE type_code = 'SURAT_TUGAS'
        AND status IN ('ISSUED', 'GENERATED', 'SIGNED')
      ORDER BY created_at DESC
    `).all();
    return results || [];
  } catch (err) {
    console.warn('getIssuedSuratTugasDocuments warning:', err);
    return [];
  }
}

/**
 * Convert user_availabilities DB row into TypeScript object.
 */
function mapAvailabilityRow(r: any): UserAvailabilityItem {
  return {
    id: r.id,
    userId: r.user_id,
    type: r.type as AvailabilityType,
    title: r.title,
    semesterLabel: r.semester_label || null,
    courseCode: r.course_code || null,
    courseName: r.course_name || null,
    classCode: r.class_code || null,
    campusName: r.campus_name || null,
    lecturerCode: r.lecturer_code || null,
    lecturerName: r.lecturer_name || null,
    room: r.room || null,
    dayOfWeek: r.day_of_week as DayOfWeekNumber | null,
    specificDate: r.specific_date || null,
    startTime: r.start_time,
    endTime: r.end_time,
    isAllDay: r.is_all_day === 1,
    location: r.location || null,
    notes: r.notes || null,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Get all availability entries for a user (or session user).
 * Also returns active Surat Tugas duties assigned to this user.
 */
export async function getUserAvailabilitiesAction(targetUserId?: string): Promise<{
  schedules: UserAvailabilityItem[];
  suratTugasDuties: SuratTugasDutyItem[];
}> {
  const session = await getSession();
  if (!session) return { schedules: [], suratTugasDuties: [] };

  const effectiveUserId = targetUserId || session.userId;
  await ensureAvailabilityTables();
  const db = await getDB();

  // 1. Get direct user availabilities
  const { results: rawSchedules } = await db.prepare(`
    SELECT * FROM user_availabilities
    WHERE user_id = ?
    ORDER BY type ASC, day_of_week ASC, start_time ASC
  `).bind(effectiveUserId).all();

  const schedules = (rawSchedules || []).map(mapAvailabilityRow);

  // 2. Resolve user's target info for matching in Surat Tugas
  const userRow = await db.prepare(`
    SELECT id, name, email, student_id_number FROM users WHERE id = ?
  `).bind(effectiveUserId).first() as any;

  const suratTugasDuties: SuratTugasDutyItem[] = [];

  if (userRow) {
    const rawDocs = await getIssuedSuratTugasDocuments(db);
    const userNameLower = (userRow.name || '').toLowerCase().trim();
    const userNip = (userRow.student_id_number || '').trim();

    for (const doc of rawDocs) {
      try {
        const formData = JSON.parse(doc.form_data || '{}');
        const assignees = Array.isArray(formData.assignees) ? formData.assignees : [];

        const matchedAssignee = assignees.find((a: any) => {
          if (a.userId && a.userId === userRow.id) return true;
          if (userNip && a.nip && a.nip.trim() === userNip) return true;
          if (a.name && a.name.toLowerCase().trim() === userNameLower) return true;
          return false;
        });

        if (matchedAssignee) {
          suratTugasDuties.push({
            documentId: doc.id,
            documentNumber: doc.document_number,
            title: doc.title,
            eventName: formData.event_name || doc.title,
            eventDays: formData.event_days || '',
            eventTime: formData.event_time || '08.00 WIB - Selesai',
            eventLocation: formData.event_location || '-',
            dutyRole: matchedAssignee.role || 'Petugas',
            userNip: matchedAssignee.nip || userNip,
            dateMatched: formData.event_days || '',
          });
        }
      } catch {
        // skip invalid json
      }
    }
  }

  return { schedules, suratTugasDuties };
}

/**
 * Creates a new availability record (Kuliah or Appointment).
 */
export async function createAvailabilityAction(payload: CreateAvailabilityPayload): Promise<{
  success: boolean;
  message?: string;
  item?: UserAvailabilityItem;
}> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Autentikasi diperlukan.' };

  await ensureAvailabilityTables();
  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);
  const id = `avail_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  let title = (payload.title || '').trim();
  if (payload.type === 'KULIAH') {
    const courseCode = (payload.courseCode || '').trim();
    const courseName = (payload.courseName || '').trim();
    if (!courseName) {
      return { success: false, message: 'Nama matakuliah wajib diisi.' };
    }
    title = courseCode ? `${courseCode} - ${courseName}` : courseName;
  } else {
    if (!title) {
      return { success: false, message: 'Judul kegiatan/appointment wajib diisi.' };
    }
  }

  const startTime = (payload.startTime || '08:00').trim();
  const endTime = (payload.endTime || '10:00').trim();
  const dayOfWeek = payload.type === 'KULIAH' ? (payload.dayOfWeek || 1) : null;
  const specificDate = payload.type === 'APPOINTMENT' ? (payload.specificDate || null) : null;

  try {
    await db.prepare(`
      INSERT INTO user_availabilities (
        id, user_id, type, title, semester_label, course_code, course_name,
        class_code, campus_name, lecturer_code, lecturer_name, room,
        day_of_week, specific_date, start_time, end_time, is_all_day,
        location, notes, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).bind(
      id,
      session.userId,
      payload.type,
      title,
      payload.semesterLabel || null,
      payload.courseCode || null,
      payload.courseName || null,
      payload.classCode || null,
      payload.campusName || null,
      payload.lecturerCode || null,
      payload.lecturerName || null,
      payload.room || null,
      dayOfWeek,
      specificDate,
      startTime,
      endTime,
      payload.isAllDay ? 1 : 0,
      payload.location || null,
      payload.notes || null,
      now,
      now
    ).run();

    revalidatePath('/dashboard/availability');

    return {
      success: true,
      message: 'Jadwal berhasil disimpan.',
      item: {
        id,
        userId: session.userId,
        type: payload.type,
        title,
        semesterLabel: payload.semesterLabel || null,
        courseCode: payload.courseCode || null,
        courseName: payload.courseName || null,
        classCode: payload.classCode || null,
        campusName: payload.campusName || null,
        lecturerCode: payload.lecturerCode || null,
        lecturerName: payload.lecturerName || null,
        room: payload.room || null,
        dayOfWeek: dayOfWeek as DayOfWeekNumber | null,
        specificDate,
        startTime,
        endTime,
        isAllDay: !!payload.isAllDay,
        location: payload.location || null,
        notes: payload.notes || null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    };
  } catch (err: any) {
    console.error('createAvailabilityAction error:', err);
    return { success: false, message: err?.message || 'Gagal menyimpan jadwal.' };
  }
}

/**
 * Updates an existing availability record.
 */
export async function updateAvailabilityAction(
  id: string,
  payload: UpdateAvailabilityPayload
): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Autentikasi diperlukan.' };

  await ensureAvailabilityTables();
  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  // Check ownership
  const existing = await db.prepare(`
    SELECT * FROM user_availabilities WHERE id = ?
  `).bind(id).first() as any;

  if (!existing) {
    return { success: false, message: 'Data jadwal tidak ditemukan.' };
  }

  const ctx = await getSessionContext(session.userId);
  const isOwner = existing.user_id === session.userId;
  const canManage = ctx.can('ADMIN_USERS') || ctx.permissions.has('ADMIN_SYSTEM');

  if (!isOwner && !canManage) {
    return { success: false, message: 'Anda tidak memiliki izin mengedit jadwal ini.' };
  }

  let title = existing.title;
  const itemType = payload.type || existing.type;

  if (itemType === 'KULIAH') {
    const courseCode = (payload.courseCode !== undefined ? payload.courseCode : existing.course_code || '').trim();
    const courseName = (payload.courseName !== undefined ? payload.courseName : existing.course_name || '').trim();
    if (courseName) {
      title = courseCode ? `${courseCode} - ${courseName}` : courseName;
    }
  } else if (payload.title) {
    title = payload.title.trim();
  }

  try {
    await db.prepare(`
      UPDATE user_availabilities SET
        title = ?,
        semester_label = COALESCE(?, semester_label),
        course_code = ?,
        course_name = ?,
        class_code = ?,
        campus_name = ?,
        lecturer_code = ?,
        lecturer_name = ?,
        room = ?,
        day_of_week = ?,
        specific_date = ?,
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time),
        is_all_day = COALESCE(?, is_all_day),
        location = ?,
        notes = ?,
        is_active = COALESCE(?, is_active),
        updated_at = ?
      WHERE id = ?
    `).bind(
      title,
      payload.semesterLabel,
      payload.courseCode !== undefined ? payload.courseCode : existing.course_code,
      payload.courseName !== undefined ? payload.courseName : existing.course_name,
      payload.classCode !== undefined ? payload.classCode : existing.class_code,
      payload.campusName !== undefined ? payload.campusName : existing.campus_name,
      payload.lecturerCode !== undefined ? payload.lecturerCode : existing.lecturer_code,
      payload.lecturerName !== undefined ? payload.lecturerName : existing.lecturer_name,
      payload.room !== undefined ? payload.room : existing.room,
      payload.dayOfWeek !== undefined ? payload.dayOfWeek : existing.day_of_week,
      payload.specificDate !== undefined ? payload.specificDate : existing.specific_date,
      payload.startTime,
      payload.endTime,
      payload.isAllDay !== undefined ? (payload.isAllDay ? 1 : 0) : existing.is_all_day,
      payload.location !== undefined ? payload.location : existing.location,
      payload.notes !== undefined ? payload.notes : existing.notes,
      payload.isActive !== undefined ? (payload.isActive ? 1 : 0) : existing.is_active,
      now,
      id
    ).run();

    revalidatePath('/dashboard/availability');
    return { success: true, message: 'Jadwal berhasil diperbarui.' };
  } catch (err: any) {
    console.error('updateAvailabilityAction error:', err);
    return { success: false, message: err?.message || 'Gagal memperbarui jadwal.' };
  }
}

/**
 * Deletes a single availability item.
 */
export async function deleteAvailabilityAction(id: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Autentikasi diperlukan.' };

  const db = await getDB();
  const existing = await db.prepare('SELECT user_id FROM user_availabilities WHERE id = ?').bind(id).first() as any;

  if (!existing) {
    return { success: false, message: 'Data tidak ditemukan.' };
  }

  const ctx = await getSessionContext(session.userId);
  const isOwner = existing.user_id === session.userId;
  const canManage = ctx.can('ADMIN_USERS') || ctx.permissions.has('ADMIN_SYSTEM');

  if (!isOwner && !canManage) {
    return { success: false, message: 'Anda tidak memiliki izin menghapus jadwal ini.' };
  }

  try {
    await db.prepare('DELETE FROM user_availabilities WHERE id = ?').bind(id).run();
    revalidatePath('/dashboard/availability');
    return { success: true, message: 'Jadwal berhasil dihapus.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Gagal menghapus jadwal.' };
  }
}

/**
 * Clears all college schedules (KULIAH) for user, allowing them to reset for a new semester.
 */
export async function clearUserSemesterSchedulesAction(
  semesterLabel?: string
): Promise<{ success: boolean; message?: string; count?: number }> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Autentikasi diperlukan.' };

  const db = await getDB();
  try {
    let query = `DELETE FROM user_availabilities WHERE user_id = ? AND type = 'KULIAH'`;
    const params: any[] = [session.userId];

    if (semesterLabel && semesterLabel.trim()) {
      query += ` AND semester_label = ?`;
      params.push(semesterLabel.trim());
    }

    const res = await db.prepare(query).bind(...params).run();
    revalidatePath('/dashboard/availability');

    return {
      success: true,
      message: 'Jadwal perkuliahan semester berhasil dibersihkan. Anda dapat menginput jadwal semester baru sekarang.',
      count: res.meta?.changes || 0,
    };
  } catch (err: any) {
    console.error('clearUserSemesterSchedulesAction error:', err);
    return { success: false, message: err?.message || 'Gagal membersihkan jadwal semester.' };
  }
}

/**
 * Toggles the active status of an availability item.
 */
export async function toggleAvailabilityStatusAction(
  id: string,
  isActive: boolean
): Promise<{ success: boolean }> {
  return updateAvailabilityAction(id, { isActive });
}

/**
 * Calculates monthly availability overview statistics for all days of a month.
 */
export async function getMonthlyAvailabilityOverviewAction(
  year: number,
  month: number // 1..12
): Promise<DayAvailabilitySummary[]> {
  await ensureAvailabilityTables();
  const db = await getDB();

  const [activeUsers, rawDocs, rawSchedules] = await Promise.all([
    getAllActiveUsers(db),
    getIssuedSuratTugasDocuments(db),
    db.prepare(`
      SELECT * FROM user_availabilities WHERE is_active = 1
    `).all().then((res: any) => (res.results || []).map(mapAvailabilityRow)),
  ]);

  const totalUsersCount = activeUsers.length;
  const daysInMonth = new Date(year, month, 0).getDate();
  const summaries: DayAvailabilitySummary[] = [];

  // Pre-parse Surat Tugas docs
  const parsedDocs = rawDocs.map((doc) => {
    try {
      const formData = JSON.parse(doc.form_data || '{}');
      return {
        id: doc.id,
        document_number: doc.document_number,
        title: doc.title,
        event_name: formData.event_name || doc.title,
        event_days: formData.event_days || '',
        event_time: formData.event_time || '',
        event_location: formData.event_location || '',
        assignees: Array.isArray(formData.assignees) ? formData.assignees : [],
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${year}-${monthStr}-${dayStr}`;

    const dateObj = new Date(year, month - 1, day);
    // JS getDay(): 0 = Minggu, 1 = Senin .. 6 = Sabtu.
    // Our convention: 1 = Senin .. 7 = Minggu
    const jsDay = dateObj.getDay();
    const dayOfWeek: DayOfWeekNumber = (jsDay === 0 ? 7 : jsDay) as DayOfWeekNumber;
    const dayName = DAY_OF_WEEK_NAMES[dayOfWeek]?.name || '';

    // 1. Resolve users who are BERTUGAS (Surat Tugas on this date)
    const bertugasUserIds = new Set<string>();
    for (const doc of parsedDocs) {
      if (!doc) continue;
      if (isDateMatchingEventDays(dateStr, doc.event_days)) {
        for (const user of activeUsers) {
          const userNameLower = (user.name || '').toLowerCase().trim();
          const userNip = (user.studentIdNumber || '').trim();

          const isAssigned = doc.assignees.some((a: any) => {
            if (a.userId && a.userId === user.id) return true;
            if (userNip && a.nip && a.nip.trim() === userNip) return true;
            if (a.name && a.name.toLowerCase().trim() === userNameLower) return true;
            return false;
          });

          if (isAssigned) {
            bertugasUserIds.add(user.id);
          }
        }
      }
    }

    // 2. Resolve users who are BERKEGIATAN (Kuliah on this dayOfWeek OR Appointment on this dateStr)
    const berkegiatanUserIds = new Set<string>();
    for (const item of rawSchedules) {
      if (bertugasUserIds.has(item.userId)) continue; // priority to Bertugas

      if (item.type === 'KULIAH' && item.dayOfWeek === dayOfWeek) {
        berkegiatanUserIds.add(item.userId);
      } else if (item.type === 'APPOINTMENT' && item.specificDate === dateStr) {
        berkegiatanUserIds.add(item.userId);
      }
    }

    const bertugasCount = bertugasUserIds.size;
    const berkegiatanCount = berkegiatanUserIds.size;
    const availCount = Math.max(0, totalUsersCount - bertugasCount - berkegiatanCount);

    summaries.push({
      dateStr,
      dayOfWeek,
      dayName,
      availCount,
      berkegiatanCount,
      bertugasCount,
      totalUsers: totalUsersCount,
    });
  }

  return summaries;
}

/**
 * Gets the categorized list of all users for a specific date (Avail, Berkegiatan, Bertugas).
 */
export async function getDateAvailabilityDetailsAction(
  dateStr: string // YYYY-MM-DD
): Promise<{
  dateStr: string;
  dayOfWeek: number;
  dayName: string;
  counts: { avail: number; berkegiatan: number; bertugas: number; total: number };
  users: UserDateAvailabilityDetail[];
}> {
  await ensureAvailabilityTables();
  const db = await getDB();

  const [tYearStr, tMonthStr, tDayStr] = dateStr.split('-');
  const dateObj = new Date(parseInt(tYearStr, 10), parseInt(tMonthStr, 10) - 1, parseInt(tDayStr, 10));
  const jsDay = dateObj.getDay();
  const dayOfWeek: DayOfWeekNumber = (jsDay === 0 ? 7 : jsDay) as DayOfWeekNumber;
  const dayName = DAY_OF_WEEK_NAMES[dayOfWeek]?.name || '';

  const [activeUsers, rawDocs, rawSchedules] = await Promise.all([
    getAllActiveUsers(db),
    getIssuedSuratTugasDocuments(db),
    db.prepare(`
      SELECT * FROM user_availabilities 
      WHERE is_active = 1 
        AND (
          (type = 'KULIAH' AND day_of_week = ?) 
          OR (type = 'APPOINTMENT' AND specific_date = ?)
        )
      ORDER BY start_time ASC
    `).bind(dayOfWeek, dateStr).all().then((res: any) => (res.results || []).map(mapAvailabilityRow)),
  ]);

  // Group schedules by user
  const schedulesByUser = new Map<string, { kuliah: UserAvailabilityItem[]; appointment: UserAvailabilityItem[] }>();
  for (const item of rawSchedules) {
    if (!schedulesByUser.has(item.userId)) {
      schedulesByUser.set(item.userId, { kuliah: [], appointment: [] });
    }
    const userBucket = schedulesByUser.get(item.userId)!;
    if (item.type === 'KULIAH') {
      userBucket.kuliah.push(item);
    } else {
      userBucket.appointment.push(item);
    }
  }

  // Parse Surat Tugas documents that match this date
  const matchingDocs: any[] = [];
  for (const doc of rawDocs) {
    try {
      const formData = JSON.parse(doc.form_data || '{}');
      if (isDateMatchingEventDays(dateStr, formData.event_days || '')) {
        matchingDocs.push({
          docId: doc.id,
          docNumber: doc.document_number,
          title: doc.title,
          eventName: formData.event_name || doc.title,
          eventDays: formData.event_days || '',
          eventTime: formData.event_time || '08.00 WIB - Selesai',
          eventLocation: formData.event_location || '-',
          assignees: Array.isArray(formData.assignees) ? formData.assignees : [],
        });
      }
    } catch {
      // skip
    }
  }

  const userDetails: UserDateAvailabilityDetail[] = [];
  let availCount = 0;
  let berkegiatanCount = 0;
  let bertugasCount = 0;

  for (const user of activeUsers) {
    const userSchedules = schedulesByUser.get(user.id) || { kuliah: [], appointment: [] };
    const userNameLower = (user.name || '').toLowerCase().trim();
    const userNip = (user.studentIdNumber || '').trim();

    // Check Surat Tugas assignment
    const userDuties: SuratTugasDutyItem[] = [];
    for (const mDoc of matchingDocs) {
      const matched = mDoc.assignees.find((a: any) => {
        if (a.userId && a.userId === user.id) return true;
        if (userNip && a.nip && a.nip.trim() === userNip) return true;
        if (a.name && a.name.toLowerCase().trim() === userNameLower) return true;
        return false;
      });

      if (matched) {
        userDuties.push({
          documentId: mDoc.docId,
          documentNumber: mDoc.docNumber,
          title: mDoc.title,
          eventName: mDoc.eventName,
          eventDays: mDoc.eventDays,
          eventTime: mDoc.eventTime,
          eventLocation: mDoc.eventLocation,
          dutyRole: matched.role || 'Petugas',
          userNip: matched.nip || userNip,
          dateMatched: dateStr,
        });
      }
    }

    // Determine status
    let status: 'AVAIL' | 'BERKEGIATAN' | 'BERTUGAS' = 'AVAIL';
    if (userDuties.length > 0) {
      status = 'BERTUGAS';
      bertugasCount++;
    } else if (userSchedules.kuliah.length > 0 || userSchedules.appointment.length > 0) {
      status = 'BERKEGIATAN';
      berkegiatanCount++;
    } else {
      status = 'AVAIL';
      availCount++;
    }

    userDetails.push({
      user,
      status,
      kuliahList: userSchedules.kuliah,
      appointmentList: userSchedules.appointment,
      suratTugasList: userDuties,
    });
  }

  // Sort: Bertugas first, Berkegiatan next, Avail last
  const priorityOrder = { BERTUGAS: 1, BERKEGIATAN: 2, AVAIL: 3 };
  userDetails.sort((a, b) => {
    const diff = priorityOrder[a.status] - priorityOrder[b.status];
    if (diff !== 0) return diff;
    return a.user.name.localeCompare(b.user.name);
  });

  return {
    dateStr,
    dayOfWeek,
    dayName,
    counts: {
      avail: availCount,
      berkegiatan: berkegiatanCount,
      bertugas: bertugasCount,
      total: activeUsers.length,
    },
    users: userDetails,
  };
}

/**
 * Gets the comprehensive weekly timetable matrix for all active users (Senin - Minggu).
 */
export async function getWeeklyTimetableMatrixAction(): Promise<{
  users: UserProfileSnapshot[];
  schedules: UserAvailabilityItem[];
}> {
  await ensureAvailabilityTables();
  const db = await getDB();

  const [activeUsers, rawSchedules] = await Promise.all([
    getAllActiveUsers(db),
    db.prepare(`
      SELECT * FROM user_availabilities 
      WHERE type = 'KULIAH' AND is_active = 1
      ORDER BY day_of_week ASC, start_time ASC
    `).all().then((res: any) => (res.results || []).map(mapAvailabilityRow)),
  ]);

  return {
    users: activeUsers,
    schedules: rawSchedules,
  };
}

/**
 * Resolves default academic values (Campus/University, Class Code, Semester)
 * based on user profile and previously saved schedule inputs.
 */
export async function getUserAcademicDefaultsAction(targetUserId?: string): Promise<{
  campusName: string;
  classCode: string;
  semesterLabel: string;
}> {
  const session = await getSession();
  if (!session) return { campusName: '', classCode: '', semesterLabel: 'Semester Ganjil 2026/2027' };

  const effectiveUserId = targetUserId || session.userId;
  await ensureAvailabilityTables();
  const db = await getDB();

  // 1. Fetch user profile
  const userRow = await db.prepare(`
    SELECT university, study_program, semester FROM users WHERE id = ?
  `).bind(effectiveUserId).first() as any;

  // 2. Fetch latest saved kuliah item
  const latestKuliah = await db.prepare(`
    SELECT campus_name, class_code, semester_label 
    FROM user_availabilities 
    WHERE user_id = ? AND type = 'KULIAH'
    ORDER BY created_at DESC 
    LIMIT 1
  `).bind(effectiveUserId).first() as any;

  const campusName = latestKuliah?.campus_name || userRow?.university || '';
  const classCode = latestKuliah?.class_code || '';
  const semesterLabel = latestKuliah?.semester_label || (userRow?.semester ? `Semester ${userRow.semester}` : 'Semester Ganjil 2026/2027');

  return {
    campusName,
    classCode,
    semesterLabel,
  };
}

/**
 * Gets all active users with their college course schedules aggregated for the Perkuliahan directory.
 */
export async function getAllUsersCourseSchedulesAction(): Promise<{
  usersWithCourses: {
    user: UserProfileSnapshot;
    totalCourses: number;
    daysCount: number;
    daysActive: number[];
    latestSemester: string | null;
    courses: UserAvailabilityItem[];
  }[];
}> {
  await ensureAvailabilityTables();
  const db = await getDB();

  const [activeUsers, rawSchedules] = await Promise.all([
    getAllActiveUsers(db),
    db.prepare(`
      SELECT * FROM user_availabilities 
      WHERE type = 'KULIAH' AND is_active = 1
      ORDER BY day_of_week ASC, start_time ASC
    `).all().then((res: any) => (res.results || []).map(mapAvailabilityRow)),
  ]);

  const coursesByUser = new Map<string, UserAvailabilityItem[]>();
  for (const s of rawSchedules) {
    if (!coursesByUser.has(s.userId)) {
      coursesByUser.set(s.userId, []);
    }
    coursesByUser.get(s.userId)!.push(s);
  }

  const usersWithCourses = activeUsers.map((user) => {
    const courses = coursesByUser.get(user.id) || [];
    const daysSet = new Set<number>();
    courses.forEach((c) => {
      if (c.dayOfWeek) daysSet.add(c.dayOfWeek);
    });

    const latestSemester = courses[0]?.semesterLabel || (user.semester ? `Semester ${user.semester}` : null);

    return {
      user,
      totalCourses: courses.length,
      daysCount: daysSet.size,
      daysActive: Array.from(daysSet).sort((a, b) => a - b),
      latestSemester,
      courses,
    };
  });

  // Sort: users with courses first (highest number of courses), then by name
  usersWithCourses.sort((a, b) => {
    if (a.totalCourses !== b.totalCourses) {
      return b.totalCourses - a.totalCourses;
    }
    return a.user.name.localeCompare(b.user.name);
  });

  return { usersWithCourses };
}

