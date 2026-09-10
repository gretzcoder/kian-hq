import React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import {
  getDocumentTemplates,
  ensureDefaultSeedTemplates,
} from '@/modules/documents/templateActions';
import { getGeneratedDocuments } from '@/modules/documents/documentActions';
import { DocumentListTable } from '@/modules/documents/components/DocumentListTable';
import { TemplateListTable } from '@/modules/documents/components/TemplateListTable';

export default async function DocumentsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  await ensureDefaultSeedTemplates();
  const ctx = await getSessionContext(session.userId);

  const canManage =
    ctx.can('DOCUMENT_MANAGE') ||
    ctx.can('MANAGE') ||
    ctx.permissions.has('ADMIN_SYSTEM') ||
    ctx.roles.includes('EXECUTIVE') ||
    ctx.roles.includes('COORDINATOR');

  const canCreate =
    ctx.can('DOCUMENT_CREATE') ||
    canManage;

  const resolvedParams = await searchParams;
  const activeTab = canManage && resolvedParams.tab === 'templates' ? 'templates' : 'documents';

  const [documents, templates] = await Promise.all([
    getGeneratedDocuments(),
    canManage ? getDocumentTemplates() : Promise.resolve([]),
  ]);

  const activeTemplatesCount = templates.filter((t) => t.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl">📑</span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">
              Dokumen &amp; Surat Resmi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {canCreate
              ? 'Engine penerbitan surat tugas, undangan, dan dokumen resmi KIAN Troopers dengan layout presisi A4 & lampiran otomatis.'
              : 'Daftar surat tugas dan dokumen resmi KIAN Troopers yang ditugaskan kepada Anda.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && (
            <Link
              href="/dashboard/documents/templates/new"
              className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <span>⚙️</span> Buat Template
            </Link>
          )}

          {canCreate && (
            <Link
              href="/dashboard/documents/create"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <span>+</span> Buat Surat Baru
            </Link>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className={`grid grid-cols-1 ${canManage ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            {canManage ? 'Total Dokumen Diterbitkan' : 'Dokumen Anda'}
          </p>
          <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 font-mono">
            {documents.length}
          </p>
          <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
            Arsip digital permanen &amp; snapshot
          </span>
        </div>

        {canManage ? (
          <>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Template Aktif
              </p>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1 font-mono">
                {activeTemplatesCount}
              </p>
              <span className="text-[10px] text-zinc-500 font-medium">
                Surat Tugas, Undangan, SK, dll.
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                Format Penomoran
              </p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-2 font-mono truncate">
                &#123;seq&#125;/KIAN/TROOPERS/IX/2026
              </p>
              <span className="text-[10px] text-emerald-600 font-medium">
                ✓ Auto sequence &amp; Concurrency Safe
              </span>
            </div>
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Status Akses
            </p>
            <p className="text-sm font-bold text-emerald-600 mt-2 flex items-center gap-1">
              <span>✓</span> Terverifikasi Resmi
            </p>
            <span className="text-[10px] text-zinc-500 font-medium">
              Bisa dilihat dan diunduh format PDF A4
            </span>
          </div>
        )}
      </div>

      {/* Tabs Navigation (Only shown for managers with multiple tabs) */}
      {canManage && (
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <Link
            href="/dashboard/documents"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span>📜</span> Dokumen Diterbitkan ({documents.length})
          </Link>
          <Link
            href="/dashboard/documents?tab=templates"
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <span>📋</span> Katalog Template ({templates.length})
          </Link>
        </div>
      )}
      {/* Tab Content */}
      {activeTab === 'documents' ? (
        <DocumentListTable documents={documents} canManage={canManage} />
      ) : (
        <TemplateListTable templates={templates} canManage={canManage} />
      )}
    </div>
  );
}
