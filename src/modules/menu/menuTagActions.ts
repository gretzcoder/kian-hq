'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';

export interface MenuTagOption {
  id: string;
  label: string;
  category: 'UTAMA' | 'KOLABORASI' | 'FITUR & PENGELOLAAN' | 'SUB-MENU DETAIL' | 'PROJECTS & WORKSPACES';
  path: string;
  icon: string;
  isSubMenu?: boolean;
  parentLabel?: string;
  description?: string;
}

/**
 * Fetches all system menus, sub-menus, projects, and workspaces that the logged-in user has permission to access.
 */
export async function getAccessibleMenuOptions(): Promise<MenuTagOption[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);

  const isGlobalWorkspaceManager =
    ctx.userType === 'STAFF' || ctx.can('WORKSPACE_MANAGE') || ctx.can('MANAGE');
  const canReview = ctx.can('TASK_REVIEW');
  const canCreateBrief = ctx.can('CREATE_BRIEF') || ctx.can('BRIEF_CREATE') || ctx.userType === 'STAFF';
  const canUseAI = ctx.can('USE_AI');
  const isOJT = ctx.userType === 'OJT' && !ctx.roles.some((r) => r.toUpperCase().includes('MENTOR'));
  const canViewOJT = ctx.can('OJT_VIEW') || ctx.userType === 'STAFF' || ctx.can('MANAGE');
  const canManageUsers = ctx.can('ADMIN_USERS');
  const canManageRoles = ctx.can('ADMIN_ROLES');
  const canManageSparks = ctx.can('SPARKS_MANAGE') || ctx.can('MANAGE') || ctx.permissions.has('ADMIN_SYSTEM');

  const options: MenuTagOption[] = [
    // ── UTAMA ──
    { id: 'menu_dashboard', label: 'Dashboard', category: 'UTAMA', path: '/dashboard', icon: '🏠', description: 'Halaman utama dashboard ringkasan' },
    ...(!isOJT ? [{ id: 'menu_projects', label: 'Projects', category: 'UTAMA' as const, path: '/dashboard/projects', icon: '📁', description: 'Daftar semua proyek kampanye' }] : []),
    { id: 'menu_workspace', label: 'Workspace Console', category: 'UTAMA', path: '/dashboard/workspace', icon: '⚡', description: 'Ruang kerja tim dan rundown tugas' },
    { id: 'menu_leaderboard', label: 'Leaderboard', category: 'UTAMA', path: '/dashboard/leaderboard', icon: '🏆', description: 'Klasemen Sparks dan peringkat troopers' },
    { id: 'menu_achievements', label: 'Achievement History', category: 'UTAMA', path: '/dashboard/achievements', icon: '🏆', description: 'Riwayat pencapaian gelar juara & gelar keahlian seluruh anggota' },
    { id: 'menu_badges', label: 'Badge Gallery', category: 'UTAMA', path: '/dashboard/badges', icon: '🏅', description: 'Koleksi pencapaian lencana dan apresiasi' },

    // ── KOLABORASI ──
    { id: 'menu_community', label: 'Community Hub Chat', category: 'KOLABORASI', path: '/dashboard/community', icon: '💬', description: 'Saluran diskusi & Q&A komunitas' },
    { id: 'menu_messenger', label: 'Messenger & Kontak', category: 'KOLABORASI', path: '/dashboard/friends', icon: '💬', description: 'Pesan langsung & kontak anggota' },
    ...(canReview ? [{ id: 'menu_reviews', label: 'Review Queue', category: 'KOLABORASI' as const, path: '/dashboard/review', icon: '📋', description: 'Antrean peninjauan QC & pemberian Sparks' }] : []),
    ...(canCreateBrief ? [{ id: 'menu_briefs', label: 'Content Briefs', category: 'KOLABORASI' as const, path: '/dashboard/briefs', icon: '📄', description: 'Brief konten dan arahan produksi' }] : []),
    { id: 'menu_announcements', label: 'Announcements & Updates', category: 'KOLABORASI', path: '/dashboard/announcements', icon: '📢', description: 'Pengumuman resmi dan informasi penting' },
    { id: 'menu_kb', label: 'Knowledge Base', category: 'KOLABORASI', path: '/dashboard/kb', icon: '📚', description: 'Pusat panduan, aset brand, dan dokumentasi' },

    // ── FITUR & PENGELOLAAN ──
    ...(canUseAI ? [{ id: 'menu_ai', label: 'AI Assistant', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/ai', icon: '🤖', description: 'Asisten kecerdasan buatan KIAN' }] : []),
    ...(!isOJT ? [{ id: 'menu_analytics', label: 'Analytics Console', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/analytics', icon: '📊', description: 'Laporan performa dan statistik' }] : []),
    ...(canViewOJT ? [{ id: 'menu_ojt', label: 'OJT Directory', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/ojt', icon: '🎓', description: 'Direktori peserta OJT dan rekap nilai' }] : []),
    { id: 'menu_feedbacks', label: 'Kritik & Saran', category: 'FITUR & PENGELOLAAN', path: '/dashboard/feedbacks', icon: '💌', description: 'Kotak masukan dan umpan balik' },
    { id: 'menu_changelog', label: 'Log Update', category: 'FITUR & PENGELOLAAN', path: '/dashboard/changelog', icon: '📜', description: 'Catatan pembaruan fitur platform' },
    ...(canManageUsers ? [{ id: 'menu_users', label: 'Manajemen Users', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/users', icon: '👥', description: 'Kelola akun pengguna dan staf' }] : []),
    ...(canManageRoles ? [{ id: 'menu_permissions', label: 'Permissions & Roles', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/permissions', icon: '🔒', description: 'Pengaturan hak akses dan peran' }] : []),
    ...(canManageSparks ? [{ id: 'menu_sparks', label: 'Manajemen Sparks', category: 'FITUR & PENGELOLAAN' as const, path: '/dashboard/sparks', icon: '✨', description: 'Kelola pemberian dan audit Sparks' }] : []),

    // ── SUB-MENU DETAIL ──
    { id: 'submenu_sparks_history', label: 'Leaderboard > History Sparks', category: 'SUB-MENU DETAIL', path: '/dashboard/leaderboard?tab=history', icon: '⚡', isSubMenu: true, parentLabel: 'Leaderboard', description: 'Riwayat perolehan Sparks terkini' },
    ...(canCreateBrief ? [{ id: 'submenu_new_brief', label: 'Content Briefs > Buat Brief Baru', category: 'SUB-MENU DETAIL' as const, path: '/dashboard/briefs/new', icon: '➕', isSubMenu: true, parentLabel: 'Content Briefs', description: 'Formulir pembuatan brief baru' }] : []),
    { id: 'submenu_profile', label: 'Profile Saya', category: 'SUB-MENU DETAIL', path: '/dashboard/profile', icon: '👤', isSubMenu: true, parentLabel: 'Akun', description: 'Profil pengguna dan akun' },
    { id: 'submenu_settings_notif', label: 'Settings > Notifikasi', category: 'SUB-MENU DETAIL', path: '/dashboard/settings/notifications', icon: '⚙️', isSubMenu: true, parentLabel: 'Settings', description: 'Pengaturan preferensi notifikasi' },
  ];

  try {
    // Fetch user's accessible Workspaces
    const { results: rawWorkspaces } = await db
      .prepare(
        isGlobalWorkspaceManager
          ? `
            SELECT ws.id, ws.name, ws.workspace_type, p.name AS project_name
            FROM workspaces ws
            JOIN projects p ON ws.project_id = p.id
            WHERE ws.deleted_at IS NULL
            ORDER BY ws.name ASC
          `
          : `
            SELECT ws.id, ws.name, ws.workspace_type, p.name AS project_name
            FROM workspaces ws
            JOIN projects p ON ws.project_id = p.id
            WHERE (
                EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = ws.id AND user_id = ?)
                OR ws.ojt_coordinator_id = ?
                OR EXISTS (SELECT 1 FROM project_coordinators WHERE project_id = ws.project_id AND user_id = ?)
                OR ws.workspace_type = 'ASSESSMENT'
              )
              AND ws.deleted_at IS NULL
            ORDER BY ws.name ASC
          `
      )
      .bind(...(isGlobalWorkspaceManager ? [] : [session.userId, session.userId, session.userId]))
      .all();

    if (rawWorkspaces && rawWorkspaces.length > 0) {
      for (const ws of (rawWorkspaces as any[])) {
        options.push({
          id: `ws_${ws.id}`,
          label: `Workspace: ${ws.name}`,
          category: 'PROJECTS & WORKSPACES',
          path: `/dashboard/workspace/${ws.id}`,
          icon: ws.workspace_type === 'ASSESSMENT' ? '📝' : ws.workspace_type === 'MENTOR' ? '🎓' : '⚡',
          isSubMenu: true,
          parentLabel: ws.project_name || 'Workspace',
          description: `Langsung menuju ruang kerja ${ws.name}`,
        });
      }
    }

    // Fetch user's accessible Projects (non-OJT)
    if (!isOJT) {
      const { results: rawProjects } = await db
        .prepare(`
          SELECT p.id, p.name
          FROM projects p
          WHERE p.status != 'DELETED'
          ORDER BY p.name ASC
        `)
        .all();

      if (rawProjects && rawProjects.length > 0) {
        for (const p of (rawProjects as any[])) {
          options.push({
            id: `proj_${p.id}`,
            label: `Project: ${p.name}`,
            category: 'PROJECTS & WORKSPACES',
            path: `/dashboard/projects/${p.id}`,
            icon: '📁',
            isSubMenu: true,
            parentLabel: 'Projects',
            description: `Halaman detail proyek ${p.name}`,
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to fetch dynamic workspaces/projects for menu tagging:', err);
  }

  return options;
}
