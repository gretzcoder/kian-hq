'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext, checkPermission } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { logWorkflowEvent } from '@/modules/workflow/events';
import {
  GeneratedDocumentItem,
  OrganizationSnapshot,
} from './documentTypes';
import { getTemplateById } from './templateActions';
import {
  DEFAULT_ORGANIZATION_PROFILE,
} from './defaultTemplates';
import {
  formatDocumentNumber,
  getNextSequenceNumber,
} from './numberingEngine';

/**
 * Searches users from KIAN HQ database for quick assignee selection.
 */
export async function searchTroopersAction(query: string = ''): Promise<{
  id: string;
  name: string;
  nip: string;
  email: string;
  department: string | null;
  roleTitle: string;
}[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const searchPattern = `%${query.trim().toLowerCase()}%`;

  try {
    const { results } = await db
      .prepare(`
        SELECT 
          u.id, u.name, u.email, u.department, u.student_id_number, u.user_type,
          (
            SELECT r.name 
            FROM user_roles ur 
            JOIN roles r ON ur.role_id = r.id 
            WHERE ur.user_id = u.id 
            LIMIT 1
          ) AS role_name
        FROM users u
        WHERE u.status = 'ACTIVE'
          AND (
            LOWER(u.name) LIKE ?
            OR LOWER(u.email) LIKE ?
            OR LOWER(COALESCE(u.student_id_number, '')) LIKE ?
            OR LOWER(COALESCE(u.department, '')) LIKE ?
          )
        ORDER BY u.name ASC
        LIMIT 20
      `)
      .bind(searchPattern, searchPattern, searchPattern, searchPattern)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      nip: r.student_id_number || r.id.replace(/^usr_/, '').slice(0, 8),
      email: r.email,
      department: r.department || null,
      roleTitle: r.department || r.role_name || (r.user_type === 'OJT' ? 'Trooper' : 'Staff'),
    }));
  } catch (err) {
    console.error('searchTroopersAction error:', err);
    return [];
  }
}

/**
 * Searches projects/events from KIAN HQ database.
 */
export async function searchProjectsAction(query: string = ''): Promise<{
  id: string;
  name: string;
  description: string | null;
  status: string;
}[]> {
  const session = await getSession();
  if (!session) return [];

  const db = await getDB();
  const searchPattern = `%${query.trim().toLowerCase()}%`;

  try {
    const { results } = await db
      .prepare(`
        SELECT id, name, description, status
        FROM projects
        WHERE LOWER(name) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?
        ORDER BY created_at DESC
        LIMIT 15
      `)
      .bind(searchPattern, searchPattern)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
    }));
  } catch (err) {
    console.error('searchProjectsAction error:', err);
    return [];
  }
}

/**
 * Generates and saves a new document as an immutable snapshot.
 */
