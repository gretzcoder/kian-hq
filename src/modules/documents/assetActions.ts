'use server';

import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { revalidatePath } from 'next/cache';
import { DocumentAssetItem, DocumentSignatoryItem } from './documentTypes';

/**
 * Fetch all reusable document signatories
 */
export async function getDocumentSignatories(): Promise<DocumentSignatoryItem[]> {
  const db = await getDB();
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          ds.id, ds.name, ds.position, ds.signature_asset_id, ds.stamp_asset_id,
          ds.is_active, ds.created_by, ds.created_at, ds.updated_at,
          sa.asset_url AS signature_url,
          st.asset_url AS stamp_url
        FROM document_signatories ds
        LEFT JOIN document_assets sa ON ds.signature_asset_id = sa.id
        LEFT JOIN document_assets st ON ds.stamp_asset_id = st.id
        WHERE ds.is_active = 1
        ORDER BY ds.created_at ASC
      `)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      position: r.position,
      signature_asset_id: r.signature_asset_id,
      signature_url: r.signature_url || null,
      stamp_asset_id: r.stamp_asset_id,
      stamp_url: r.stamp_url || null,
      is_active: Boolean(r.is_active),
      created_by: r.created_by,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err) {
    console.error('getDocumentSignatories error:', err);
    return [];
  }
}

/**
 * Create or update a reusable signatory
 */
export async function saveSignatoryAction(data: {
  id?: string;
  name: string;
  position: string;
  signature_asset_id?: string;
  stamp_asset_id?: string;
}): Promise<{ success: boolean; signatoryId?: string; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  if (!data.name?.trim() || !data.position?.trim()) {
    return { success: false, error: 'Nama dan jabatan penandatangan wajib diisi.' };
  }

  const db = await getDB();
  const nowSec = Math.floor(Date.now() / 1000);
  const sigId = data.id || `sig_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    if (data.id) {
      await db
        .prepare(`
          UPDATE document_signatories
          SET name = ?, position = ?, signature_asset_id = ?, stamp_asset_id = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(
          data.name.trim(),
          data.position.trim(),
          data.signature_asset_id || null,
          data.stamp_asset_id || null,
          nowSec,
          sigId
        )
        .run();
    } else {
      await db
        .prepare(`
          INSERT INTO document_signatories (
            id, name, position, signature_asset_id, stamp_asset_id, is_active, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
        `)
        .bind(
          sigId,
          data.name.trim(),
          data.position.trim(),
          data.signature_asset_id || null,
          data.stamp_asset_id || null,
          session.userId,
          nowSec,
          nowSec
        )
        .run();
    }

    revalidatePath('/dashboard/documents');
    return { success: true, signatoryId: sigId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Upload and save a reusable asset (Frame, Logo, Signature, Stamp)
 */
export async function uploadDocumentAssetAction(formData: FormData): Promise<{
  success: boolean;
  asset?: DocumentAssetItem;
  error?: string;
}> {
  const session = await getSession();
  if (!session) return { success: false, error: 'Unauthorized' };

  const name = (formData.get('name') as string)?.trim();
  const category = (formData.get('category') as string)?.trim() as any;
  const file = formData.get('file') as File | null;
  const urlInput = (formData.get('url') as string)?.trim();

  if (!name) return { success: false, error: 'Nama aset wajib diisi.' };
  if (!category) return { success: false, error: 'Kategori aset wajib dipilih.' };

  let assetUrl: string | null = null;
  let mimeType = 'image/png';

  if (file && file.size > 0) {
    if (file.size > 2.5 * 1024 * 1024) {
      return { success: false, error: 'Ukuran file maksimal 2.5MB.' };
    }
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    mimeType = file.type || 'image/png';
    assetUrl = `data:${mimeType};base64,${base64}`;
  } else if (urlInput) {
    assetUrl = urlInput;
  }

  if (!assetUrl) {
    return { success: false, error: 'Pilih file gambar atau masukkan URL aset.' };
  }

  const db = await getDB();
  const assetId = `ast_${crypto.randomUUID().replace(/-/g, '')}`;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    await db
      .prepare(`
        INSERT INTO document_assets (
          id, name, category, asset_url, mime_type, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(assetId, name, category, assetUrl, mimeType, session.userId, nowSec)
      .run();

    const assetItem: DocumentAssetItem = {
      id: assetId,
      name,
      category,
      asset_url: assetUrl,
      mime_type: mimeType,
      created_by: session.userId,
      created_at: nowSec,
    };

    revalidatePath('/dashboard/documents');
    return { success: true, asset: assetItem };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch reusable document assets by category
 */
export async function getDocumentAssets(category?: string): Promise<DocumentAssetItem[]> {
  const db = await getDB();
  const catFilter = category ? 'WHERE category = ?' : '';
  const params = category ? [category] : [];

  try {
    const { results } = await db
      .prepare(`SELECT * FROM document_assets ${catFilter} ORDER BY created_at DESC`)
      .bind(...params)
      .all();

    return (results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      asset_url: r.asset_url,
      mime_type: r.mime_type,
      width: r.width,
      height: r.height,
      created_by: r.created_by,
      created_at: r.created_at,
    }));
  } catch (err) {
    console.error('getDocumentAssets error:', err);
    return [];
  }
}
