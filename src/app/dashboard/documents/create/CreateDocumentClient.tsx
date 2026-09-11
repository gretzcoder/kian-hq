'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DocumentSignatoryItem,
  DocumentTemplateItem,
} from '@/modules/documents/documentTypes';
import { generateDocumentAction } from '@/modules/documents/documentActions';
import { DynamicDocumentForm } from '@/modules/documents/components/DynamicDocumentForm';
import { DocumentCanvas } from '@/modules/documents/components/DocumentCanvas';
import { DocumentPDFExporter } from '@/modules/documents/components/DocumentPDFExporter';
import { DocumentPreviewContainer } from '@/modules/documents/components/DocumentPreviewContainer';

interface CreateDocumentClientProps {
  templates: DocumentTemplateItem[];
  signatories: DocumentSignatoryItem[];
  initialTemplateId?: string;
}

export const CreateDocumentClient: React.FC<CreateDocumentClientProps> = ({
  templates = [],
  signatories = [],
  initialTemplateId,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedTplId = searchParams.get('templateId') || initialTemplateId || templates[0]?.id;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(preselectedTplId);
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>(
    signatories[0]?.id || ''
  );

  const [formData, setFormData] = useState<Record<string, any>>(
    currentTemplate?.default_values || {}
  );

  const [customNumber, setCustomNumber] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdDocInfo, setCreatedDocInfo] = useState<{ id: string; number: string } | null>(null);

  // When selected template changes, reset form data to its defaults
  useEffect(() => {
    if (currentTemplate) {
      setFormData(currentTemplate.default_values || {});
    }
  }, [currentTemplate]);

  const handleFieldChange = (key: string, val: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleGenerate = async () => {
    if (!currentTemplate) return;

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const res = await generateDocumentAction({
        template_id: currentTemplate.id,
        form_data: formData,
        custom_number: customNumber.trim() || undefined,
        signatory_id: selectedSignatoryId || undefined,
      });

      if (res.success && res.documentId && res.documentNumber) {
        setCreatedDocInfo({ id: res.documentId, number: res.documentNumber });
      } else {
        setErrorMsg(res.error || 'Gagal menerbitkan surat.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedSignatory = signatories.find((s) => s.id === selectedSignatoryId);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/documents"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← Kembali ke Dokumen
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-2">
            <span>✍️</span> Penerbitan Dokumen Resmi
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Isi data formulir berikut. Layout A4 dan nomor surat akan otomatis digenerate dengan presisi tinggi.
          </p>
        </div>

        {/* Action Button: Generate / Download */}
        <div className="flex items-center gap-3">
          {createdDocInfo ? (
            <div className="flex items-center gap-2">
              <DocumentPDFExporter
                documentNumber={createdDocInfo.number}
                documentTitle={formData.document_title || 'Surat_Tugas'}
              />
              <Link
                href={`/dashboard/documents/${createdDocInfo.id}`}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs"
              >
                Lihat Detail Dokumen
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
            >
              {isGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menerbitkan Surat...</span>
                </>
              ) : (
                <>
                  <span>📜</span>
                  <span>Terbitkan &amp; Simpan Dokumen</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold">
          ⚠️ {errorMsg}
        </div>
      )}

      {createdDocInfo && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex flex-wrap items-center justify-between gap-2">
          <span>
            🎉 Surat berhasil diterbitkan dengan nomor resmi: <strong>{createdDocInfo.number}</strong>!
          </span>
          <span className="text-[11px] font-medium">
            Arsip permanen tersimpan di database.
          </span>
        </div>
      )}

      {/* Main Grid: Form Inputs vs Live A4 Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Setup */}
        <div className="lg:col-span-5 space-y-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
          {/* 1. Template Selector */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Pilih Template Surat <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.type_name} - v{tpl.current_version})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Signatory Selector */}
          {signatories.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                Pejabat Penandatangan Resmi
              </label>
              <select
                value={selectedSignatoryId}
                onChange={(e) => setSelectedSignatoryId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium"
              >
                {signatories.map((sig) => (
                  <option key={sig.id} value={sig.id}>
                    {sig.name} - {sig.position}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 3. Numbering Preview / Custom Override */}
          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 flex items-center justify-between">
              <span>Nomor Surat</span>
              <span className="text-purple-600 dark:text-purple-400 font-mono text-[10px]">
                Otomatis via Sequential Counter
              </span>
            </label>
            <input
              type="text"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
              placeholder="Kosongkan untuk nomor otomatis (e.g. 1/KIAN/TROOPERS/IX/2026)"
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
            />
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3">
              Formulir Data Dokumen
            </h3>
            <DynamicDocumentForm
              schema={currentTemplate?.form_schema || []}
              formData={formData}
              onChange={handleFieldChange}
              annexThreshold={currentTemplate?.layout_config?.annexThresholdRows ?? 4}
            />
          </div>
        </div>

        {/* Right Column: Live A4 Canvas Preview */}
        <div className="lg:col-span-7 space-y-3">
          <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span>👁️</span> Live Preview Dokumen (A4)
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full">
              Sesuai Format Cetak PDF
            </span>
          </div>

          <DocumentPreviewContainer defaultMode="fit" showToolbar>
            <DocumentCanvas
              formData={{
                ...formData,
                document_number: customNumber || formData.document_number || '1/KIAN/TROOPERS/IX/2026',
              }}
              layoutConfig={currentTemplate?.layout_config}
              signatory={selectedSignatory ? {
                name: selectedSignatory.name,
                position: selectedSignatory.position,
                signature_url: selectedSignatory.signature_url,
                stamp_url: selectedSignatory.stamp_url,
              } : undefined}
            />
          </DocumentPreviewContainer>
        </div>
      </div>
    </div>
  );
};
