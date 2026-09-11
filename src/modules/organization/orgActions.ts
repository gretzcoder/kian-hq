'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext, checkPermission, clearPermissionsCache } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { OrgAuthoritiesConfig, OrgMemberItem, OrgNodeItem, OrgNodeType } from './orgTypes';

/**
 * Ensures table existence and seeds default KIAN Troopers organization tree if empty.
 */
export async function ensureOrgStructureSchema(): Promise<void> {
  const db = await getDB();
  try {
    // 1. Create tables if not exist
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS organization_nodes (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'DIVISION',
        description TEXT,
        color TEXT DEFAULT 'purple',
        icon TEXT DEFAULT '🏢',
        order_index INTEGER DEFAULT 0,
        authorities TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL REFERENCES organization_nodes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_title TEXT DEFAULT 'Member',
        is_lead INTEGER DEFAULT 0,
        assigned_at INTEGER NOT NULL,
        UNIQUE(node_id, user_id)
      )
    `).run();

    // 2. Check if default nodes exist
    const countRow = await db
      .prepare('SELECT COUNT(*) as cnt FROM organization_nodes')
      .first() as { cnt: number } | null;

    if (!countRow || countRow.cnt === 0) {
      const now = Math.floor(Date.now() / 1000);

      const defaultNodes = [
        {
          id: 'org_dir_program',
          parent_id: null,
          code: 'DIR_PROGRAM',
          name: 'Program Director / Executive Board',
          type: 'DIRECTORATE' as OrgNodeType,
          description: 'Pimpinan eksekutif dan pengarah utama program KIAN Troopers.',
          color: 'indigo',
          icon: '👑',
          order_index: 1,
          authorities: {
            can_review_tasks: true,
            review_scope: 'ALL',
            cross_workspace: true,
            prevent_self_review: true,
            can_manage_briefs: true,
            can_manage_documents: true,
            can_manage_sparks: true,
            can_view_all_workspaces: true,
            can_assign_tasks: true,
          } as OrgAuthoritiesConfig,
        },
        {
          id: 'org_div_creative',
          parent_id: 'org_dir_program',
          code: 'DIV_CREATIVE_DESIGN',
          name: 'Divisi Creative Design & Visual',
          type: 'DIVISION' as OrgNodeType,
          description: 'Divisi penanggung jawab standar estetika, UI/UX, grafis, dan Quality Control (QC) tugas desain.',
          color: 'purple',
          icon: '🎨',
          order_index: 2,
          authorities: {
            can_review_tasks: true,
            review_scope: 'MATCH_LABEL',
            review_labels: ['design', 'creative', 'visual', 'ui/ux', 'graphic', 'banner', 'logo'],
            cross_workspace: true,
            prevent_self_review: true,
            can_manage_briefs: true,
            can_view_all_workspaces: true,
          } as OrgAuthoritiesConfig,
        },
        {
          id: 'org_div_media',
          parent_id: 'org_dir_program',
          code: 'DIV_MEDIA_COMMUNICATION',
          name: 'Divisi Media, Video & Komunikasi',
          type: 'DIVISION' as OrgNodeType,
          description: 'Divisi publikasi, dokumentasi, video editing, dan komunikasi publik.',
          color: 'rose',
          icon: '🎬',
          order_index: 3,
          authorities: {
            can_review_tasks: true,
            review_scope: 'MATCH_LABEL',
            review_labels: ['video', 'editing', 'media', 'konten', 'podcast', 'broadcast'],
            cross_workspace: true,
            prevent_self_review: true,
            can_manage_briefs: true,
            can_view_all_workspaces: true,
          } as OrgAuthoritiesConfig,
        },
        {
          id: 'org_div_tech',
          parent_id: 'org_dir_program',
          code: 'DIV_TECH_IT',
          name: 'Divisi Teknologi & Web Development',
          type: 'DIVISION' as OrgNodeType,
          description: 'Divisi pengembangan sistem platform KIAN HQ, rekayasa software, dan infrastruktur.',
          color: 'cyan',
          icon: '💻',
          order_index: 4,
          authorities: {
            can_review_tasks: true,
            review_scope: 'MATCH_LABEL',
            review_labels: ['tech', 'code', 'web', 'dev', 'frontend', 'backend', 'bug'],
            cross_workspace: true,
            prevent_self_review: true,
            can_view_all_workspaces: true,
          } as OrgAuthoritiesConfig,
        },
        {
          id: 'org_div_operation',
          parent_id: 'org_dir_program',
          code: 'DIV_OPS_MANAGEMENT',
          name: 'Divisi Operasional & Manajemen Acara',
          type: 'DIVISION' as OrgNodeType,
          description: 'Divisi tata kelola kegiatan, logistik, penugasan surat resmi, dan kemitraan kampus.',
          color: 'amber',
          icon: '📋',
          order_index: 5,
          authorities: {
            can_manage_documents: true,
            can_manage_sparks: true,
            can_view_all_workspaces: true,
          } as OrgAuthoritiesConfig,
        },
      ];

      for (const node of defaultNodes) {
        await db.prepare(`
          INSERT INTO organization_nodes (
            id, parent_id, code, name, type, description, color, icon, order_index, authorities, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          node.id,
          node.parent_id,
          node.code,
          node.name,
          node.type,
          node.description,
          node.color,
          node.icon,
          node.order_index,
          JSON.stringify(node.authorities),
          now,
          now
        ).run();
      }
    }
  } catch (err) {
    console.error('ensureOrgStructureSchema error:', err);
  }
}

