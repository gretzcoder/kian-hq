'use server';

import { getDB } from '@/db/client';
import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import {
  CertificateItem,
  CertificateTemplate,
  CertificateUserOption,
  UserPerformanceMetrics,
} from './certificateTypes';

/**
 * Helper to generate random 6-character uppercase alphanumeric code
 */
function generateRandomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Checks if current logged in user has Coordinator / Admin management authority for certificates.
 */
export async function isCertificateAdmin(): Promise<{ authorized: boolean; userId?: string }> {
  const session = await getSession();
  if (!session) return { authorized: false };

  const ctx = await getSessionContext(session.userId);
  const authorized =
    ctx.userType === 'STAFF' ||
    ctx.can('MANAGE') ||
    ctx.can('WORKSPACE_MANAGE') ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.roles.some((r) => r.toUpperCase().includes('COORDINATOR')) ||
    ctx.roles.some((r) => r.toUpperCase().includes('EXECUTIVE')) ||
    ctx.roles.some((r) => r.toUpperCase().includes('MENTOR')) ||
    ctx.permissions.has('ADMIN_SYSTEM');

  return { authorized, userId: session.userId };
}

/**
 * Aggregates performance data & achievements snapshot for a given user.
 */
export async function getUserMetricsSummary(userId: string): Promise<UserPerformanceMetrics> {
  const db = await getDB();

  const [taskRes, sparksRes, badgesRes, wsRes] = await Promise.all([
    // Completed tasks count
    db
      .prepare(
        `SELECT COUNT(DISTINCT ta.id) as cnt
         FROM task_assignments ta
         JOIN tasks t ON ta.task_id = t.id
         WHERE ta.user_id = ? AND ta.status IN ('APPROVED', 'DONE', 'SUBMITTED')`
      )
      .bind(userId)
      .first<{ cnt: number }>(),

    // User calculated total sparks
    db
      .prepare(
        `SELECT (
           COALESCE((SELECT SUM(sparks) FROM task_assignments WHERE user_id = ? AND status = 'APPROVED'), 0) +
           COALESCE((SELECT SUM(sparks) FROM sparks_adjustments WHERE user_id = ?), 0)
         ) as total_sparks`
      )
      .bind(userId, userId)
      .first<{ total_sparks: number }>(),

    // Unlocked badges
    db
      .prepare(
        `SELECT b.name, b.icon_url
         FROM user_badges ub
         JOIN badges b ON ub.badge_id = b.id
         WHERE ub.user_id = ?
         ORDER BY ub.awarded_at DESC`
      )
      .bind(userId)
      .all<{ name: string; icon_url: string | null }>(),

    // Workspaces involved count
    db
      .prepare(
        `SELECT COUNT(DISTINCT workspace_id) as cnt
         FROM workspace_members
         WHERE user_id = ?`
      )
      .bind(userId)
      .first<{ cnt: number }>(),
  ]);

  const tasksCompleted = Number(taskRes?.cnt || 0);
  const sparksEarned = Number(sparksRes?.total_sparks || 0);
  const badgeList = (badgesRes?.results || []).map((b) => ({
    name: b.name,
    icon_url: b.icon_url,
  }));
  const badgesCount = badgeList.length;
  const projectCount = Number(wsRes?.cnt || 0);

  // Grade calculation algorithm based on system accomplishments
  let scoreGrade = 'A';
  if (tasksCompleted >= 30 || sparksEarned >= 1500 || badgesCount >= 8) {
    scoreGrade = 'S-TIER';
  } else if (tasksCompleted >= 15 || sparksEarned >= 750 || badgesCount >= 4) {
    scoreGrade = 'A+';
  } else if (tasksCompleted >= 5 || sparksEarned >= 200 || badgesCount >= 1) {
    scoreGrade = 'A';
  } else {
    scoreGrade = 'B+';
  }

  const summary = `Telah menuntaskan ${tasksCompleted} tugas proyek, mengumpulkan ${sparksEarned} Sparks, serta mengunci ${badgesCount} lencana prestasi di Kian HQ.`;

  return {
    tasks_completed: tasksCompleted,
    sparks_earned: sparksEarned,
    badges_count: badgesCount,
    badges_list: badgeList,
    project_count: projectCount,
    score_grade: scoreGrade,
    summary,
  };
}

/**
 * Retrieves certificate templates.
 */
export async function getCertificateTemplates(): Promise<CertificateTemplate[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(`SELECT * FROM certificate_templates ORDER BY created_at ASC`)
    .all<CertificateTemplate>();
  return results || [];
}

