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
  DEFAULT_SURAT_TUGAS_LAYOUT,
  DEFAULT_SURAT_TUGAS_SCHEMA,
  DEFAULT_SURAT_TUGAS_VALUES,
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
 * Mode:
 * - 'ISSUE': Directly issues document with official sequence number (Admin/Executive only)
 * - 'SUBMIT_APPROVAL': Saves document and submits for Admin approval (Non-Admin & Admin)
 * - 'DRAFT': Saves document as a private draft without sequence allocation
 */
export async function generateDocumentAction(params: {
  template_id: string;
  form_data: Record<string, any>;
  custom_number?: string;
  signatory_id?: string;
  mode?: 'ISSUE' | 'DRAFT' | 'SUBMIT_APPROVAL';
}): Promise<{
  success: boolean;
  documentId?: string;
  documentNumber?: string;
  status?: string;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isPrivileged =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  const requestedMode = params.mode || (isPrivileged ? 'ISSUE' : 'SUBMIT_APPROVAL');

  // Strict business rule: Only Admin/Executive can issue official numbers directly
  const finalMode = (!isPrivileged && requestedMode === 'ISSUE')
    ? 'SUBMIT_APPROVAL'
    : requestedMode;

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

    let finalDocNumber: string;
    let initialStatus: string;

    if (finalMode === 'ISSUE') {
      initialStatus = 'ISSUED';
      if (params.custom_number?.trim()) {
        finalDocNumber = params.custom_number.trim();
      } else {
        const now = new Date();
        const seq = await getNextSequenceNumber(typeCode, now.getFullYear(), now.getMonth() + 1);
        finalDocNumber = formatDocumentNumber(numberingFormat, {
          sequenceNumber: seq,
          date: now,
          typeCode: typeCode,
          orgCode: 'TROOPERS',
        });
      }
    } else if (finalMode === 'SUBMIT_APPROVAL') {
      initialStatus = 'PENDING_APPROVAL';
      const shortId = Date.now().toString(36).slice(-6).toUpperCase();
      finalDocNumber = `PENGAJUAN/${typeCode}/${shortId}`;
    } else {
      initialStatus = 'DRAFT';
      const shortId = Date.now().toString(36).slice(-6).toUpperCase();
      finalDocNumber = `DRAF/${typeCode}/${shortId}`;
    }

    // 2. Resolve Signatory Snapshot
    let signatoryName = params.form_data.signatory_name || 'Mohamad Abi';
    let signatoryPosition = params.form_data.signatory_position || 'Program Director Kian Troopers';
    let signatureUrl: string | null = null;
    let stampUrl: string | null = null;
    const cleanSignatoryId = params.signatory_id && params.signatory_id.trim() ? params.signatory_id.trim() : null;

    if (cleanSignatoryId) {
      const sigRow = await db
        .prepare(`
          SELECT ds.name, ds.position, sa.asset_url AS signature_url, st.asset_url AS stamp_url
          FROM document_signatories ds
          LEFT JOIN document_assets sa ON ds.signature_asset_id = sa.id
          LEFT JOIN document_assets st ON ds.stamp_asset_id = st.id
          WHERE ds.id = ?
        `)
        .bind(cleanSignatoryId)
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

    // 4. Resolve Template Version ID
    const versionRow = await db
      .prepare('SELECT id FROM document_template_versions WHERE template_id = ? AND version = ?')
      .bind(template.id, template.current_version)
      .first() as { id: string } | null;

    let activeVersionId = versionRow?.id;
    if (!activeVersionId) {
      const fallbackVersionRow = await db
        .prepare('SELECT id FROM document_template_versions WHERE template_id = ? ORDER BY version DESC LIMIT 1')
        .bind(template.id)
        .first() as { id: string } | null;
      activeVersionId = fallbackVersionRow?.id;
    }

    if (!activeVersionId) {
      activeVersionId = `tplv_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(`
          INSERT INTO document_template_versions (
            id, template_id, version, layout_config, form_schema, default_values, sample_data, created_by, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          activeVersionId,
          template.id,
          template.current_version || 1,
          JSON.stringify(template.layout_config || DEFAULT_SURAT_TUGAS_LAYOUT),
          JSON.stringify(template.form_schema || DEFAULT_SURAT_TUGAS_SCHEMA),
          JSON.stringify(template.default_values || DEFAULT_SURAT_TUGAS_VALUES),
          JSON.stringify(template.sample_data || DEFAULT_SURAT_TUGAS_VALUES),
          session.userId,
          nowSec
        )
        .run();
    }

    // 5. Compile Full Rendered Snapshot
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
        status: initialStatus,
      },
      generated_at: finalMode === 'ISSUE' ? nowSec : null,
    };

    const docTitle = params.form_data.document_title || template.name || 'Dokumen Resmi';

    // 6. Persist to generated_documents
    await db
      .prepare(`
        INSERT INTO generated_documents (
          id, template_id, template_version_id, type_code, document_number, title,
          form_data, rendered_snapshot, status, signatory_id, approved_by, approved_at, rejection_reason, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
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
        initialStatus,
        cleanSignatoryId,
        initialStatus === 'ISSUED' ? session.userId : null,
        initialStatus === 'ISSUED' ? nowSec : null,
        session.userId,
        nowSec,
        nowSec
      )
      .run();

    // 7. Log Workflow Audit Event
    await logWorkflowEvent({
      entityType: 'project',
      entityId: docId,
      fromStatus: null,
      toStatus: initialStatus,
      triggeredBy: session.userId,
      note: `Document created [${initialStatus}]: ${finalDocNumber} ("${docTitle}")`,
    });

    revalidatePath('/dashboard/documents');
    return {
      success: true,
      documentId: docId,
      documentNumber: finalDocNumber,
      status: initialStatus,
    };
  } catch (err: any) {
    console.error('generateDocumentAction failed:', err);
    if (err.message?.includes('UNIQUE constraint') || err.message?.includes('document_number')) {
      return { success: false, error: 'Nomor dokumen ini sudah terdaftar. Silakan coba kembali untuk mendapatkan nomor otomatis baru.' };
    }
    return { success: false, error: err.message || 'Gagal menyimpan dokumen.' };
  }
}

/**
 * Updates an existing draft or pending document before it is approved.
 */
export async function updateDraftDocumentAction(params: {
  documentId: string;
  form_data: Record<string, any>;
  signatory_id?: string;
  title?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isPrivileged =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE');

  try {
    const existing = await db
      .prepare('SELECT id, created_by, status, rendered_snapshot, document_number FROM generated_documents WHERE id = ?')
      .bind(params.documentId)
      .first() as any;

    if (!existing) return { success: false, error: 'Dokumen tidak ditemukan.' };

    if (!isPrivileged && existing.created_by !== session.userId) {
      return { success: false, error: 'Anda tidak memiliki hak untuk mengubah draf ini.' };
    }

    if (existing.status === 'ISSUED' || existing.status === 'GENERATED' || existing.status === 'SIGNED') {
      return { success: false, error: 'Dokumen resmi yang sudah diterbitkan tidak dapat diubah secara langsung.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let snapshot: any = {};
    try { snapshot = JSON.parse(existing.rendered_snapshot || '{}'); } catch {}

    const cleanSignatoryId = params.signatory_id?.trim() || null;
    let signatoryName = params.form_data.signatory_name || snapshot.signatory?.name || 'Mohamad Abi';
    let signatoryPosition = params.form_data.signatory_position || snapshot.signatory?.position || 'Program Director Kian Troopers';
    let signatureUrl = snapshot.signatory?.signature_url || null;
    let stampUrl = snapshot.signatory?.stamp_url || null;

    if (cleanSignatoryId) {
      const sigRow = await db
        .prepare(`
          SELECT ds.name, ds.position, sa.asset_url AS signature_url, st.asset_url AS stamp_url
          FROM document_signatories ds
          LEFT JOIN document_assets sa ON ds.signature_asset_id = sa.id
          LEFT JOIN document_assets st ON ds.stamp_asset_id = st.id
          WHERE ds.id = ?
        `)
        .bind(cleanSignatoryId)
        .first() as any;

      if (sigRow) {
        signatoryName = sigRow.name;
        signatoryPosition = sigRow.position;
        signatureUrl = sigRow.signature_url;
        stampUrl = sigRow.stamp_url;
      }
    }

    const updatedSnapshot = {
      ...snapshot,
      signatory: {
        name: signatoryName,
        position: signatoryPosition,
        signature_url: signatureUrl,
        stamp_url: stampUrl,
      },
      compiled_data: {
        ...params.form_data,
        document_number: existing.document_number,
        status: existing.status,
      },
    };

    const docTitle = params.title || params.form_data.document_title || 'Dokumen Draf';

    await db
      .prepare(`
        UPDATE generated_documents
        SET form_data = ?, rendered_snapshot = ?, title = ?, signatory_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(
        JSON.stringify(params.form_data),
        JSON.stringify(updatedSnapshot),
        docTitle,
        cleanSignatoryId,
        nowSec,
        params.documentId
      )
      .run();

    revalidatePath(`/dashboard/documents/${params.documentId}`);
    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (err: any) {
    console.error('updateDraftDocumentAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Submits a draft or rejected document for Admin approval.
 */
export async function submitForApprovalAction(
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const db = await getDB();
  const ctx = await getSessionContext(session.userId);
  const isPrivileged =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE');

  try {
    const existing = await db
      .prepare('SELECT id, created_by, status, document_number, rendered_snapshot FROM generated_documents WHERE id = ?')
      .bind(documentId)
      .first() as any;

    if (!existing) return { success: false, error: 'Dokumen tidak ditemukan.' };

    if (!isPrivileged && existing.created_by !== session.userId) {
      return { success: false, error: 'Anda hanya dapat mengajukan dokumen milik Anda sendiri.' };
    }

    const nowSec = Math.floor(Date.now() / 1000);
    let snapshot: any = {};
    try { snapshot = JSON.parse(existing.rendered_snapshot || '{}'); } catch {}
    if (snapshot.compiled_data) {
      snapshot.compiled_data.status = 'PENDING_APPROVAL';
    }

    await db
      .prepare(`
        UPDATE generated_documents
        SET status = 'PENDING_APPROVAL', rejection_reason = NULL, rendered_snapshot = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(JSON.stringify(snapshot), nowSec, documentId)
      .run();

    await logWorkflowEvent({
      entityType: 'project',
      entityId: documentId,
      fromStatus: existing.status,
      toStatus: 'PENDING_APPROVAL',
      triggeredBy: session.userId,
      note: `Document submitted for approval: ${existing.document_number}`,
    });

    revalidatePath(`/dashboard/documents/${documentId}`);
    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (err: any) {
    console.error('submitForApprovalAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Approves a pending document, allocates the official sequence number, and marks it as ISSUED.
 * Admin/Executive only.
 */
export async function approveAndIssueDocumentAction(params: {
  documentId: string;
  custom_number?: string;
  signatory_id?: string;
}): Promise<{ success: boolean; documentNumber?: string; error?: string }> {
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
    return { success: false, error: 'Hanya Admin / Executive yang berwenang menyetujui dan menerbitkan dokumen resmi.' };
  }

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const existing = await db
      .prepare(`
        SELECT gd.id, gd.template_id, gd.type_code, gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot, gd.status, gd.signatory_id
        FROM generated_documents gd
        WHERE gd.id = ?
      `)
      .bind(params.documentId)
      .first() as any;

    if (!existing) return { success: false, error: 'Dokumen tidak ditemukan.' };

    if (existing.status === 'ISSUED' || existing.status === 'SIGNED') {
      return { success: false, error: 'Dokumen ini sudah diterbitkan sebelumnya.' };
    }

    // 1. Resolve Document Type & Official Numbering Format
    const docTypeRow = await db
      .prepare('SELECT code, numbering_format FROM document_types WHERE code = ?')
      .bind(existing.type_code)
      .first() as { code: string; numbering_format: string } | null;

    const typeCode = existing.type_code || 'SURAT_TUGAS';
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
    const cleanSignatoryId = params.signatory_id?.trim() || existing.signatory_id || null;
    let formData: any = {};
    let snapshot: any = {};
    try { formData = JSON.parse(existing.form_data || '{}'); } catch {}
    try { snapshot = JSON.parse(existing.rendered_snapshot || '{}'); } catch {}

    let signatoryName = formData.signatory_name || snapshot.signatory?.name || 'Mohamad Abi';
    let signatoryPosition = formData.signatory_position || snapshot.signatory?.position || 'Program Director Kian Troopers';
    let signatureUrl = snapshot.signatory?.signature_url || null;
    let stampUrl = snapshot.signatory?.stamp_url || null;

    if (cleanSignatoryId) {
      const sigRow = await db
        .prepare(`
          SELECT ds.name, ds.position, sa.asset_url AS signature_url, st.asset_url AS stamp_url
          FROM document_signatories ds
          LEFT JOIN document_assets sa ON ds.signature_asset_id = sa.id
          LEFT JOIN document_assets st ON ds.stamp_asset_id = st.id
          WHERE ds.id = ?
        `)
        .bind(cleanSignatoryId)
        .first() as any;

      if (sigRow) {
        signatoryName = sigRow.name;
        signatoryPosition = sigRow.position;
        signatureUrl = sigRow.signature_url;
        stampUrl = sigRow.stamp_url;
      }
    }

    // 3. Update rendered snapshot with official metadata
    const updatedSnapshot = {
      ...snapshot,
      signatory: {
        name: signatoryName,
        position: signatoryPosition,
        signature_url: signatureUrl,
        stamp_url: stampUrl,
      },
      compiled_data: {
        ...(snapshot.compiled_data || formData),
        document_number: finalDocNumber,
        status: 'ISSUED',
      },
      generated_at: nowSec,
    };

    // 4. Update generated_documents record
    await db
      .prepare(`
        UPDATE generated_documents
        SET status = 'ISSUED',
            document_number = ?,
            signatory_id = ?,
            approved_by = ?,
            approved_at = ?,
            rejection_reason = NULL,
            rendered_snapshot = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .bind(
        finalDocNumber,
        cleanSignatoryId,
        session.userId,
        nowSec,
        JSON.stringify(updatedSnapshot),
        nowSec,
        params.documentId
      )
      .run();

    // 5. Audit Log
    await logWorkflowEvent({
      entityType: 'project',
      entityId: params.documentId,
      fromStatus: existing.status,
      toStatus: 'ISSUED',
      triggeredBy: session.userId,
      note: `Document approved and issued: ${finalDocNumber} ("${existing.title}")`,
    });

    revalidatePath(`/dashboard/documents/${params.documentId}`);
    revalidatePath('/dashboard/documents');
    return {
      success: true,
      documentNumber: finalDocNumber,
    };
  } catch (err: any) {
    console.error('approveAndIssueDocumentAction failed:', err);
    return { success: false, error: err.message || 'Gagal menyetujui dokumen.' };
  }
}

/**
 * Rejects a pending document with a constructive reason.
 * Admin/Executive only.
 */
export async function rejectDocumentAction(params: {
  documentId: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const ctx = await getSessionContext(session.userId);
  const isAuthorized =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE');

  if (!isAuthorized) {
    return { success: false, error: 'Hanya Admin / Executive yang berwenang menolak pengajuan dokumen.' };
  }

  const reason = params.reason?.trim();
  if (!reason) {
    return { success: false, error: 'Alasan penolakan / revisi wajib diisi.' };
  }

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    const existing = await db
      .prepare('SELECT id, status, document_number, rendered_snapshot FROM generated_documents WHERE id = ?')
      .bind(params.documentId)
      .first() as any;

    if (!existing) return { success: false, error: 'Dokumen tidak ditemukan.' };

    let snapshot: any = {};
    try { snapshot = JSON.parse(existing.rendered_snapshot || '{}'); } catch {}
    if (snapshot.compiled_data) {
      snapshot.compiled_data.status = 'REJECTED';
      snapshot.compiled_data.rejection_reason = reason;
    }

    await db
      .prepare(`
        UPDATE generated_documents
        SET status = 'REJECTED', rejection_reason = ?, rendered_snapshot = ?, updated_at = ?
        WHERE id = ?
      `)
      .bind(reason, JSON.stringify(snapshot), nowSec, params.documentId)
      .run();

    await logWorkflowEvent({
      entityType: 'project',
      entityId: params.documentId,
      fromStatus: existing.status,
      toStatus: 'REJECTED',
      triggeredBy: session.userId,
      note: `Document rejected: ${existing.document_number}. Reason: ${reason}`,
    });

    revalidatePath(`/dashboard/documents/${params.documentId}`);
    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (err: any) {
    console.error('rejectDocumentAction failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Checks whether a document is targeted / assigned to a specific user.
 * Supports:
 * - Table assignees array (matching id, user_id, nip, email, name)
 * - Single person form fields (person_name, person_nip, person_email, target_user_id)
 */
function isUserTargetedInDocument(
  doc: GeneratedDocumentItem,
  user: { id: string; name: string; email: string; student_id_number: string | null }
): boolean {
  const currentUserId = (user.id || '').toLowerCase().trim();
  const currentUserName = (user.name || '').toLowerCase().trim();
  const currentUserNip = (user.student_id_number || '').toLowerCase().trim();
  const currentUserEmail = (user.email || '').toLowerCase().trim();

  const compiled = (doc.rendered_snapshot as any)?.compiled_data || doc.form_data || {};

  // 1. Check array of assignees / personil
  const assignees: any[] = Array.isArray(compiled.assignees)
    ? compiled.assignees
    : Array.isArray(doc.form_data?.assignees)
    ? doc.form_data.assignees
    : [];

  const matchedInAssignees = assignees.some((a) => {
    const aId = (a.id || a.user_id || '').toString().toLowerCase().trim();
    const aName = (a.name || '').toLowerCase().trim();
    const aNip = (a.nip || '').toLowerCase().trim();
    const aEmail = (a.email || '').toLowerCase().trim();

    if (currentUserId && aId && aId === currentUserId) return true;
    if (currentUserEmail && aEmail && aEmail === currentUserEmail) return true;
    if (currentUserNip && aNip && (aNip === currentUserNip || aNip.includes(currentUserNip))) return true;
    if (currentUserName && aName && (aName === currentUserName || aName.includes(currentUserName) || currentUserName.includes(aName))) {
      return true;
    }
    return false;
  });

  if (matchedInAssignees) return true;

  // 2. Check single person recipient fields (e.g. Surat Keterangan / Pernyataan)
  const pName = (compiled.person_name || doc.form_data?.person_name || '').toLowerCase().trim();
  const pNip = (compiled.person_nip || doc.form_data?.person_nip || '').toLowerCase().trim();
  const pEmail = (compiled.person_email || doc.form_data?.person_email || '').toLowerCase().trim();
  const pId = (compiled.person_user_id || compiled.target_user_id || '').toString().toLowerCase().trim();

  if (currentUserId && pId && pId === currentUserId) return true;
  if (currentUserEmail && pEmail && pEmail === currentUserEmail) return true;
  if (currentUserNip && pNip && (pNip === currentUserNip || pNip.includes(currentUserNip))) return true;
  if (currentUserName && pName && (pName === currentUserName || pName.includes(currentUserName) || currentUserName.includes(pName))) {
    return true;
  }

  return false;
}

/**
 * Fetches generated documents with permission & status filtering.
 */
export async function getGeneratedDocuments(filter?: {
  type_code?: string;
  status?: string;
  limit?: number;
}): Promise<GeneratedDocumentItem[]> {
  const session = await getSession();
  if (!session) return [];

  const ctx = await getSessionContext(session.userId);
  const isPrivileged =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  const db = await getDB();
  const limit = filter?.limit || 150;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filter?.type_code) {
    conditions.push('gd.type_code = ?');
    params.push(filter.type_code);
  }

  if (filter?.status) {
    conditions.push('gd.status = ?');
    params.push(filter.status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit);

  try {
    const { results } = await db
      .prepare(`
        SELECT 
          gd.id, gd.template_id, gd.template_version_id, gd.type_code,
          gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot,
          gd.status, gd.signatory_id, gd.approved_by, gd.approved_at, gd.rejection_reason,
          gd.created_by, gd.created_at, gd.updated_at,
          dt.name AS template_name, dt.current_version AS template_version,
          u.name AS created_by_name,
          u_app.name AS approved_by_name,
          ds.name AS signatory_name
        FROM generated_documents gd
        LEFT JOIN document_templates dt ON gd.template_id = dt.id
        LEFT JOIN users u ON gd.created_by = u.id
        LEFT JOIN users u_app ON gd.approved_by = u_app.id
        LEFT JOIN document_signatories ds ON gd.signatory_id = ds.id
        ${whereClause}
        ORDER BY gd.created_at DESC
        LIMIT ?
      `)
      .bind(...params)
      .all();

    const currentUserRow = await db
      .prepare('SELECT id, name, email, student_id_number FROM users WHERE id = ?')
      .bind(session.userId)
      .first() as { id: string; name: string; email: string; student_id_number: string | null } | null;

    const allDocs: GeneratedDocumentItem[] = (results || []).map((r: any) => {
      let formData: Record<string, any> = {};
      let renderedSnapshot: Record<string, any> = {};
      try { formData = JSON.parse(r.form_data || '{}'); } catch {}
      try { renderedSnapshot = JSON.parse(r.rendered_snapshot || '{}'); } catch {}

      return {
        id: r.id,
        template_id: r.template_id,
        template_name: r.template_name || 'Custom Template',
        template_version_id: r.template_version_id,
        template_version: r.template_version || 1,
        type_code: r.type_code,
        document_number: r.document_number,
        title: r.title,
        form_data: formData,
        rendered_snapshot: renderedSnapshot as any,
        status: r.status,
        signatory_id: r.signatory_id,
        signatory_name: r.signatory_name,
        approved_by: r.approved_by,
        approved_by_name: r.approved_by_name,
        approved_at: r.approved_at,
        rejection_reason: r.rejection_reason,
        created_by: r.created_by,
        created_by_name: r.created_by_name || 'Admin',
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    if (isPrivileged) {
      return allDocs;
    }

    // Regular users (without document manage permission):
    // CAN ONLY see published/issued documents targeted to their account
    return allDocs.filter((doc) => {
      const isOfficial = doc.status === 'ISSUED' || doc.status === 'GENERATED' || doc.status === 'SIGNED';
      if (!isOfficial) {
        return false;
      }

      return isUserTargetedInDocument(doc, {
        id: session.userId,
        name: currentUserRow?.name || '',
        email: currentUserRow?.email || '',
        student_id_number: currentUserRow?.student_id_number || '',
      });
    });
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
  const session = await getSession();
  if (!session) return null;

  const ctx = await getSessionContext(session.userId);
  const isPrivileged =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  const db = await getDB();
  try {
    const r = await db
      .prepare(`
        SELECT 
          gd.id, gd.template_id, gd.template_version_id, gd.type_code,
          gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot,
          gd.status, gd.signatory_id, gd.approved_by, gd.approved_at, gd.rejection_reason,
          gd.created_by, gd.created_at, gd.updated_at,
          dt.name AS template_name, dt.current_version AS template_version,
          u.name AS created_by_name,
          u_app.name AS approved_by_name,
          ds.name AS signatory_name
        FROM generated_documents gd
        LEFT JOIN document_templates dt ON gd.template_id = dt.id
        LEFT JOIN users u ON gd.created_by = u.id
        LEFT JOIN users u_app ON gd.approved_by = u_app.id
        LEFT JOIN document_signatories ds ON gd.signatory_id = ds.id
        WHERE gd.id = ?
      `)
      .bind(id)
      .first() as any;

    if (!r) return null;

    let formData: Record<string, any> = {};
    let renderedSnapshot: Record<string, any> = {};
    try { formData = JSON.parse(r.form_data || '{}'); } catch {}
    try { renderedSnapshot = JSON.parse(r.rendered_snapshot || '{}'); } catch {}

    const doc: GeneratedDocumentItem = {
      id: r.id,
      template_id: r.template_id,
      template_name: r.template_name || 'Custom Template',
      template_version_id: r.template_version_id,
      template_version: r.template_version || 1,
      type_code: r.type_code,
      document_number: r.document_number,
      title: r.title,
      form_data: formData,
      rendered_snapshot: renderedSnapshot as any,
      status: r.status,
      signatory_id: r.signatory_id,
      signatory_name: r.signatory_name,
      approved_by: r.approved_by,
      approved_by_name: r.approved_by_name,
      approved_at: r.approved_at,
      rejection_reason: r.rejection_reason,
      created_by: r.created_by,
      created_by_name: r.created_by_name || 'Admin',
      created_at: r.created_at,
      updated_at: r.updated_at,
    };

    if (isPrivileged) {
      return doc;
    }

    // Regular users (without document manage permission):
    // CAN ONLY view published/issued documents targeted to their account
    const isOfficial = doc.status === 'ISSUED' || doc.status === 'GENERATED' || doc.status === 'SIGNED';
    if (!isOfficial) {
      return null;
    }

    const currentUserRow = await db
      .prepare('SELECT id, name, email, student_id_number FROM users WHERE id = ?')
      .bind(session.userId)
      .first() as { id: string; name: string; email: string; student_id_number: string | null } | null;

    const isAssigned = isUserTargetedInDocument(doc, {
      id: session.userId,
      name: currentUserRow?.name || '',
      email: currentUserRow?.email || '',
      student_id_number: currentUserRow?.student_id_number || '',
    });

    if (!isAssigned) {
      return null;
    }

    return doc;
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

/**
 * Public Verification Action (No login required).
 * Allows general public (e.g. parents, partners, institutions) to verify authenticity of official documents.
 */
export async function getPublicDocumentVerification(idOrNumber: string): Promise<{
  isValid: boolean;
  document?: {
    id: string;
    document_number: string;
    title: string;
    type_code: string;
    status: string;
    issued_at: number;
    created_at: number;
    organization: OrganizationSnapshot;
    signatory: {
      name: string;
      position: string;
    };
    event: {
      intro?: string;
      days?: string;
      time?: string;
      location?: string;
    };
    intro_text?: string;
    closing_text?: string;
    assignees: Array<{
      no?: number;
      nip?: string;
      name: string;
      role: string;
      campus?: string;
      division?: string;
      period?: string;
    }>;
    tembusan?: string[];
  };
  error?: string;
}> {
  if (!idOrNumber || !idOrNumber.trim()) {
    return { isValid: false, error: 'ID atau Nomor Dokumen wajib diisi.' };
  }

  const cleanQuery = decodeURIComponent(idOrNumber.trim());
  const db = await getDB();

  try {
    const row = await db
      .prepare(`
        SELECT 
          gd.id, gd.type_code, gd.document_number, gd.title, gd.form_data, gd.rendered_snapshot,
          gd.status, gd.created_at, gd.approved_at,
          ds.name AS signatory_name, ds.position AS signatory_position
        FROM generated_documents gd
        LEFT JOIN document_signatories ds ON gd.signatory_id = ds.id
        WHERE gd.id = ? OR gd.document_number = ?
        LIMIT 1
      `)
      .bind(cleanQuery, cleanQuery)
      .first() as any;

    if (!row) {
      return { isValid: false, error: 'Dokumen tidak ditemukan dalam pangkalan data resmi KIAN HQ.' };
    }

    if (row.status !== 'ISSUED' && row.status !== 'GENERATED' && row.status !== 'SIGNED') {
      return {
        isValid: false,
        error: `Dokumen ini berstatus "${row.status}" (Draf / Menunggu Persetujuan) dan belum diterbitkan secara resmi oleh Manajemen KIAN.`,
      };
    }

    let formData: Record<string, any> = {};
    let snapshot: Record<string, any> = {};
    try { formData = JSON.parse(row.form_data || '{}'); } catch {}
    try { snapshot = JSON.parse(row.rendered_snapshot || '{}'); } catch {}

    const compiledData = snapshot.compiled_data || formData;
    const org: OrganizationSnapshot = snapshot.organization || DEFAULT_ORGANIZATION_PROFILE;

    const assignees: Array<{ no?: number; nip?: string; name: string; role: string; campus?: string; division?: string; period?: string }> = Array.isArray(compiledData.assignees)
      ? compiledData.assignees.map((a: any, idx: number) => ({
          no: a.no || idx + 1,
          nip: a.nip || '-',
          name: a.name || 'Personil',
          role: a.role || a.division || 'Anggota Tim',
          campus: a.campus || undefined,
          division: a.division || undefined,
          period: a.period || undefined,
        }))
      : [];

    const tembusanList = Array.isArray(compiledData.tembusan)
      ? compiledData.tembusan
      : Array.isArray(compiledData.cc_list)
      ? compiledData.cc_list
      : typeof compiledData.tembusan === 'string'
      ? compiledData.tembusan.split('\n').map((s: string) => s.trim()).filter(Boolean)
      : [];

    return {
      isValid: true,
      document: {
        id: row.id,
        document_number: row.document_number,
        title: row.title || compiledData.document_title || 'Dokumen Resmi KIAN',
        type_code: row.type_code || 'SURAT_TUGAS',
        status: row.status || 'ISSUED',
        issued_at: row.approved_at || snapshot.generated_at || row.created_at,
        created_at: row.created_at,
        organization: org,
        signatory: {
          name: snapshot.signatory?.name || row.signatory_name || compiledData.signatory_name || 'Pimpinan KIAN HQ',
          position: snapshot.signatory?.position || row.signatory_position || compiledData.signatory_position || 'Program Director Kian Troopers',
        },
        event: {
          intro: compiledData.event_intro || '',
          days: compiledData.event_days || '',
          time: compiledData.event_time || '',
          location: compiledData.event_location || '',
        },
        intro_text: compiledData.intro_text || '',
        closing_text: compiledData.closing_text || '',
        assignees,
        tembusan: tembusanList,
      },
    };
  } catch (err: any) {
    console.error('getPublicDocumentVerification error:', err);
    return { isValid: false, error: 'Terjadi kendala saat memeriksa validasi dokumen.' };
  }
}