/**
 * Retrieves the full hierarchical tree of the organization.
 */
export async function getOrganizationTree(): Promise<OrgNodeItem[]> {
  await ensureOrgStructureSchema();
  const db = await getDB();

  try {
    const { results: rawNodes } = await db
      .prepare('SELECT * FROM organization_nodes ORDER BY order_index ASC, created_at ASC')
      .all();

    const { results: rawMembers } = await db
      .prepare(`
        SELECT 
          om.id, om.node_id, om.user_id, om.role_title, om.is_lead, om.assigned_at,
          u.name, u.email, u.avatar_url, u.user_type
        FROM organization_members om
        JOIN users u ON om.user_id = u.id
        WHERE u.status = 'ACTIVE'
        ORDER BY om.is_lead DESC, om.assigned_at ASC
      `)
      .all();

    const membersByNode = new Map<string, OrgMemberItem[]>();
    ((rawMembers as any[]) || []).forEach((m) => {
      if (!membersByNode.has(m.node_id)) {
        membersByNode.set(m.node_id, []);
      }
      membersByNode.get(m.node_id)!.push({
        id: m.id,
        user_id: m.user_id,
        name: m.name,
        email: m.email,
        avatar_url: m.avatar_url,
        user_type: m.user_type || 'STAFF',
        role_title: m.role_title || 'Member',
        is_lead: Boolean(m.is_lead),
        assigned_at: m.assigned_at,
      });
    });

    const parsedNodes: OrgNodeItem[] = ((rawNodes as any[]) || []).map((n) => {
      let auth: OrgAuthoritiesConfig = {};
      try {
        auth = JSON.parse(n.authorities || '{}');
      } catch (_e) {}

      return {
        id: n.id,
        parent_id: n.parent_id || null,
        code: n.code,
        name: n.name,
        type: n.type as OrgNodeType,
        description: n.description,
        color: n.color || 'purple',
        icon: n.icon || '🏢',
        order_index: n.order_index ?? 0,
        authorities: auth,
        created_at: n.created_at,
        updated_at: n.updated_at,
        members: membersByNode.get(n.id) || [],
        children: [],
      };
    });

    // Build hierarchy tree
    const nodeMap = new Map<string, OrgNodeItem>();
    parsedNodes.forEach((n) => nodeMap.set(n.id, n));

    const rootNodes: OrgNodeItem[] = [];
    parsedNodes.forEach((n) => {
      if (n.parent_id && nodeMap.has(n.parent_id)) {
        const parent = nodeMap.get(n.parent_id)!;
        if (!parent.children) parent.children = [];
        parent.children.push(n);
      } else {
        rootNodes.push(n);
      }
    });

    return rootNodes;
  } catch (err) {
    console.error('getOrganizationTree error:', err);
    return [];
  }
}