/**
 * Retrieves all user options for admin dropdown selector.
 */
export async function getCertificateUserOptions(): Promise<CertificateUserOption[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.avatar_url,
              (SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id LIMIT 1) as role
       FROM users u
       ORDER BY u.name ASC`
    )
    .all<CertificateUserOption>();
  return results || [];
}

/**
 * Fetches certificates list for current session context.
 * Standard users see only published certificates for themselves.
 * Admins/Coordinators see all certificates and can filter.
 */
export async function getCertificates(filter?: {
  targetUserId?: string;
  status?: string;
}): Promise<CertificateItem[]> {
  const session = await getSession();
  if (!session) return [];

  const { authorized } = await isCertificateAdmin();
  const db = await getDB();

  let query = `
    SELECT c.id as cert_id,
           c.user_id as user_id,
           c.template_id as template_id,
           c.certificate_code as certificate_code,
           c.title as cert_title,
           c.status as cert_status,
           c.issue_date as cert_issue_date,
           c.performance_metrics as cert_performance_metrics,
           c.issued_by as cert_issued_by,
           c.created_at as cert_created_at,
           c.updated_at as cert_updated_at,
           u.name as user_name,
           u.email as user_email,
           u.avatar_url as user_avatar,
           (SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id LIMIT 1) as user_role,
           t.name as template_name,
           t.layout_type as template_layout,
           t.background_color as t_bg,
           t.border_style as t_border,
           t.accent_color as t_accent,
           t.signatory_name as t_sig_name,
           t.signatory_title as t_sig_title,
           t.custom_subtext as t_subtext,
           issuer.name as issued_by_name
    FROM certificates c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN certificate_templates t ON c.template_id = t.id
    LEFT JOIN users issuer ON c.issued_by = issuer.id
  `;

  const params: any[] = [];
  const whereClauses: string[] = [];

  if (!authorized) {
    // Regular users can only see their own PUBLISHED certificates
    whereClauses.push(`c.user_id = ?`);
    params.push(session.userId);
    whereClauses.push(`c.status = 'PUBLISHED'`);
  } else {
    // Admin / Coordinator filters
    if (filter?.targetUserId) {
      whereClauses.push(`c.user_id = ?`);
      params.push(filter.targetUserId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      whereClauses.push(`c.status = ?`);
      params.push(filter.status);
    }
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ` + whereClauses.join(' AND ');
  }

  query += ` ORDER BY c.updated_at DESC`;

  const stmt = db.prepare(query);
  const boundStmt = params.length > 0 ? stmt.bind(...params) : stmt;
  const { results } = await boundStmt.all<any>();

  return (results || []).map((r) => {
    let metrics: UserPerformanceMetrics;
    try {
      metrics = typeof r.cert_performance_metrics === 'string' ? JSON.parse(r.cert_performance_metrics) : r.cert_performance_metrics;
    } catch {
      metrics = {
        tasks_completed: 0,
        sparks_earned: 0,
        badges_count: 0,
        badges_list: [],
        project_count: 0,
        score_grade: 'A',
        summary: 'Record data certificate Kian HQ',
      };
    }

    const template_data: CertificateTemplate = {
      id: r.template_id || 'tpl_classic_gold',
      name: r.template_name || 'Classic Gold Honor',
      description: null,
      layout_type: r.template_layout || 'CLASSIC',
      background_color: r.t_bg || '#0f172a',
      border_style: r.t_border || 'GOLD',
      accent_color: r.t_accent || '#f59e0b',
      signatory_name: r.t_sig_name || 'Kian HQ Management',
      signatory_title: r.t_sig_title || 'Program Coordinator',
      custom_subtext: r.t_subtext || 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi.',
      is_active: 1,
      created_at: 0,
      updated_at: 0,
    };

    return {
      id: r.cert_id,
      user_id: r.user_id,
      user_name: r.user_name || 'Anonymous User',
      user_email: r.user_email || '',
      user_avatar: r.user_avatar || null,
      user_role: r.user_role || 'Trooper',
      template_id: r.template_id,
      template_name: r.template_name || 'Classic Gold Honor',
      template_layout: r.template_layout || 'CLASSIC',
      template_data,
      certificate_code: r.certificate_code,
      title: r.cert_title || 'Certificate of Achievement',
      status: r.cert_status || 'DRAFT',
      issue_date: r.cert_issue_date,
      performance_metrics: metrics,
      issued_by: r.cert_issued_by,
      issued_by_name: r.issued_by_name || 'Coordinator',
      created_at: r.cert_created_at,
      updated_at: r.cert_updated_at,
    };
  });
}

