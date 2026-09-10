'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext, checkPermission } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';
import {
  DocumentTemplateItem,
  DocumentTemplateVersionItem,
  DocumentTypeItem,
} from './documentTypes';
import {
  DEFAULT_SURAT_TUGAS_LAYOUT,
  DEFAULT_SURAT_TUGAS_SCHEMA,
  DEFAULT_SURAT_TUGAS_VALUES,
} from './defaultTemplates';

/**
 * Ensures default Master Template ("Surat Tugas KIAN Troopers") exists on D1.
 */
export async function ensureDefaultSeedTemplates(): Promise<void> {
  const db = await getDB();
  try {
    const existing = await db
      .prepare("SELECT id FROM document_templates WHERE id = 'tpl_surat_tugas_troopers'")
      .first();

    if (!existing) {
      const nowSec = Math.floor(Date.now() / 1000);
      const templateId = 'tpl_surat_tugas_troopers';
      const versionId = 'tplv_surat_tugas_v1';

      // Insert template container
      await db
        .prepare(`
          INSERT INTO document_templates (
            id, type_id, name, description, status, current_version, created_by, updated_by, created_at, updated_at
          ) VALUES (?, 'doctype_surat_tugas', ?, ?, 'ACTIVE', 1, 'system', 'system', ?, ?)
        `)
        .bind(
          templateId,
          'Surat Tugas KIAN Troopers',
          'Template resmi Surat Tugas personil dan kru event KIAN Troopers dengan layout presisi A4 & lampiran otomatis.',
          nowSec,
          nowSec
        )
        .run();

      // Insert version 1
      await db
        .prepare(`
          INSERT INTO document_template_versions (
            id, template_id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
          ) VALUES (?, ?, 1, ?, ?, ?, ?, 'system', ?)
        `)
        .bind(
          versionId,
          templateId,
          JSON.stringify(DEFAULT_SURAT_TUGAS_LAYOUT),
          JSON.stringify(DEFAULT_SURAT_TUGAS_SCHEMA),
          JSON.stringify(DEFAULT_SURAT_TUGAS_VALUES),
          JSON.stringify(DEFAULT_SURAT_TUGAS_VALUES),
          nowSec
        )
        .run();
    }
  } catch (err) {
    console.error('ensureDefaultSeedTemplates error:', err);
  }
}

/**
 * Fetch all available Document Types
 */