/**
 * Returns all organization nodes as a flat list.
 */
export async function getFlatOrgNodes(): Promise<OrgNodeItem[]> {
  await ensureOrgStructureSchema();
  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT * FROM organization_nodes ORDER BY order_index ASC, name ASC')
      .all();

    return ((results as any[]) || []).map((n) => {
      let auth: OrgAuthoritiesConfig = {};
      try {
        auth = JSON.parse(n.authorities || '{}');
      } catch (_e) {}
      return {
        id: n.id,
        parent_id: n.parent_id || null,
        code: n.code,
        name: n.name,
        type: n.type as OrgNodeType,
        description: n.description,
        color: n.color || 'purple',
        icon: n.icon || '🏢',
        order_index: n.order_index ?? 0,
        authorities: auth,
        created_at: n.created_at,
        updated_at: n.updated_at,
        members: [],
      };
    });
  } catch (err) {
    console.error('getFlatOrgNodes error:', err);
    return [];
  }
}

/**
 * Creates a new Organization Node (Division / Unit / Position).
 */
export async function createOrgNodeAction(payload: {
  parent_id?: string | null;
  code: string;
  name: string;
  type: OrgNodeType;
  description?: string;
  color?: string;
  icon?: string;
  order_index?: number;
  authorities: OrgAuthoritiesConfig;
}): Promise<{ success: boolean; error?: string; node?: OrgNodeItem }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!canManage) {
    return { success: false, error: 'Forbidden: Hanya Koordinator atau Admin yang dapat menambah struktur organisasi.' };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);
  const nodeId = `org_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanCode = (payload.code || payload.name).toUpperCase().replace(/[^A-Z0-9_]/g, '_');

  try {
    await db.prepare(`
      INSERT INTO organization_nodes (
        id, parent_id, code, name, type, description, color, icon, order_index, authorities, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      nodeId,
      payload.parent_id || null,
      cleanCode,
      payload.name.trim(),
      payload.type || 'DIVISION',
      payload.description?.trim() || null,
      payload.color || 'purple',
      payload.icon || '🏢',
      payload.order_index ?? 0,
      JSON.stringify(payload.authorities || {}),
      now,
      now
    ).run();

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('createOrgNodeAction error:', err);
    return { success: false, error: err.message || 'Gagal membuat struktur organisasi.' };
  }
}

/**
 * Updates an existing Organization Node.
 */