/**
 * Fetches certificate by its unique code (used for Public Verification).
 */
export async function getCertificateByCode(certificateCode: string): Promise<CertificateItem | null> {
  if (!certificateCode) return null;
  const db = await getDB();

  const query = `
    SELECT c.id as cert_id,
           c.user_id as user_id,
           c.template_id as template_id,
           c.certificate_code as certificate_code,
           c.title as cert_title,
           c.status as cert_status,
           c.issue_date as cert_issue_date,
           c.performance_metrics as cert_performance_metrics,
           c.issued_by as cert_issued_by,
           c.created_at as cert_created_at,
           c.updated_at as cert_updated_at,
           u.name as user_name,
           u.email as user_email,
           u.avatar_url as user_avatar,
           (SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = u.id LIMIT 1) as user_role,
           t.name as template_name,
           t.layout_type as template_layout,
           t.background_color as t_bg,
           t.border_style as t_border,
           t.accent_color as t_accent,
           t.signatory_name as t_sig_name,
           t.signatory_title as t_sig_title,
           t.custom_subtext as t_subtext,
           issuer.name as issued_by_name
    FROM certificates c
    LEFT JOIN users u ON c.user_id = u.id
    LEFT JOIN certificate_templates t ON c.template_id = t.id
    LEFT JOIN users issuer ON c.issued_by = issuer.id
    WHERE c.certificate_code = ?
    LIMIT 1
  `;

  const row = await db.prepare(query).bind(certificateCode.toUpperCase().trim()).first<any>();
  if (!row) return null;

  let metrics: UserPerformanceMetrics;
  try {
    metrics = typeof row.cert_performance_metrics === 'string' ? JSON.parse(row.cert_performance_metrics) : row.cert_performance_metrics;
  } catch {
    metrics = {
      tasks_completed: 0,
      sparks_earned: 0,
      badges_count: 0,
      badges_list: [],
      project_count: 0,
      score_grade: 'A',
      summary: 'Verified Certificate Data',
    };
  }

  const template_data: CertificateTemplate = {
    id: row.template_id || 'tpl_classic_gold',
    name: row.template_name || 'Classic Gold Honor',
    description: null,
    layout_type: row.template_layout || 'CLASSIC',
    background_color: row.t_bg || '#0f172a',
    border_style: row.t_border || 'GOLD',
    accent_color: row.t_accent || '#f59e0b',
    signatory_name: row.t_sig_name || 'Kian HQ Management',
    signatory_title: row.t_sig_title || 'Program Coordinator',
    custom_subtext: row.t_subtext || 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi.',
    is_active: 1,
    created_at: 0,
    updated_at: 0,
  };

  return {
    id: row.cert_id,
    user_id: row.user_id,
    user_name: row.user_name || 'Anonymous User',
    user_email: row.user_email || '',
    user_avatar: row.user_avatar || null,
    user_role: row.user_role || 'Trooper',
    template_id: row.template_id,
    template_name: row.template_name || 'Classic Gold Honor',
    template_layout: row.template_layout || 'CLASSIC',
    template_data,
    certificate_code: row.certificate_code,
    title: row.cert_title || 'Certificate of Achievement',
    status: row.cert_status || 'DRAFT',
    issue_date: row.cert_issue_date,
    performance_metrics: metrics,
    issued_by: row.cert_issued_by,
    issued_by_name: row.issued_by_name || 'Coordinator',
    created_at: row.cert_created_at,
    updated_at: row.cert_updated_at,
  };
}

/**
 * Generates or updates a single user certificate.
 */
