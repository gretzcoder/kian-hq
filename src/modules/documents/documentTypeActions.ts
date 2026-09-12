'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { DocumentTypeItem } from './documentTypes';

/**
 * Fetch all Document Types (optionally include inactive ones)
 */
export async function getDocumentTypesAction(
  includeInactive: boolean = false
): Promise<DocumentTypeItem[]> {
  const db = await getDB();
  try {
    const query = includeInactive
      ? 'SELECT * FROM document_types ORDER BY created_at ASC'
      : 'SELECT * FROM document_types WHERE is_active = 1 ORDER BY created_at ASC';

    const { results } = await db.prepare(query).all();
    return (results || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      numbering_format: r.numbering_format,
      icon: r.icon || '📄',
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('getDocumentTypesAction error:', err);
    return [];
  }
}

/**
 * Create a new Document Type
 */
export async function createDocumentTypeAction(data: {
  name: string;
  code: string;
  numbering_format?: string;
  description?: string;
  icon?: string;
  is_active?: boolean;
}): Promise<{ success: boolean; item?: DocumentTypeItem; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!isAuthorized) {
    return { success: false, error: 'Anda tidak memiliki hak akses untuk menambah jenis dokumen.' };
  }

  const name = data.name?.trim();
  const code = data.code?.trim().toUpperCase().replace(/\s+/g, '_');

  if (!name) return { success: false, error: 'Nama jenis dokumen wajib diisi.' };
  if (!code) return { success: false, error: 'Kode jenis dokumen wajib diisi.' };

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);
  const id = `doctype_${code.toLowerCase()}_${Date.now().toString(36)}`;
  const numberingFormat =
    data.numbering_format?.trim() || '{sequence}/KIAN/TROOPERS/{roman_month}/{year}';
  const icon = data.icon?.trim() || '📄';
  const isActive = data.is_active !== false ? 1 : 0;

  try {
    // Check if code already exists
    const existing = await db
      .prepare('SELECT id FROM document_types WHERE code = ?')
      .bind(code)
      .first();

    if (existing) {
      return { success: false, error: `Kode jenis dokumen "${code}" sudah digunakan.` };
    }

    await db
      .prepare(`
        INSERT INTO document_types (
          id, code, name, description, numbering_format, icon, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        code,
        name,
        data.description?.trim() || null,
        numberingFormat,
        icon,
        isActive,
        nowSec,
        nowSec
      )
      .run();

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    revalidatePath('/dashboard/documents/create');

    const newItem: DocumentTypeItem = {
      id,
      code,
      name,
      description: data.description?.trim() || null,
      numbering_format: numberingFormat,
      icon,
      is_active: Boolean(isActive),
      created_at: nowSec,
      updated_at: nowSec,
    };

    return { success: true, item: newItem };
  } catch (err: any) {
    console.error('createDocumentTypeAction error:', err);
    return { success: false, error: err.message || 'Gagal membuat jenis dokumen.' };
  }
}

/**
 * Update an existing Document Type
 */
export async function updateDocumentTypeAction(
  id: string,
  data: {
    name: string;
    code?: string;
    numbering_format?: string;
    description?: string;
    icon?: string;
    is_active?: boolean;
  }
): Promise<{ success: boolean; item?: DocumentTypeItem; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!isAuthorized) {
    return { success: false, error: 'Anda tidak memiliki hak akses untuk mengedit jenis dokumen.' };
  }

  const name = data.name?.trim();
  if (!name) return { success: false, error: 'Nama jenis dokumen wajib diisi.' };

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const existing = await db
      .prepare('SELECT * FROM document_types WHERE id = ?')
      .bind(id)
      .first() as any;

    if (!existing) {
      return { success: false, error: 'Jenis dokumen tidak ditemukan.' };
    }

    const newCode = data.code
      ? data.code.trim().toUpperCase().replace(/\s+/g, '_')
      : existing.code;

    // Check code collision if code changed
    if (newCode !== existing.code) {
      const codeCheck = await db
        .prepare('SELECT id FROM document_types WHERE code = ? AND id != ?')
        .bind(newCode, id)
        .first();
      if (codeCheck) {
        return { success: false, error: `Kode jenis dokumen "${newCode}" sudah digunakan.` };
      }
    }

    const numberingFormat =
      data.numbering_format?.trim() || existing.numbering_format || '{sequence}/KIAN/TROOPERS/{roman_month}/{year}';
    const icon = data.icon?.trim() || existing.icon || '📄';
    const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : existing.is_active;
    const description = data.description !== undefined ? data.description.trim() || null : existing.description;

    await db
      .prepare(`
        UPDATE document_types
        SET name = ?, code = ?, numbering_format = ?, icon = ?, description = ?, is_active = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        name,
        newCode,
        numberingFormat,
        icon,
        description,
        isActive,
        nowSec,
        id
      )
      .run();

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    revalidatePath('/dashboard/documents/create');

    const updatedItem: DocumentTypeItem = {
      id,
      code: newCode,
      name,
      description,
      numbering_format: numberingFormat,
      icon,
      is_active: Boolean(isActive),
      created_at: existing.created_at,
      updated_at: nowSec,
    };

    return { success: true, item: updatedItem };
  } catch (err: any) {
    console.error('updateDocumentTypeAction error:', err);
    return { success: false, error: err.message || 'Gagal memperbarui jenis dokumen.' };
  }
}

/**
 * Delete a Document Type (or deactivate if templates exist)
 */
export async function deleteDocumentTypeAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!isAuthorized) {
    return { success: false, error: 'Anda tidak memiliki hak akses untuk menghapus jenis dokumen.' };
  }

  const db = await getDB();

  try {
    // Check if any template uses this type
    const { count } = (await db
      .prepare('SELECT COUNT(*) as count FROM document_templates WHERE type_id = ?')
      .bind(id)
      .first()) as { count: number };

    if (count > 0) {
      return {
        success: false,
        error: `Jenis dokumen ini tidak dapat dihapus karena sedang digunakan oleh ${count} template dokumen. Anda dapat menonaktifkannya sebagai alternatif.`,
      };
    }

    await db.prepare('DELETE FROM document_types WHERE id = ?').bind(id).run();

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    revalidatePath('/dashboard/documents/create');

    return { success: true };
  } catch (err: any) {
    console.error('deleteDocumentTypeAction error:', err);
    return { success: false, error: err.message || 'Gagal menghapus jenis dokumen.' };
  }
}
