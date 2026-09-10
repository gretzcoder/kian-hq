import React from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/modules/auth/session';
import { getGeneratedDocumentById } from '@/modules/documents/documentActions';
import { DocumentCanvas } from '@/modules/documents/components/DocumentCanvas';
import { DocumentPDFExporter } from '@/modules/documents/components/DocumentPDFExporter';

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  const resolvedParams = await params;
  const doc = await getGeneratedDocumentById(resolvedParams.id);

  if (!doc) {
    notFound();
  }

  const snapshot = doc.rendered_snapshot;
  const compiledData = snapshot.compiled_data || doc.form_data;
  const dateStr = new Date(doc.created_at * 1000).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-6 pb-16 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <Link
            href="/dashboard/documents"
            className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Kembali ke Arsip Dokumen
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 font-mono">
              {doc.document_number}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">
              {doc.status}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            {doc.title} • Diterbitkan oleh <strong>{doc.created_by_name}</strong> pada {dateStr} WIB
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <DocumentPDFExporter
            documentNumber={doc.document_number}
            documentTitle={doc.title}
          />
        </div>
      </div>

      {/* Historical Immutability Badge */}
      <div className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
        <span>
          🔒 <strong>Historical Snapshot:</strong> Dokumen ini dirender dari snapshot permanen template <strong>{doc.template_name} (v{doc.template_version})</strong>. Tampilan tidak akan terpengaruh oleh perubahan template atau profil organisasi di masa depan.
        </span>
      </div>

      {/* A4 Canvas Container */}
      <div className="bg-zinc-100 dark:bg-zinc-950 p-6 sm:p-10 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center overflow-x-auto shadow-inner">
        <div className="transform origin-top scale-[0.80] sm:scale-[0.90] xl:scale-[1] transition-transform duration-200">
          <DocumentCanvas
            formData={compiledData}
            layoutConfig={snapshot.layout_config}
            organization={snapshot.organization}
            signatory={snapshot.signatory}
          />
        </div>
      </div>
    </div>
  );
}
