'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import {
  getGoogleDriveAccessToken,
  uploadFileToDrive,
  createDriveFolder,
  testGoogleDriveCredentials,
} from './gdrive';

export interface StorageSettings {
  gdrive_enabled: boolean;
  gdrive_client_email: string;
  gdrive_private_key: string;
  gdrive_root_folder_id: string;
  gdrive_avatars_folder_id: string;
  is_configured: boolean;
}

/**
 * Fetch global Google Drive Storage Settings from system_settings
 */
export async function getStorageSettings(): Promise<StorageSettings> {
  const db = await getDB();
  const { results } = await db
    .prepare("SELECT key, value FROM system_settings WHERE key LIKE 'gdrive_%'")
    .all();

  const settingsMap: Record<string, string> = {};
  for (const row of (results as any[] || [])) {
    settingsMap[row.key] = row.value || '';
  }

  const enabled = settingsMap['gdrive_enabled'] === 'true';
  const clientEmail = settingsMap['gdrive_client_email'] || '';
  const privateKey = settingsMap['gdrive_private_key'] || '';
  const rootFolderId = settingsMap['gdrive_root_folder_id'] || '';
  const avatarsFolderId = settingsMap['gdrive_avatars_folder_id'] || '';

  const isConfigured = Boolean(clientEmail.trim() && privateKey.trim());

  return {
    gdrive_enabled: enabled,
    gdrive_client_email: clientEmail,
    gdrive_private_key: privateKey,
    gdrive_root_folder_id: rootFolderId,
    gdrive_avatars_folder_id: avatarsFolderId,
    is_configured: isConfigured,
  };
}

/**
 * Save Google Drive Storage Settings
 */
export async function updateStorageSettings(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const ctx = await getSessionContext(session.userId);
  const isCoordinator =
    (ctx.userType === 'STAFF' &&
      (ctx.roles.includes('COORDINATOR') ||
        ctx.roles.includes('EXECUTIVE') ||
        ctx.can('MANAGE') ||
        ctx.can('WORKSPACE_MANAGE'))) ||
    ctx.can('SPARKS_MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM');

  if (!isCoordinator) {
    return { success: false, error: 'Forbidden: Hanya Staff / Koordinator yang dapat mengelola Pengaturan Storage.' };
  }

  const enabled = formData.get('gdrive_enabled') === 'true' ? 'true' : 'false';
  const clientEmail = (formData.get('gdrive_client_email') as string)?.trim() || '';
  const privateKeyInput = (formData.get('gdrive_private_key') as string)?.trim() || '';
  const rootFolderId = (formData.get('gdrive_root_folder_id') as string)?.trim() || '';
  const avatarsFolderId = (formData.get('gdrive_avatars_folder_id') as string)?.trim() || '';

  const db = await getDB();
  const now = Math.floor(Date.now() / 1000);

  // Read current private key if omitted/placeholder
  let finalPrivateKey = privateKeyInput;
  if (privateKeyInput.includes('••••') || !privateKeyInput) {
    const existing = await db
      .prepare("SELECT value FROM system_settings WHERE key = 'gdrive_private_key'")
      .first() as { value: string } | null;
    if (existing?.value) finalPrivateKey = existing.value;
  }

  const updates = [
    { key: 'gdrive_enabled', value: enabled },
    { key: 'gdrive_client_email', value: clientEmail },
    { key: 'gdrive_private_key', value: finalPrivateKey },
    { key: 'gdrive_root_folder_id', value: rootFolderId },
    { key: 'gdrive_avatars_folder_id', value: avatarsFolderId },
  ];

  for (const item of updates) {
    await db
      .prepare(`
        INSERT INTO system_settings (key, value, updated_by, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
      `)
      .bind(item.key, item.value, session.userId, now)
      .run();
  }

  revalidatePath('/dashboard/settings/storage');
  revalidatePath('/dashboard/workspace');
  return { success: true };
}

/**
 * Test Google Drive credentials & connection
 */
