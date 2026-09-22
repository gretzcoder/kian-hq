'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  DocumentSignatoryItem,
  DocumentTemplateItem,
  TemplateLayoutConfig,
} from '@/modules/documents/documentTypes';
import {
  generateDocumentAction,
  getSuratTugasDispensationPreloadAction,
} from '@/modules/documents/documentActions';
import { DynamicDocumentForm } from '@/modules/documents/components/DynamicDocumentForm';
import { DocumentCanvas } from '@/modules/documents/components/DocumentCanvas';
import { DocumentPDFExporter } from '@/modules/documents/components/DocumentPDFExporter';
import { DocumentPreviewContainer } from '@/modules/documents/components/DocumentPreviewContainer';
import { SmartNumberingWidget } from '@/modules/documents/components/SmartNumberingWidget';
import { getRealtimeDocumentDate } from '@/lib/dateUtils';

interface CreateDocumentClientProps {
  templates: DocumentTemplateItem[];
  signatories: DocumentSignatoryItem[];
  initialTemplateId?: string;
  isPrivileged?: boolean;
}

export const CreateDocumentClient: React.FC<CreateDocumentClientProps> = ({
  templates = [],
  signatories = [],
  initialTemplateId,
  isPrivileged = false,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromSuratTugasId = searchParams.get('fromSuratTugasId') || searchParams.get('fromDocId');

  // Find dispensation template if coming from Surat Tugas
  const dispTemplate = templates.find(
    (t) =>
      t.type_code === 'SURAT_DISPENSASI' ||
      t.type_code?.includes('DISP') ||
      t.name.toLowerCase().includes('dispensasi')
  );

  const initialTpl = fromSuratTugasId && dispTemplate
    ? dispTemplate.id
    : searchParams.get('templateId') || initialTemplateId || templates[0]?.id;

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTpl);
  const currentTemplate = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const [selectedSignatoryId, setSelectedSignatoryId] = useState<string>(
    signatories[0]?.id || ''
  );

  const getPreparedFormData = (tpl: DocumentTemplateItem | undefined) => {
    const raw = { ...(tpl?.default_values || {}) };
    // Automatically set document date to realtime current date
    raw.document_date_place = getRealtimeDocumentDate('Jakarta');

    // Normalize legacy hardcoded default event strings if present
    if (
      typeof raw.event_intro_text === 'string' &&
      raw.event_intro_text.includes('BKOT (Bincang Kampus Bersama Orang Tua) UBSI')
    ) {
      raw.event_intro_text = raw.event_intro_text.replace(
        /BKOT \(Bincang Kampus Bersama Orang Tua\) UBSI/g,
        '{event_name}'
      );
    }
    if (
      typeof raw.intro_text === 'string' &&
      raw.intro_text.includes('Project Director Kian Troopers') &&
      !raw.intro_text.includes('{signer_title_intro}')
    ) {
      raw.intro_text = raw.intro_text.replace(
        /Project Director Kian Troopers/g,
        '{signer_title_intro}'
      );
    }
    if (
      typeof raw.intro_text === 'string' &&
      raw.intro_text.includes('Rapat Koordinasi & Sinergi Program KIAN Troopers 2026')
    ) {
      raw.intro_text = raw.intro_text.replace(
        /Rapat Koordinasi & Sinergi Program KIAN Troopers 2026/g,
        '{event_name}'
      );
    }

    return raw;
  };

  const isCurrentDispTemplate = Boolean(
    currentTemplate?.type_code === 'SURAT_DISPENSASI' ||
    currentTemplate?.type_code?.includes('DISP') ||
    currentTemplate?.name?.toLowerCase().includes('dispensasi')
  );

  const [formData, setFormData] = useState<Record<string, any>>(() =>
    getPreparedFormData(currentTemplate)
  );

  // Smart Numbering States
  const [selectedCategory, setSelectedCategory] = useState<string>(
    isCurrentDispTemplate ? 'DISP' : 'TROOPERS'
  );
  const [companyCode, setCompanyCode] = useState<string>('KIAN');
  const [orgCode, setOrgCode] = useState<string>(
    isCurrentDispTemplate ? 'DISP' : 'TROOPERS'
  );
  const [customNumber, setCustomNumber] = useState<string>('');
  const [resolvedLiveNumber, setResolvedLiveNumber] = useState<string>('');

  // Auto-inherit custom frame/logo from master template if current template does not have one yet
  const masterTplWithFrame = templates.find(
    (t) => Boolean(t.layout_config?.kopConfig?.frameAssetUrl || t.layout_config?.frameAssetUrl)
  );

  const effectiveLayoutConfig = React.useMemo(() => {
    if (!currentTemplate?.layout_config) return undefined;
    const cfg: TemplateLayoutConfig = { ...currentTemplate.layout_config };
    const hasFrame = Boolean(cfg.kopConfig?.frameAssetUrl || cfg.frameAssetUrl);
    if (!hasFrame && masterTplWithFrame?.layout_config) {
      const masterCfg = masterTplWithFrame.layout_config;
      cfg.frameAssetUrl = masterCfg.frameAssetUrl;
      cfg.logoAssetUrl = masterCfg.logoAssetUrl || cfg.logoAssetUrl;
      if (masterCfg.kopConfig) {
        cfg.kopConfig = {
          ...masterCfg.kopConfig,
          ...(cfg.kopConfig || {}),
          frameAssetUrl: masterCfg.kopConfig.frameAssetUrl || cfg.kopConfig?.frameAssetUrl,
          logo: masterCfg.kopConfig.logo || cfg.kopConfig?.logo || {
            enabled: true,
            x: 56,
            y: 44,
            width: 220,
            height: 48,
          },
        };
      }
    }
    return cfg;
  }, [currentTemplate, masterTplWithFrame]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdDocInfo, setCreatedDocInfo] = useState<{ id: string; number: string; status: string } | null>(null);
  const [importedTaskInfo, setImportedTaskInfo] = useState<{
    docNumber: string;
    eventName: string;
    studentCount: number;
    totalCourses: number;
  } | null>(null);
  const [isPreloadingTask, setIsPreloadingTask] = useState(false);

  // Preload from Surat Tugas on Mount
  useEffect(() => {
    if (fromSuratTugasId) {
      setIsPreloadingTask(true);
      getSuratTugasDispensationPreloadAction(fromSuratTugasId)
        .then((res) => {
          if (res.success && res.preloadData) {
            setFormData((prev) => ({
              ...prev,
              ...res.preloadData,
            }));

            const students = res.preloadData.dispensation_assignees || [];
            const courseCount = students.reduce((sum: number, s: any) => {
              return sum + (s.courses || []).filter((c: any) => c.selected !== false).length;
            }, 0);

            setImportedTaskInfo({
              docNumber: res.preloadData.source_surat_tugas_number || '',
              eventName: res.preloadData.event_name || '',
              studentCount: students.length,
              totalCourses: courseCount,
            });

            if (dispTemplate) {
              setSelectedTemplateId(dispTemplate.id);
            }
            setSelectedCategory('DISP');
            setOrgCode('DISP');
          }
        })
        .catch((e) => {
          console.error('Error preloading Surat Tugas data:', e);
        })
        .finally(() => {
          setIsPreloadingTask(false);
        });
    }
  }, [fromSuratTugasId]);

  // When selected template changes, sync defaults and category
  useEffect(() => {
    if (currentTemplate) {
      const isDisp =
        currentTemplate.type_code === 'SURAT_DISPENSASI' ||
        currentTemplate.type_code?.includes('DISP') ||
        currentTemplate.name?.toLowerCase().includes('dispensasi');

      if (isDisp) {
        setSelectedCategory('DISP');
        setOrgCode('DISP');
      }

      setFormData((prev) => {
        // If we already have imported task data, preserve event & dispensation assignees
        if (importedTaskInfo && prev.dispensation_assignees) {
          return {
            ...getPreparedFormData(currentTemplate),
            ...prev,
          };
        }
        return getPreparedFormData(currentTemplate);
      });
    }
  }, [currentTemplate]);

  const handleFieldChange = (key: string, val: any) => {
    setFormData((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleExecute = async (mode: 'ISSUE' | 'DRAFT' | 'SUBMIT_APPROVAL') => {
    if (!currentTemplate) return;

    setIsGenerating(true);
    setGeneratingMode(mode);
    setErrorMsg(null);

    try {
      const res = await generateDocumentAction({
        template_id: currentTemplate.id,
        form_data: formData,
        custom_number: customNumber.trim() || resolvedLiveNumber.trim() || undefined,
        category_code: orgCode,
        company_code: companyCode,
        org_code: orgCode,
        signatory_id: selectedSignatoryId || undefined,
        mode,
      });

      if (res.success && res.documentId && res.documentNumber) {
        setCreatedDocInfo({
          id: res.documentId,
          number: res.documentNumber,
          status: res.status || (mode === 'ISSUE' ? 'ISSUED' : mode === 'DRAFT' ? 'DRAFT' : 'PENDING_APPROVAL'),
        });
      } else {
        setErrorMsg(res.error || 'Gagal memproses dokumen.');
      }
    } catch (err: any) {
      setIsGenerating(false);
      setGeneratingMode(null);
    }
  };

  const selectedSignatory = signatories.find((s) => s.id === selectedSignatoryId);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/documents"
              className="text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← Kembali ke Arsip Dokumen
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-2">
            <span>✍️</span> {isPrivileged ? 'Penerbitan Dokumen Resmi' : 'Pengajuan & Pembuatan Dokumen'}
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isPrivileged
              ? 'Penerbitan surat tugas & dinas resmi KIAN dengan penomoran otomatis, QR verification, dan layout A4 presisi.'
              : 'Isi formulir dan ajukan dokumen untuk ditinjau dan diterbitkan secara resmi oleh Manajemen.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {createdDocInfo ? (
            <div className="flex items-center gap-2">
              <DocumentPDFExporter
                documentNumber={createdDocInfo.number}
                documentTitle={formData.document_title || 'Dokumen_KIAN'}
              />
              <Link
                href={`/dashboard/documents/${createdDocInfo.id}`}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20"
              >
                Lihat Detail Dokumen →
              </Link>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleExecute('DRAFT')}
                disabled={isGenerating}
                className="px-4 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {isGenerating && generatingMode === 'DRAFT' ? (
                  <span className="w-3.5 h-3.5 border-2 border-zinc-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>💾</span>
                )}
                <span>Simpan Draf</span>
              </button>

              {isPrivileged ? (
                <button
                  type="button"
                  onClick={() => handleExecute('ISSUE')}
                  disabled={isGenerating}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  {isGenerating && generatingMode === 'ISSUE' ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menerbitkan Surat...</span>
                    </>
                  ) : (
                    <>
                      <span>📜</span>
                      <span>Terbitkan Dokumen Resmi</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleExecute('SUBMIT_APPROVAL')}
                  disabled={isGenerating}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
                >
                  {isGenerating && generatingMode === 'SUBMIT_APPROVAL' ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Mengajukan Dokumen...</span>
                    </>
                  ) : (
                    <>
                      <span>📨</span>
                      <span>Ajukan untuk Persetujuan</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {isPreloadingTask && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-bold flex items-center gap-2 animate-pulse">
          <span className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Sedang menyelaraskan data personil dan jadwal perkuliahan dari Surat Tugas...</span>
        </div>
      )}

      {importedTaskInfo && !isPreloadingTask && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/30 text-xs flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-base">⚡</span>
              <span className="font-black text-purple-900 dark:text-purple-200">
                Data Otomatis Diimpor dari Surat Tugas: <span className="font-mono underline">{importedTaskInfo.docNumber}</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Event: <strong>{importedTaskInfo.eventName}</strong> • Berhasil menyinkronkan <strong>{importedTaskInfo.studentCount} personil</strong> dan <strong>{importedTaskInfo.totalCourses} matakuliah</strong> yang aktif pada hari pelaksanaan event.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              ✓ Siap Disesuaikan &amp; Diterbitkan
            </span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-bold flex items-center gap-2">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {createdDocInfo && (
        <div
          className={`p-4 sm:p-5 rounded-2xl text-xs font-bold flex flex-wrap items-center justify-between gap-3 border shadow-sm ${
            createdDocInfo.status === 'ISSUED'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : createdDocInfo.status === 'PENDING_APPROVAL'
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300'
              : 'bg-zinc-500/10 border-zinc-500/30 text-zinc-700 dark:text-zinc-300'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              {createdDocInfo.status === 'ISSUED' && <span>🎉 <strong>Dokumen Berhasil Diterbitkan Secara Resmi!</strong></span>}
              {createdDocInfo.status === 'PENDING_APPROVAL' && <span>📨 <strong>Dokumen Berhasil Diajukan untuk Persetujuan!</strong></span>}
              {createdDocInfo.status === 'DRAFT' && <span>💾 <strong>Draf Dokumen Berhasil Disimpan!</strong></span>}
            </div>
            <p className="text-xs font-mono font-medium">
              Nomor Surat: <span className="font-bold underline">{createdDocInfo.number}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCreatedDocInfo(null);
                setFormData(getPreparedFormData(currentTemplate));
              }}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold hover:bg-zinc-50"
            >
              + Buat Surat Baru
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Form Setup vs Live A4 Canvas Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form & Smart Configuration */}
        <div className="lg:col-span-5 space-y-5">
          {/* Section 1: Template & Signatory Quick Picker */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>📄</span> Template &amp; Pengesahan
              </label>
              <span className="text-[10px] text-zinc-400">Langkah 1</span>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                Pilih Template Dokumen <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.type_name} - v{tpl.current_version})
                  </option>
                ))}
              </select>
            </div>

            {signatories.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                  Pejabat Penandatangan Resmi
                </label>
                <select
                  value={selectedSignatoryId}
                  onChange={(e) => setSelectedSignatoryId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100"
                >
                  {signatories.map((sig) => (
                    <option key={sig.id} value={sig.id}>
                      {sig.name} - {sig.position}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Section 2: Smart Numbering Engine */}
          {isPrivileged ? (
            <SmartNumberingWidget
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              customNumber={customNumber}
              onCustomNumberChange={setCustomNumber}
              companyCode={companyCode}
              onCompanyCodeChange={setCompanyCode}
              orgCode={orgCode}
              onOrgCodeChange={setOrgCode}
              onNumberResolved={setResolvedLiveNumber}
            />
          ) : (
            <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-200 dark:border-purple-800/40 text-xs text-purple-700 dark:text-purple-300 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>ℹ️</span> Alur Pengajuan Surat Resmi
              </div>
              <p className="text-[11px]">
                Dokumen yang diajukan akan ditinjau oleh Manajemen. Nomor resmi dengan format standar <code className="font-bold">001/KIAN/TROOPERS/IX/2026</code> akan dialokasikan secara otomatis saat surat disetujui.
              </p>
            </div>
          )}

          {/* Section 3: Dynamic Form Inputs */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-xs font-black text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>📝</span> Formulir Isi Dokumen
              </h3>
              <span className="text-[10px] text-zinc-400">Langkah 2</span>
            </div>

            <DynamicDocumentForm
              schema={currentTemplate?.form_schema || []}
              formData={formData}
              onChange={handleFieldChange}
              annexThreshold={currentTemplate?.layout_config?.annexThresholdRows ?? 4}
              tableColumns={currentTemplate?.layout_config?.tableColumns}
            />
          </div>
        </div>

        {/* Right Column: Live A4 Canvas Preview */}
        <div className="lg:col-span-7 space-y-3 sticky top-4">
          <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span>👁️</span> Live Preview Dokumen (A4)
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Presisi Format Cetak PDF
            </span>
          </div>

          <DocumentPreviewContainer defaultMode="fit" showToolbar>
            <DocumentCanvas
              formData={{
                ...formData,
                document_number:
                  customNumber ||
                  resolvedLiveNumber ||
                  formData.document_number ||
                  (isPrivileged ? '001/KIAN/TROOPERS/IX/2026' : 'DRAF/PENGAJUAN'),
                status: isPrivileged ? 'ISSUED' : 'PENDING_APPROVAL',
              }}
              layoutConfig={effectiveLayoutConfig}
              signatory={
                selectedSignatory
                  ? {
                      name: selectedSignatory.name,
                      position: selectedSignatory.position,
                      signature_url: selectedSignatory.signature_url,
                      stamp_url: selectedSignatory.stamp_url,
                    }
                  : undefined
              }
            />
          </DocumentPreviewContainer>
        </div>
      </div>
    </div>
  );
};