export async function generateDocumentAction(params: {
  template_id: string;
  form_data: Record<string, any>;
  custom_number?: string;
  signatory_id?: string;
}): Promise<{
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_CREATE') ||
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  if (!isAuthorized) {
    return { success: false, error: 'Anda tidak memiliki hak akses untuk menerbitkan dokumen resmi.' };
  }

  const template = await getTemplateById(params.template_id);
  if (!template) {
    return { success: false, error: 'Template dokumen tidak ditemukan.' };
  }

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);
  const docId = `doc_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    // 1. Resolve Document Type & Numbering
    const docTypeRow = await db
      .prepare('SELECT code, numbering_format FROM document_types WHERE id = ?')
      .bind(template.type_id)
      .first() as { code: string; numbering_format: string } | null;

    const typeCode = docTypeRow?.code || template.type_code || 'SURAT_TUGAS';
    const numberingFormat = docTypeRow?.numbering_format || '{sequence}/KIAN/TROOPERS/{roman_month}/{year}';

    let finalDocNumber = params.custom_number?.trim();
    if (!finalDocNumber) {
      const now = new Date();
      const seq = await getNextSequenceNumber(typeCode, now.getFullYear(), now.getMonth() + 1);
      finalDocNumber = formatDocumentNumber(numberingFormat, {
        sequenceNumber: seq,
        date: now,
        typeCode: typeCode,
        orgCode: 'TROOPERS',
      });
    }

    // 2. Resolve Signatory Snapshot
    let signatoryName = params.form_data.signatory_name || 'Mohamad Abi';
    let signatoryPosition = params.form_data.signatory_position || 'Program Director Kian Troopers';
    let signatureUrl: string | null = null;
    let stampUrl: string | null = null;

    if (params.signatory_id) {
      const sigRow = await db
        .prepare(`
          SELECT ds.name, ds.position, sa.asset_url AS signature_url, st.asset_url AS stamp_url
          FROM document_signatories ds
          LEFT JOIN document_assets sa ON ds.signature_asset_id = sa.id
          LEFT JOIN document_assets st ON ds.stamp_asset_id = st.id
          WHERE ds.id = ?
        `)
        .bind(params.signatory_id)
        .first() as any;

      if (sigRow) {
        signatoryName = sigRow.name;
        signatoryPosition = sigRow.position;
        signatureUrl = sigRow.signature_url;
        stampUrl = sigRow.stamp_url;
      }
    }

    // 3. Organization Profile Snapshot
    const orgSnapshot: OrganizationSnapshot = DEFAULT_ORGANIZATION_PROFILE;

    // 4. Compile Full Rendered Snapshot (Ensures 100% historical fidelity)
    const activeVersionId = `tplv_${template.id}_v${template.current_version}`;
    const compiledSnapshot = {
      layout_config: template.layout_config,
      organization: orgSnapshot,
      signatory: {
        name: signatoryName,
        position: signatoryPosition,
        signature_url: signatureUrl,
        stamp_url: stampUrl,
      },
      compiled_data: {
        ...params.form_data,
        document_number: finalDocNumber,
      },
      generated_at: nowSec,
    };

    const docTitle = params.form_data.document_title || template.name || 'Surat Tugas Resmi';

    // 5. Persist to generated_documents
    await db
      .prepare(`
        INSERT INTO generated_documents (
          id, template_id, template_version_id, type_code, document_number, title,
          form_data, rendered_snapshot, status, signatory_id, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'GENERATED', ?, ?, ?, ?)
      `)
      .bind(
        docId,
        template.id,
        activeVersionId,
        typeCode,
        finalDocNumber,
        docTitle,
        JSON.stringify(params.form_data),
        JSON.stringify(compiledSnapshot),
        params.signatory_id || null,
        session.userId,
        nowSec,
        nowSec
      )
      .run();

    // 6. Log Workflow Audit Event
    await logWorkflowEvent({
      entityType: 'project',
      entityId: docId,
      fromStatus: null,
      toStatus: 'GENERATED',
      triggeredBy: session.userId,
      note: `Document issued: ${finalDocNumber} ("${docTitle}")`,
    });

    revalidatePath('/dashboard/documents');
    return {
      success: true,
      documentId: docId,
      documentNumber: finalDocNumber,
    };
  } catch (err: any) {
    console.error('generateDocumentAction failed:', err);
    if (err.message?.includes('UNIQUE constraint') || err.message?.includes('document_number')) {
      return { success: false, error: 'Nomor dokumen ini sudah terdaftar. Silakan coba kembali untuk mendapatkan nomor otomatis baru.' };
    }
    return { success: false, error: err.message || 'Gagal menerbitkan dokumen.' };
  }
}

/**
 * Fetches all generated documents with pagination and creator name.
 */
export async function getGeneratedDocuments(filter?: {
  type_code?: string;
  limit?: number;
}): Promise<GeneratedDocumentItem[]> {
  const db = await getDB();
  const limit = filter?.limit || 50;
  const typeFilter = filter?.type_code ? 'WHERE gd.type_code = ?' : '';
  const params = filter?.type_code ? [filter.type_code, limit] : [limit];

  try {
    const { results } = await db
      .prepare(`
        SELECT 
          gd.id, gd.template_id, gd.template_version_id, gd.type_code,
          gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot,
          gd.status, gd.signatory_id, gd.created_by, gd.created_at, gd.updated_at,
          dt.name AS template_name, dt.current_version AS template_version,
          u.name AS created_by_name,
          ds.name AS signatory_name
        FROM generated_documents gd
        LEFT JOIN document_templates dt ON gd.template_id = dt.id
        LEFT JOIN users u ON gd.created_by = u.id
        LEFT JOIN document_signatories ds ON gd.signatory_id = ds.id
        ${typeFilter}
        ORDER BY gd.created_at DESC
        LIMIT ?
      `)
      .bind(...params)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      template_id: r.template_id,
      template_name: r.template_name || 'Custom Template',
      template_version_id: r.template_version_id,
      template_version: r.template_version || 1,
      type_code: r.type_code,
      document_number: r.document_number,
      title: r.title,
      form_data: JSON.parse(r.form_data || '{}'),
      rendered_snapshot: JSON.parse(r.rendered_snapshot || '{}'),
      status: r.status,
      signatory_id: r.signatory_id,
      signatory_name: r.signatory_name,
      created_by: r.created_by,
      created_by_name: r.created_by_name || 'Admin',
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('getGeneratedDocuments error:', err);
    return [];
  }
}

/**
 * Fetches a single generated document by ID for viewing/printing.
 */
export async function getGeneratedDocumentById(
  id: string
): Promise<GeneratedDocumentItem | null> {
  const db = await getDB();
  try {
    const r = await db
      .prepare(`
        SELECT 
          gd.id, gd.template_id, gd.template_version_id, gd.type_code,
          gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot,
          gd.status, gd.signatory_id, gd.created_by, gd.created_at, gd.updated_at,
          dt.name AS template_name, dt.current_version AS template_version,
          u.name AS created_by_name,
          ds.name AS signatory_name
        FROM generated_documents gd
        LEFT JOIN document_templates dt ON gd.template_id = dt.id
        LEFT JOIN users u ON gd.created_by = u.id
        LEFT JOIN document_signatories ds ON gd.signatory_id = ds.id
        WHERE gd.id = ?
      `)
      .bind(id)
      .first() as any;

    if (!r) return null;

    return {
      id: r.id,
      template_id: r.template_id,
      template_name: r.template_name || 'Custom Template',
      template_version_id: r.template_version_id,
      template_version: r.template_version || 1,
      type_code: r.type_code,
      document_number: r.document_number,
      title: r.title,
      form_data: JSON.parse(r.form_data || '{}'),
      rendered_snapshot: JSON.parse(r.rendered_snapshot || '{}'),
      status: r.status,
      signatory_id: r.signatory_id,
      signatory_name: r.signatory_name,
      created_by: r.created_by,
      created_by_name: r.created_by_name || 'Admin',
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  } catch (err) {
    console.error('getGeneratedDocumentById error:', err);
    return null;
  }
}

/**
 * Delete a generated document (Manager/Admin only)
 */
export async function deleteDocumentAction(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE');

  if (!isAuthorized) {
    return { success: false, error: 'Hanya Admin/Executive yang berhak menghapus arsip dokumen.' };
  }

  const db = await getDB();
  try {
    await db
      .prepare('DELETE FROM generated_documents WHERE id = ?')
      .bind(documentId)
      .run();

    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