export async function getDocumentTypes(): Promise<DocumentTypeItem[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare('SELECT * FROM document_types WHERE is_active = 1 ORDER BY created_at ASC')
      .all();
    return (results || []).map((r: any) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      numbering_format: r.numbering_format,
      icon: r.icon,
      is_active: Boolean(r.is_active),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (e) {
    console.error('getDocumentTypes failed:', e);
    return [];
  }
}

/**
 * Fetch all Document Templates with current version and author
 */
export async function getDocumentTemplates(): Promise<DocumentTemplateItem[]> {
  await ensureDefaultSeedTemplates();
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          dt.id, dt.type_id, dt.name, dt.description, dt.status, dt.current_version,
          dt.created_by, dt.updated_by, dt.created_at, dt.updated_at,
          dtype.code AS type_code, dtype.name AS type_name,
          u_cr.name AS created_by_name, u_up.name AS updated_by_name,
          dtv.layout_config, dtv.form_schema, dtv.default_values, dtv.sample_data
        FROM document_templates dt
        JOIN document_types dtype ON dt.type_id = dtype.id
        LEFT JOIN users u_cr ON dt.created_by = u_cr.id
        LEFT JOIN users u_up ON dt.updated_by = u_up.id
        LEFT JOIN document_template_versions dtv ON dt.id = dtv.template_id AND dt.current_version = dtv.version
        ORDER BY dt.updated_at DESC
      `)
      .all();

    return (results || []).map((r: any) => {
      let layout_config;
      let form_schema;
      let default_values;
      let sample_data;
      try { layout_config = r.layout_config ? JSON.parse(r.layout_config) : undefined; } catch {}
      try { form_schema = r.form_schema ? JSON.parse(r.form_schema) : undefined; } catch {}
      try { default_values = r.default_values ? JSON.parse(r.default_values) : undefined; } catch {}
      try { sample_data = r.sample_data ? JSON.parse(r.sample_data) : undefined; } catch {}

      return {
        id: r.id,
        type_id: r.type_id,
        type_code: r.type_code || 'SURAT_TUGAS',
        type_name: r.type_name || 'Surat Tugas',
        name: r.name,
        description: r.description,
        status: r.status,
        current_version: r.current_version,
        created_by: r.created_by,
        created_by_name: r.created_by_name || 'System / Admin',
        updated_by: r.updated_by,
        updated_by_name: r.updated_by_name || 'System / Admin',
        created_at: r.created_at,
        updated_at: r.updated_at,
        layout_config,
        form_schema,
        default_values,
        sample_data,
      };
    });
  } catch (err) {
    console.error('getDocumentTemplates failed:', err);
    return [];
  }
}

/**
 * Fetch a specific template with full version detail
 */
export async function getTemplateById(
  id: string,
  targetVersion?: number
): Promise<DocumentTemplateItem | null> {
  await ensureDefaultSeedTemplates();
  const db = await getDB();
  try {
    const row = await db
      .prepare(`
        SELECT 
          dt.id, dt.type_id, dt.name, dt.description, dt.status, dt.current_version,
          dt.created_by, dt.updated_by, dt.created_at, dt.updated_at,
          dtype.code AS type_code, dtype.name AS type_name,
          u_cr.name AS created_by_name, u_up.name AS updated_by_name
        FROM document_templates dt
        JOIN document_types dtype ON dt.type_id = dtype.id
        LEFT JOIN users u_cr ON dt.created_by = u_cr.id
        LEFT JOIN users u_up ON dt.updated_by = u_up.id
        WHERE dt.id = ?
      `)
      .bind(id)
      .first() as any;

    if (!row) return null;

    const versionToFetch = targetVersion || row.current_version;
    const versionRow = await db
      .prepare(`
        SELECT id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
        FROM document_template_versions
        WHERE template_id = ? AND version = ?
      `)
      .bind(id, versionToFetch)
      .first() as any;

    let layout_config = DEFAULT_SURAT_TUGAS_LAYOUT;
    let form_schema = DEFAULT_SURAT_TUGAS_SCHEMA;
    let default_values = DEFAULT_SURAT_TUGAS_VALUES;
    let sample_data = DEFAULT_SURAT_TUGAS_VALUES;

    if (versionRow) {
      try { if (versionRow.layout_config) layout_config = JSON.parse(versionRow.layout_config); } catch {}
      try { if (versionRow.form_schema) form_schema = JSON.parse(versionRow.form_schema); } catch {}
      try { if (versionRow.default_values) default_values = JSON.parse(versionRow.default_values); } catch {}
      try { if (versionRow.sample_data) sample_data = JSON.parse(versionRow.sample_data); } catch {}
    }

    return {
      id: row.id,
      type_id: row.type_id,
      type_code: row.type_code,
      type_name: row.type_name,
      name: row.name,
      description: row.description,
      status: row.status,
      current_version: row.current_version,
      created_by: row.created_by,
      created_by_name: row.created_by_name || 'System / Admin',
      updated_by: row.updated_by,
      updated_by_name: row.updated_by_name || 'System / Admin',
      created_at: row.created_at,
      updated_at: row.updated_at,
      layout_config,
      form_schema,
      default_values,
      sample_data,
    };
  } catch (err) {
    console.error('getTemplateById failed:', err);
    return null;
  }
}

/**
 * Fetch all versions history for a template
 */
export async function getTemplateVersions(templateId: string): Promise<DocumentTemplateVersionItem[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT id, template_id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
        FROM document_template_versions
        WHERE template_id = ?
        ORDER BY version DESC
      `)
      .bind(templateId)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      template_id: r.template_id,
      version: r.version,
      layout_config: JSON.parse(r.layout_config || '{}'),
      form_schema: JSON.parse(r.form_schema || '[]'),
      default_values: JSON.parse(r.default_values || '{}'),
      sample_data: r.sample_data ? JSON.parse(r.sample_data) : undefined,
      created_by: r.created_by,
      created_at: r.created_at,
    }));
  } catch (err) {
    console.error('getTemplateVersions failed:', err);
    return [];
  }
}

/**
 * Create a new Template (Version 1)
 */