export async function generateCertificateForUser(
  targetUserId: string,
  templateId = 'tpl_classic_gold',
  status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'
): Promise<{ success: boolean; certificateCode?: string; error?: string }> {
  const { authorized, userId: adminUserId } = await isCertificateAdmin();
  if (!authorized || !adminUserId) {
    return { success: false, error: 'Unauthorized: Certificate manager access required.' };
  }

  const db = await getDB();
  const metrics = await getUserMetricsSummary(targetUserId);

  // Check if certificate already exists for this user
  const existing = await db
    .prepare(`SELECT id, certificate_code FROM certificates WHERE user_id = ?`)
    .bind(targetUserId)
    .first<{ id: string; certificate_code: string }>();

  const now = Math.floor(Date.now() / 1000);
  const currentYear = new Date().getFullYear();

  if (existing) {
    // Update existing certificate with refreshed performance metrics
    await db
      .prepare(
        `UPDATE certificates
         SET template_id = ?,
             performance_metrics = ?,
             status = ?,
             issued_by = ?,
             updated_at = ?
         WHERE id = ?`
      )
      .bind(templateId, JSON.stringify(metrics), status, adminUserId, now, existing.id);

    return { success: true, certificateCode: existing.certificate_code };
  } else {
    // Create new certificate with unique code
    const newId = `cert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const certCode = `KHQ-CERT-${currentYear}-${generateRandomCode()}`;

    await db
      .prepare(
        `INSERT INTO certificates (
          id, user_id, template_id, certificate_code, title, status, issue_date, performance_metrics, issued_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        newId,
        targetUserId,
        templateId,
        certCode,
        'Certificate of Achievement',
        status,
        now,
        JSON.stringify(metrics),
        adminUserId,
        now,
        now
      );

    return { success: true, certificateCode: certCode };
  }
}

/**
 * Bulk generates/refreshes certificates for all active users.
 */
export async function generateCertificatesForAllUsers(
  templateId = 'tpl_classic_gold',
  status: 'DRAFT' | 'PUBLISHED' = 'DRAFT'
): Promise<{ success: boolean; count: number; error?: string }> {
  const { authorized } = await isCertificateAdmin();
  if (!authorized) {
    return { success: false, count: 0, error: 'Unauthorized.' };
  }

  const db = await getDB();
  const { results: users } = await db.prepare(`SELECT id FROM users`).all<{ id: string }>();

  if (!users || users.length === 0) {
    return { success: true, count: 0 };
  }

  let generatedCount = 0;
  for (const u of users) {
    const res = await generateCertificateForUser(u.id, templateId, status);
    if (res.success) generatedCount++;
  }

  return { success: true, count: generatedCount };
}

/**
 * Toggles publish status of one or multiple certificates.
 */
export async function publishCertificates(
  certificateIds: string[],
  publish: boolean
): Promise<{ success: boolean; count: number; error?: string }> {
  const { authorized } = await isCertificateAdmin();
  if (!authorized) {
    return { success: false, count: 0, error: 'Unauthorized.' };
  }

  if (certificateIds.length === 0) return { success: true, count: 0 };

  const db = await getDB();
  const newStatus = publish ? 'PUBLISHED' : 'DRAFT';
  const now = Math.floor(Date.now() / 1000);

  let updatedCount = 0;
  for (const id of certificateIds) {
    await db
      .prepare(`UPDATE certificates SET status = ?, updated_at = ? WHERE id = ?`)
      .bind(newStatus, now, id);
    updatedCount++;
  }

  return { success: true, count: updatedCount };
}

/**
 * Saves / Updates a certificate template configuration.
 */
export async function saveCertificateTemplate(
  template: Partial<CertificateTemplate> & { id: string; name: string }
): Promise<{ success: boolean; error?: string }> {
  const { authorized } = await isCertificateAdmin();
  if (!authorized) {
    return { success: false, error: 'Unauthorized.' };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .prepare(`SELECT id FROM certificate_templates WHERE id = ?`)
    .bind(template.id)
    .first();

  if (existing) {
    await db
      .prepare(
        `UPDATE certificate_templates
         SET name = ?, description = ?, layout_type = ?, background_color = ?, border_style = ?, accent_color = ?, signatory_name = ?, signatory_title = ?, custom_subtext = ?, updated_at = ?
         WHERE id = ?`
      )
      .bind(
        template.name,
        template.description || null,
        template.layout_type || 'CLASSIC',
        template.background_color || '#0f172a',
        template.border_style || 'GOLD',
        template.accent_color || '#f59e0b',
        template.signatory_name || 'Kian HQ Management',
        template.signatory_title || 'Program Coordinator',
        template.custom_subtext || 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi.',
        now,
        template.id
      );
  } else {
    await db
      .prepare(
        `INSERT INTO certificate_templates (
          id, name, description, layout_type, background_color, border_style, accent_color, signatory_name, signatory_title, custom_subtext, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(
        template.id,
        template.name,
        template.description || null,
        template.layout_type || 'CLASSIC',
        template.background_color || '#0f172a',
        template.border_style || 'GOLD',
        template.accent_color || '#f59e0b',
        template.signatory_name || 'Kian HQ Management',
        template.signatory_title || 'Program Coordinator',
        template.custom_subtext || 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi.',
        now,
        now
      );
  }

  return { success: true };
}