export async function updateOrgNodeAction(
  id: string,
  payload: {
    parent_id?: string | null;
    code?: string;
    name: string;
    type: OrgNodeType;
    description?: string;
    color?: string;
    icon?: string;
    order_index?: number;
    authorities: OrgAuthoritiesConfig;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!canManage) {
    return { success: false, error: 'Forbidden: Akses ditolak.' };
  }

  // Prevent setting parent_id to itself
  if (payload.parent_id === id) {
    return { success: false, error: 'Sebuah node tidak bisa menjadi parent bagi dirinya sendiri.' };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.prepare(`
      UPDATE organization_nodes
      SET 
        parent_id = ?,
        name = ?,
        type = ?,
        description = ?,
        color = ?,
        icon = ?,
        order_index = ?,
        authorities = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      payload.parent_id || null,
      payload.name.trim(),
      payload.type || 'DIVISION',
      payload.description?.trim() || null,
      payload.color || 'purple',
      payload.icon || '🏢',
      payload.order_index ?? 0,
      JSON.stringify(payload.authorities || {}),
      now,
      id
    ).run();

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('updateOrgNodeAction error:', err);
    return { success: false, error: err.message || 'Gagal memperbarui node organisasi.' };
  }
}

/**
 * Deletes an Organization Node safely.
 */
export async function deleteOrgNodeAction(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!canManage) {
    return { success: false, error: 'Forbidden: Akses ditolak.' };
  }

  const db = await getDB();
  try {
    // Get existing node parent
    const existing = await db
      .prepare('SELECT parent_id FROM organization_nodes WHERE id = ?')
      .bind(id)
      .first() as { parent_id: string | null } | null;

    // Reparent direct children so they aren't orphaned
    await db.prepare('UPDATE organization_nodes SET parent_id = ? WHERE parent_id = ?')
      .bind(existing?.parent_id || null, id)
      .run();

    // Delete node (cascade deletes members)
    await db.prepare('DELETE FROM organization_nodes WHERE id = ?').bind(id).run();

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('deleteOrgNodeAction error:', err);
    return { success: false, error: err.message || 'Gagal menghapus struktur organisasi.' };
  }
}

/**
 * Assigns or updates a member inside an Organization Node.
 */
export async function assignOrgMemberAction(
  nodeId: string,
  userId: string,
  roleTitle: string = 'Member',
  isLead: boolean = false
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!canManage) {
    return { success: false, error: 'Forbidden: Akses ditolak.' };
  }

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);
  const memberId = `om_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    // Upsert into organization_members
    await db.prepare(`
      INSERT INTO organization_members (id, node_id, user_id, role_title, is_lead, assigned_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(node_id, user_id) DO UPDATE SET
        role_title = excluded.role_title,
        is_lead = excluded.is_lead,
        assigned_at = excluded.assigned_at
    `).bind(
      memberId,
      nodeId,
      userId,
      roleTitle.trim() || 'Member',
      isLead ? 1 : 0,
      now
    ).run();

    await clearPermissionsCache(userId);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('assignOrgMemberAction error:', err);
    return { success: false, error: err.message || 'Gagal menetapkan personil ke struktur organisasi.' };
  }
}

/**
 * Removes a member from an Organization Node.
 */
export async function removeOrgMemberAction(
  nodeId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const canManage =
    ctx.can('ADMIN_USERS') ||
    ctx.can('ADMIN_ROLES') ||
    ctx.can('ADMIN_SYSTEM') ||
    ctx.roles.includes('COORDINATOR') ||
    ctx.roles.includes('EXECUTIVE');

  if (!canManage) {
    return { success: false, error: 'Forbidden: Akses ditolak.' };
  }

  const db = await getDB();
  try {
    await db.prepare('DELETE FROM organization_members WHERE node_id = ? AND user_id = ?')
      .bind(nodeId, userId)
      .run();

    await clearPermissionsCache(userId);

    revalidatePath('/dashboard/organization');
    revalidatePath('/dashboard/users');
    revalidatePath('/dashboard/review');
    return { success: true };
  } catch (err: any) {
    console.error('removeOrgMemberAction error:', err);
    return { success: false, error: err.message || 'Gagal menghapus personil dari divisi.' };
  }
}

/**
 * Retrieves all aggregated organization authorities for a given user across all assigned nodes.
 */
export async function getUserOrgAuthorities(userId: string): Promise<{
  canReviewTasks: boolean;
  reviewLabels: Set<string>;
  canReviewAllTasks: boolean;
  crossWorkspaceReview: boolean;
  preventSelfReview: boolean;
  canManageBriefs: boolean;
  canManageDocuments: boolean;
  canManageSparks: boolean;
  canViewAllWorkspaces: boolean;
  nodes: { id: string; name: string; roleTitle: string; isLead: boolean }[];
}> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          onode.id, onode.name, onode.authorities,
          om.role_title, om.is_lead
        FROM organization_members om
        JOIN organization_nodes onode ON om.node_id = onode.id
        WHERE om.user_id = ?
      `)
      .bind(userId)
      .all();

    let canReviewTasks = false;
    let canReviewAllTasks = false;
    let crossWorkspaceReview = false;
    let preventSelfReview = true;
    let canManageBriefs = false;
    let canManageDocuments = false;
    let canManageSparks = false;
    let canViewAllWorkspaces = false;
    const reviewLabels = new Set<string>();
    const nodes: { id: string; name: string; roleTitle: string; isLead: boolean }[] = [];

    ((results as any[]) || []).forEach((row) => {
      nodes.push({
        id: row.id,
        name: row.name,
        roleTitle: row.role_title || 'Member',
        isLead: Boolean(row.is_lead),
      });

      try {
        const auth: OrgAuthoritiesConfig = JSON.parse(row.authorities || '{}');
        if (auth.can_review_tasks) {
          canReviewTasks = true;
          if (auth.review_scope === 'ALL') {
            canReviewAllTasks = true;
          }
          if (Array.isArray(auth.review_labels)) {
            auth.review_labels.forEach((l) => reviewLabels.add(l.toLowerCase().trim()));
          }
          if (auth.cross_workspace) {
            crossWorkspaceReview = true;
          }
        }
        if (auth.prevent_self_review !== false) {
          preventSelfReview = true;
        }
        if (auth.can_manage_briefs) canManageBriefs = true;
        if (auth.can_manage_documents) canManageDocuments = true;
        if (auth.can_manage_sparks) canManageSparks = true;
        if (auth.can_view_all_workspaces) canViewAllWorkspaces = true;
      } catch (_e) {}
    });

    return {
      canReviewTasks,
      reviewLabels,
      canReviewAllTasks,
      crossWorkspaceReview,
      preventSelfReview,
      canManageBriefs,
      canManageDocuments,
      canManageSparks,
      canViewAllWorkspaces,
      nodes,
    };
  } catch (err) {
    console.error('getUserOrgAuthorities error:', err);
    return {
      canReviewTasks: false,
      reviewLabels: new Set(),
      canReviewAllTasks: false,
      crossWorkspaceReview: false,
      preventSelfReview: true,
      canManageBriefs: false,
      canManageDocuments: false,
      canManageSparks: false,
      canViewAllWorkspaces: false,
      nodes: [],
    };
  }
}

/**
 * Checks if a user has valid organization review authority for a given task.
 */
export async function checkOrgReviewAuthorityForTask(
  userId: string,
  task: {
    id: string;
    title?: string;
    task_type?: string | null;
    tags?: string | null;
    created_by?: string | null;
  },
  submitterId: string
): Promise<{ allowed: boolean; matchedLabel?: string; reason?: string }> {
  // Integrity check: NEVER allow self-review
  if (userId === submitterId) {
    return { allowed: false, reason: 'Forbidden: Tidak dapat menilai karya submit sendiri.' };
  }

  const orgAuth = await getUserOrgAuthorities(userId);
  if (!orgAuth.canReviewTasks) {
    return { allowed: false, reason: 'User tidak memiliki wewenang review organisasi.' };
  }

  if (orgAuth.canReviewAllTasks) {
    return { allowed: true, matchedLabel: 'ALL' };
  }

  // Check matching labels/keywords in task title, type, or tags
  const titleLower = (task.title || '').toLowerCase();
  const typeLower = (task.task_type || '').toLowerCase();
  const tagsLower = (task.tags || '').toLowerCase();

  for (const label of Array.from(orgAuth.reviewLabels)) {
    if (
      titleLower.includes(label) ||
      typeLower.includes(label) ||
      tagsLower.includes(label)
    ) {
      return { allowed: true, matchedLabel: label };
    }
  }

  return { allowed: false, reason: 'Tugas tidak sesuai dengan lingkup label/divisi Anda.' };
}

/**
 * Searches active users to assign into an organization node.
 */
export async function searchUsersForOrgAction(query: string = ''): Promise<{
  id: string;
  name: string;
  email: string;
  avatar_url?: string | null;
  user_type: string;
}[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const searchPattern = `%${query.trim().toLowerCase()}%`;

  try {
    const { results } = await db
      .prepare(`
        SELECT id, name, email, avatar_url, user_type
        FROM users
        WHERE status = 'ACTIVE'
          AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)
        ORDER BY name ASC
        LIMIT 25
      `)
      .bind(searchPattern, searchPattern)
      .all();

    return (results as any[]) || [];
  } catch (err) {
    console.error('searchUsersForOrgAction error:', err);
    return [];
  }
}