export async function testStorageConnectionAction(overrideForm?: {
  client_email?: string;
  private_key?: string;
  root_folder_id?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const settings = await getStorageSettings();
  let clientEmail = overrideForm?.client_email || settings.gdrive_client_email;
  let privateKey = overrideForm?.private_key || settings.gdrive_private_key;
  let rootFolderId = overrideForm?.root_folder_id || settings.gdrive_root_folder_id;

  if (privateKey.includes('••••') || !privateKey) {
    privateKey = settings.gdrive_private_key;
  }

  if (!clientEmail || !privateKey) {
    return { success: false, message: 'Kredensial Service Account belum lengkap.' };
  }

  return await testGoogleDriveCredentials(clientEmail, privateKey, rootFolderId);
}

/**
 * Auto-create or resolve a Google Drive folder for a workspace
 */
export async function ensureWorkspaceDriveFolder(workspaceId: string, workspaceName?: string): Promise<string | null> {
  const db = await getDB();
  const ws = await db
    .prepare('SELECT id, name, gdrive_folder_id FROM workspaces WHERE id = ?')
    .bind(workspaceId)
    .first() as { id: string; name: string; gdrive_folder_id: string | null } | null;

  if (!ws) return null;

  if (ws.gdrive_folder_id && ws.gdrive_folder_id.trim()) {
    return ws.gdrive_folder_id.trim();
  }

  const settings = await getStorageSettings();
  if (!settings.gdrive_enabled || !settings.is_configured) {
    return null; // GDrive not enabled globally
  }

  try {
    const token = await getGoogleDriveAccessToken(settings.gdrive_client_email, settings.gdrive_private_key);
    const folderName = `Workspace - ${ws.name || workspaceName || workspaceId}`;
    const folder = await createDriveFolder(token, folderName, settings.gdrive_root_folder_id || undefined);

    await db
      .prepare('UPDATE workspaces SET gdrive_folder_id = ? WHERE id = ?')
      .bind(folder.id, workspaceId)
      .run();

    return folder.id;
  } catch (err) {
    console.error('[ensureWorkspaceDriveFolder] Error creating workspace folder:', err);
    return settings.gdrive_root_folder_id || null;
  }
}

/**
 * Upload a submission file to Google Drive and return the view link
 */
export async function uploadTaskSubmissionToDrive(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const file = formData.get('file') as File | null;
  const workspaceId = formData.get('workspaceId') as string | null;
  const taskTitle = (formData.get('taskTitle') as string) || 'Task Submission';

  if (!file || file.size === 0) {
    return { success: false, error: 'Pilih file terlebih dahulu.' };
  }

  const settings = await getStorageSettings();
  if (!settings.gdrive_enabled || !settings.is_configured) {
    return { success: false, error: 'Integrasi Google Drive belum diaktifkan oleh Koordinator.' };
  }

  try {
    const token = await getGoogleDriveAccessToken(settings.gdrive_client_email, settings.gdrive_private_key);

    // Resolve workspace folder
    let folderId = settings.gdrive_root_folder_id || undefined;
    if (workspaceId) {
      const resolvedFolder = await ensureWorkspaceDriveFolder(workspaceId);
      if (resolvedFolder) folderId = resolvedFolder;
    }

    const fileBuffer = await file.arrayBuffer();
    const cleanFileName = `${session.userId.slice(0, 6)}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const uploaded = await uploadFileToDrive(
      token,
      fileBuffer,
      cleanFileName,
      file.type || 'application/octet-stream',
      folderId
    );

    return {
      success: true,
      url: uploaded.webViewLink,
    };
  } catch (err: any) {
    console.error('uploadTaskSubmissionToDrive error:', err);
    return { success: false, error: err.message || 'Gagal mengunggah file ke Google Drive.' };
  }
}

/**
 * Upload a User Profile avatar photo to Google Drive
 */
export async function uploadProfileAvatarToDrive(formData: FormData): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { success: false, error: 'File foto profile wajib dipilih.' };
  }

  const settings = await getStorageSettings();
  if (!settings.gdrive_enabled || !settings.is_configured) {
    return { success: false, error: 'Integrasi Google Drive belum diaktifkan oleh Koordinator.' };
  }

  try {
    const token = await getGoogleDriveAccessToken(settings.gdrive_client_email, settings.gdrive_private_key);
    const parentFolder = settings.gdrive_avatars_folder_id || settings.gdrive_root_folder_id || undefined;

    const fileBuffer = await file.arrayBuffer();
    const fileName = `Avatar_${session.userId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const uploaded = await uploadFileToDrive(
      token,
      fileBuffer,
      fileName,
      file.type || 'image/jpeg',
      parentFolder
    );

    // Direct Google Drive image thumbnail link for <img> tag preview
    const directImageUrl = `https://lh3.googleusercontent.com/d/${uploaded.id}=w1000`;

    const db = await getDB();
    await db
      .prepare('UPDATE users SET avatar_url = ? WHERE id = ?')
      .bind(directImageUrl, session.userId)
      .run();

    revalidatePath('/dashboard/profile');
    revalidatePath('/dashboard');
    return {
      success: true,
      url: directImageUrl,
    };
  } catch (err: any) {
    console.error('uploadProfileAvatarToDrive error:', err);
    return { success: false, error: err.message || 'Gagal mengunggah foto profil ke Google Drive.' };
  }
}
