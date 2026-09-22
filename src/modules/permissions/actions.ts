'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission, invalidateCacheForRole } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Grant a permission to a role.
 * Requires MANAGE permission.
 * Also invalidates KV permission cache for all users with that role.
 */
export async function grantRolePermission(roleId: string, permissionId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!roleId || !permissionId) {
    return { success: false, error: 'Role ID and Permission ID are required.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)')
      .bind(roleId, permissionId)
      .run();

    // Invalidate KV cache for all users in this role
    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    return { success: true };
  } catch (error: any) {
    console.error('grantRolePermission failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Revoke a permission from a role.
 * Requires MANAGE permission.
 * Also invalidates KV permission cache for all users with that role.
 */
export async function revokeRolePermission(roleId: string, permissionId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!roleId || !permissionId) {
    return { success: false, error: 'Role ID and Permission ID are required.' };
  }

  const db = await getDB();

  try {
    await db
      .prepare('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?')
      .bind(roleId, permissionId)
      .run();

    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    return { success: true };
  } catch (error: any) {
    console.error('revokeRolePermission failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create a new custom role.
 * Requires MANAGE permission.
 */
export async function createRoleAction(name: string, description: string, color?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!name?.trim()) {
    return { success: false, error: 'Role name is required.' };
  }

  const roleId = `role_${name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const db = await getDB();
  const roleColor = color?.trim() || '#8B5CF6';

  try {
    await db
      .prepare('INSERT INTO roles (id, name, description, color) VALUES (?, ?, ?, ?)')
      .bind(roleId, name.trim().toUpperCase(), description || null, roleColor)
      .run();

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint')) {
      return { success: false, error: 'A role with this name already exists.' };
    }
    console.error('createRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update an existing custom role's name, description, and color.
 * Requires MANAGE permission.
 */
export async function updateRoleAction(roleId: string, name: string, description: string, color?: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  if (!name?.trim()) {
    return { success: false, error: 'Role name is required.' };
  }

  const db = await getDB();
  const roleColor = color?.trim() || null;

  try {
    await db
      .prepare('UPDATE roles SET name = ?, description = ?, color = COALESCE(?, color) WHERE id = ?')
      .bind(name.trim().toUpperCase(), description || null, roleColor, roleId)
      .run();

    await invalidateCacheForRole(roleId);

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    console.error('updateRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a custom role.
 * Requires MANAGE permission.
 */
export async function deleteRoleAction(roleId: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await checkPermission(session.userId, 'ADMIN_ROLES');

  const protectedRoles = [
    'role_executive',
    'role_coordinator',
    'role_creator',
    'role_collaborator',
    'role_mentor_troopers',
    'role_troopers',
  ];
  if (protectedRoles.includes(roleId)) {
    return { success: false, error: 'Protected system roles cannot be deleted.' };
  }

  const db = await getDB();

  try {
    // 1. Delete associated role permissions
    await db.prepare('DELETE FROM role_permissions WHERE role_id = ?').bind(roleId).run();
    // 2. Delete user role assignments
    await db.prepare('DELETE FROM user_roles WHERE role_id = ?').bind(roleId).run();
    // 3. Delete the role itself
    await db.prepare('DELETE FROM roles WHERE id = ?').bind(roleId).run();

    revalidatePath('/dashboard/permissions');
    revalidatePath('/dashboard/users');
    return { success: true };
  } catch (error: any) {
    console.error('deleteRoleAction failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ensures all standard system permissions exist in database table.
 */
export async function ensureSystemPermissions(): Promise<void> {
  const db = await getDB();
  const systemPerms = [
    { id: 'perm_admin_system', name: 'ADMIN_SYSTEM', desc: 'Superadmin platform access' },
    { id: 'perm_admin_users', name: 'ADMIN_USERS', desc: 'Manage user registrations, status, roles, and types' },
    { id: 'perm_admin_roles', name: 'ADMIN_ROLES', desc: 'Manage system roles and permission matrix mappings' },
    { id: 'perm_view_ojt', name: 'VIEW_OJT_DATA', desc: 'Akses melihat direktori data OJT & Troopers' },
    { id: 'perm_view_as_role', name: 'VIEW_AS_ROLE', desc: 'Simulate server view as any chosen role' },
    { id: 'perm_project_create', name: 'PROJECT_CREATE', desc: 'Create new projects and campaign briefs' },
    { id: 'perm_project_manage', name: 'PROJECT_MANAGE', desc: 'Edit metadata, status, publish, or archive projects' },
    { id: 'perm_workspace_manage', name: 'WORKSPACE_MANAGE', desc: 'Create and update campaign workspaces' },
    { id: 'perm_workspace_member', name: 'WORKSPACE_MEMBER', desc: 'Manage team members inside workspaces' },
    { id: 'perm_task_create', name: 'TASK_CREATE', desc: 'Create tasks inside campaign workspaces' },
    { id: 'perm_task_assign', name: 'TASK_ASSIGN', desc: 'Assign team members/PICs to tasks' },
    { id: 'perm_task_review', name: 'TASK_REVIEW', desc: 'Review, approve, or request revisions on task submissions' },
    { id: 'perm_task_execute', name: 'TASK_EXECUTE', desc: 'Submit work results and update progress on assigned tasks' },
    { id: 'perm_brief_create', name: 'BRIEF_CREATE', desc: 'Buat pengajuan brief konten kampanye baru' },
    { id: 'perm_brief_review', name: 'BRIEF_REVIEW', desc: 'Submit, approve, or request changes on campaign briefs' },
    { id: 'perm_kb_manage', name: 'KB_MANAGE', desc: 'Create, update, and manage Knowledge Base items' },
    { id: 'perm_announcement_post', name: 'ANNOUNCEMENT_POST', desc: 'Create and publish team announcements' },
    { id: 'perm_content_bank_manage', name: 'CONTENT_BANK_MANAGE', desc: 'Kelola aset, template desain, dan repositori berkas bank konten' },
    { id: 'perm_availability_manage', name: 'AVAILABILITY_MANAGE', desc: 'Kelola pengaturan ketersediaan, pengecualian personil/role, dan alokasi penugasan tim' },
    { id: 'perm_availability_view', name: 'AVAILABILITY_VIEW', desc: 'Akses melihat direktori ketersediaan, kalender, dan jadwal kuliah seluruh tim' },
    { id: 'perm_documents_manage', name: 'DOCUMENTS_MANAGE', desc: 'Kelola, buat, tanda tangani, dan terbitkan Surat Tugas resmi & dokumen organisasi' },
    { id: 'perm_certificates_manage', name: 'CERTIFICATES_MANAGE', desc: 'Kelola penerbitan, desain template, dan verifikasi sertifikat' },
    { id: 'perm_badges_manage', name: 'BADGES_MANAGE', desc: 'Kelola pembuatan, penyuntingan, dan penganugerahan lencana/badges personil' },
    { id: 'perm_organization_manage', name: 'ORGANIZATION_MANAGE', desc: 'Kelola struktur bagan organisasi, divisi, dan pemetaan otoritas node' },
    { id: 'perm_feedback_manage', name: 'FEEDBACK_MANAGE', desc: 'Melihat, mengelola, dan menanggapi masukan & feedback pengguna' },
    { id: 'perm_sparks_manage', name: 'SPARKS_MANAGE', desc: 'Kelola Sparks, reset Sparks pengguna, dan berikan/kembalikan Sparks apresiasi' },
    { id: 'perm_use_ai', name: 'USE_AI', desc: 'Access AI recommendation engine and insights' },
    { id: 'perm_export_data', name: 'EXPORT_DATA', desc: 'Access and export analytics reports or Excel recaps' },
  ];

  try {
    for (const p of systemPerms) {
      await db.prepare('INSERT OR IGNORE INTO permissions (id, name, description) VALUES (?, ?, ?)')
        .bind(p.id, p.name, p.desc)
        .run();
    }
  } catch (err) {
    console.error('ensureSystemPermissions error:', err);
  }
}