export async function createTemplateAction(data: {
  name: string;
  type_id: string;
  description?: string;
  status?: 'DRAFT' | 'ACTIVE';
  layout_config: any;
  form_schema: any;
  default_values: any;
  sample_data?: any;
}): Promise<{ success: boolean; templateId?: string; error?: string }> {
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
    return { success: false, error: 'Anda tidak memiliki hak akses untuk membuat template.' };
  }

  if (!data.name?.trim()) {
    return { success: false, error: 'Nama template wajib diisi.' };
  }
  if (!data.type_id) {
    return { success: false, error: 'Tipe dokumen wajib dipilih.' };
  }

  const db = await getDB();
  const templateId = `tpl_${crypto.randomUUID().replace(/-/g, '')}`;
  const versionId = `tplv_${crypto.randomUUID().replace(/-/g, '')}`;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(`
        INSERT INTO document_templates (
          id, type_id, name, description, status, current_version, created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `)
      .bind(
        templateId,
        data.type_id,
        data.name.trim(),
        data.description || null,
        data.status || 'ACTIVE',
        session.userId,
        session.userId,
        nowSec,
        nowSec
      )
      .run();

    await db
      .prepare(`
        INSERT INTO document_template_versions (
          id, template_id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        versionId,
        templateId,
        JSON.stringify(data.layout_config || DEFAULT_SURAT_TUGAS_LAYOUT),
        JSON.stringify(data.form_schema || DEFAULT_SURAT_TUGAS_SCHEMA),
        JSON.stringify(data.default_values || DEFAULT_SURAT_TUGAS_VALUES),
        JSON.stringify(data.sample_data || data.default_values || DEFAULT_SURAT_TUGAS_VALUES),
        session.userId,
        nowSec
      )
      .run();

    await logWorkflowEvent({
      entityType: 'project',
      entityId: templateId,
      fromStatus: null,
      toStatus: data.status || 'ACTIVE',
      triggeredBy: session.userId,
      note: `Document template "${data.name}" created (v1)`,
    });

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    return { success: true, templateId };
  } catch (err: any) {
    console.error('createTemplateAction failed:', err);
    return { success: false, error: err.message || 'Gagal membuat template dokumen.' };
  }
}

/**
 * Non-destructive Save/Update Template with auto-versioning
 */
export async function updateTemplateAction(
  templateId: string,
  data: {
    name: string;
    description?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    layout_config: any;
    form_schema: any;
    default_values: any;
    sample_data?: any;
    forceNewVersion?: boolean;
  }
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
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
    return { success: false, error: 'Anda tidak memiliki hak akses untuk mengedit template.' };
  }

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const current = await db
      .prepare('SELECT id, current_version, status FROM document_templates WHERE id = ?')
      .bind(templateId)
      .first() as { id: string; current_version: number; status: string } | null;

    if (!current) {
      return { success: false, error: 'Template tidak ditemukan.' };
    }

    // Check if any generated documents already use this template version
    const docUsage = await db
      .prepare('SELECT 1 FROM generated_documents WHERE template_id = ? LIMIT 1')
      .bind(templateId)
      .first();

    const isLocked = Boolean(docUsage) || data.forceNewVersion !== false;
    const nextVersion = isLocked ? current.current_version + 1 : current.current_version;

    if (isLocked) {
      // Create new version snapshot (Immutable history preserved)
      const versionId = `tplv_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(`
          INSERT INTO document_template_versions (
            id, template_id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          versionId,
          templateId,
          nextVersion,
          JSON.stringify(data.layout_config),
          JSON.stringify(data.form_schema),
          JSON.stringify(data.default_values),
          JSON.stringify(data.sample_data || data.default_values),
          session.userId,
          nowSec
        )
        .run();
    } else {
      // Update existing version in-place (if never used yet)
      await db
        .prepare(`
          UPDATE document_template_versions
          SET layout_config = ?, form_schema = ?, default_values = ?, sample_data = ?
          WHERE template_id = ? AND version = ?
        `)
        .bind(
          JSON.stringify(data.layout_config),
          JSON.stringify(data.form_schema),
          JSON.stringify(data.default_values),
          JSON.stringify(data.sample_data || data.default_values),
          templateId,
          current.current_version
        )
        .run();
    }

    // Update template header
    await db
      .prepare(`
        UPDATE document_templates
        SET name = ?, description = ?, status = COALESCE(?, status), current_version = ?, updated_by = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        data.name.trim(),
        data.description || null,
        data.status || null,
        nextVersion,
        session.userId,
        nowSec,
        templateId
      )
      .run();

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    revalidatePath(`/dashboard/documents/templates/${templateId}/edit`);

    return { success: true, newVersion: nextVersion };
  } catch (err: any) {
    console.error('updateTemplateAction failed:', err);
    return { success: false, error: err.message || 'Gagal menyimpan perubahan template.' };
  }
}

/**
 * Duplicate Template to a new independent template
 */
export async function duplicateTemplateAction(
  sourceTemplateId: string,
  newTitle?: string
): Promise<{ success: boolean; newTemplateId?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const source = await getTemplateById(sourceTemplateId);
  if (!source) return { success: false, error: 'Template sumber tidak ditemukan.' };

  const targetName = newTitle?.trim() || `${source.name} (Copy)`;
  return createTemplateAction({
    name: targetName,
    type_id: source.type_id,
    description: source.description ? `Salinan dari ${source.name}. ${source.description}` : `Salinan dari ${source.name}`,
    status: 'ACTIVE',
    layout_config: source.layout_config,
    form_schema: source.form_schema,
    default_values: source.default_values,
    sample_data: source.sample_data,
  });
}

/**
 * Toggle Template Status (ACTIVE / ARCHIVED / DRAFT)
 */
export async function setTemplateStatusAction(
  templateId: string,
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  try {
    await db
      .prepare('UPDATE document_templates SET status = ?, updated_by = ?, updated_at = strftime("%s", "now") WHERE id = ?')
      .bind(status, session.userId, templateId)
      .run();

    revalidatePath('/dashboard/documents');
    revalidatePath('/dashboard/documents/templates');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
