'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CustomKopTextElement,
  DocumentTemplateItem,
  DocumentTypeItem,
  FlowSectionConfig,
  FormFieldSchema,
  KopSuratConfig,
  SignatureStampConfig,
  TemplateLayoutConfig,
} from '../documentTypes';
import {
  createTemplateAction,
  updateTemplateAction,
} from '../templateActions';
import { getDocumentTypesAction } from '../documentTypeActions';
import { DocumentCanvas } from './DocumentCanvas';
import { DocumentPreviewContainer } from './DocumentPreviewContainer';
import { DocumentTypeManagerModal } from './DocumentTypeManagerModal';
import {
  DEFAULT_SURAT_TUGAS_LAYOUT,
  DEFAULT_SURAT_TUGAS_SCHEMA,
  DEFAULT_SURAT_TUGAS_VALUES,
  getDefaultTemplateForType,
} from '../defaultTemplates';

interface TemplateBuilderProps {
  initialTemplate?: DocumentTemplateItem | null;
  documentTypes: DocumentTypeItem[];
}

const AVAILABLE_FONTS = [
  { label: 'Times New Roman (Klasik / Resmi)', value: "'Times New Roman', Times, serif" },
  { label: 'Arial (Modern Sans)', value: 'Arial, sans-serif' },
  { label: 'Helvetica (Clean)', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Georgia (Serif Elegan)', value: 'Georgia, serif' },
  { label: 'Inter (UI Modern)', value: 'Inter, sans-serif' },
  { label: 'Roboto (Google Standard)', value: 'Roboto, sans-serif' },
  { label: 'Montserrat (Geometric)', value: 'Montserrat, sans-serif' },
  { label: 'Courier New (Monospace / Ketik)', value: "'Courier New', Courier, monospace" },
];

export const TemplateBuilder: React.FC<TemplateBuilderProps> = ({
  initialTemplate,
  documentTypes = [],
}) => {
  const router = useRouter();
  const isEditing = Boolean(initialTemplate?.id);

  // Document Types List state
  const [docTypesList, setDocTypesList] = useState<DocumentTypeItem[]>(documentTypes);
  const [isTypeManagerOpen, setIsTypeManagerOpen] = useState(false);

  // Form State
  const [name, setName] = useState(initialTemplate?.name || 'Surat Tugas KIAN Troopers');
  const [description, setDescription] = useState(initialTemplate?.description || '');
  const [typeId, setTypeId] = useState(initialTemplate?.type_id || documentTypes[0]?.id || 'doctype_surat_tugas');
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE'>(initialTemplate?.status === 'DRAFT' ? 'DRAFT' : 'ACTIVE');

  // Layout & Schema Config
  const [layoutConfig, setLayoutConfig] = useState<TemplateLayoutConfig>(
    initialTemplate?.layout_config || DEFAULT_SURAT_TUGAS_LAYOUT
  );
  const [formSchema, setFormSchema] = useState<FormFieldSchema[]>(
    initialTemplate?.form_schema || DEFAULT_SURAT_TUGAS_SCHEMA
  );
  const [defaultValues, setDefaultValues] = useState<Record<string, any>>(
    initialTemplate?.default_values || DEFAULT_SURAT_TUGAS_VALUES
  );

  // Sample data for previewing live canvas in builder
  const [previewData, setPreviewData] = useState<Record<string, any>>(
    initialTemplate?.sample_data || defaultValues
  );

  const [activeTab, setActiveTab] = useState<'KOP_SURAT' | 'SECTIONS' | 'TYPOGRAPHY' | 'SIGNATURE' | 'INFO' | 'LAYOUT' | 'DEFAULTS'>('KOP_SURAT');
  const [selectedKopElement, setSelectedKopElement] = useState<string | null>('logo');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reload document types when updated via modal
  const handleTypesUpdated = async () => {
    try {
      const refreshed = await getDocumentTypesAction(true);
      setDocTypesList(refreshed);
    } catch (e) {
      console.error('Failed to refresh document types:', e);
    }
  };

  // Helper to apply starter preset for a document type
  const handleApplyPreset = (targetTypeId?: string) => {
    const selectedDt = docTypesList.find((d) => d.id === (targetTypeId || typeId));
    if (!selectedDt) return;

    const preset = getDefaultTemplateForType(selectedDt.code);
    if (confirm(`Terapkan susunan layout & formulir default untuk "${selectedDt.name}"? Perubahan yang belum disimpan akan digantikan dengan format standar ${selectedDt.name}.`)) {
      setLayoutConfig(preset.layout_config);
      setFormSchema(preset.form_schema);
      setDefaultValues(preset.default_values);
      setPreviewData(preset.sample_data);
      if (!isEditing) {
        setName(preset.name);
      }
    }
  };

  // Flow Sections Handlers
  const flowSections: FlowSectionConfig[] = layoutConfig.flowSections && layoutConfig.flowSections.length > 0
    ? layoutConfig.flowSections
    : DEFAULT_SURAT_TUGAS_LAYOUT.flowSections;

  const handleUpdateFlowSections = (newSections: FlowSectionConfig[]) => {
    setLayoutConfig((prev) => ({
      ...prev,
      flowSections: newSections,
    }));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= flowSections.length) return;
    const list = [...flowSections];
    const [removed] = list.splice(index, 1);
    list.splice(targetIdx, 0, removed);
    handleUpdateFlowSections(list);
  };

  const handleToggleSectionVisible = (index: number) => {
    const list = [...flowSections];
    list[index] = { ...list[index], visible: !list[index].visible };
    handleUpdateFlowSections(list);
  };

  const handleDeleteSection = (index: number) => {
    const list = flowSections.filter((_, i) => i !== index);
    handleUpdateFlowSections(list);
  };

  const handleAddSection = (type: FlowSectionConfig['type']) => {
    const newId = `sec_${Date.now()}`;
    let newSec: FlowSectionConfig = {
      id: newId,
      type,
      visible: true,
      spacingBottomMm: 6,
    };

    if (type === 'RECIPIENT_BLOCK') {
      newSec.title = 'Tujuan / Penerima Surat';
      newSec.contentKey = 'recipient_info';
      newSec.content = 'Kepada Yth.\nBapak/Ibu Pimpinan\ndi Tempat';
      if (!previewData.recipient_info) {
        setPreviewData((p) => ({ ...p, recipient_info: newSec.content }));
      }
    } else if (type === 'PARAGRAPH') {
      newSec.title = 'Paragraf Isi Surat';
      newSec.contentKey = `body_text_${Date.now()}`;
      newSec.content = 'Sehubungan dengan hal tersebut, bersama surat ini kami sampaikan bahwa...';
      setPreviewData((p) => ({ ...p, [newSec.contentKey!]: newSec.content }));
    } else if (type === 'KEY_VALUE_GRID') {
      newSec.title = 'Rincian Informasi / Grid';
      newSec.contentKey = 'details';
    } else if (type === 'ASSIGNEE_TABLE') {
      newSec.title = 'Tabel Personil / Kru';
      newSec.contentKey = 'assignees';
    } else if (type === 'REPEATABLE_LIST') {
      newSec.title = 'Poin-Poin Pernyataan';
      newSec.contentKey = 'statement_points';
      if (!previewData.statement_points) {
        setPreviewData((p) => ({
          ...p,
          statement_points: [
            '1. Seluruh data yang tercantum dalam dokumen ini adalah benar dan dapat dipertanggungjawabkan.',
            '2. Bersedia mematuhi ketentuan dan SOP KIAN Troopers yang berlaku.',
          ],
        }));
      }
    } else if (type === 'DIVIDER') {
      newSec.title = 'Garis Pemisah';
    } else if (type === 'SIGNATURE_BLOCK') {
      newSec.title = 'Blok Tanda Tangan & Cap';
    } else if (type === 'TEMBUSAN_BLOCK') {
      newSec.title = 'Tembusan (CC)';
      newSec.contentKey = 'cc_list';
    }

    handleUpdateFlowSections([...flowSections, newSec]);
  };

  const handleEditSection = (index: number, updates: Partial<FlowSectionConfig>) => {
    const list = [...flowSections];
    list[index] = { ...list[index], ...updates };
    handleUpdateFlowSections(list);
  };

  const kopConfig: KopSuratConfig = layoutConfig.kopConfig || {
    frameAssetUrl: '',
    frameOpacity: 1,
    kopHeightPx: 215,
    logo: {
      enabled: true,
      x: 56,
      y: 44,
      width: 220,
      height: 48,
    },
    titleBlock: {
      enabled: true,
      x: 56,
      y: 138,
      width: 682,
      align: 'center',
      titleFontSizePt: 13,
      numberFontSizePt: 10,
    },
    customTexts: [],
  };

  const sigConfig: SignatureStampConfig = layoutConfig.signatureConfig || {
    align: 'right',
    showStamp: true,
    stampScale: 1,
    stampOffsetX: -12,
    stampOffsetY: 0,
    stampOpacity: 0.85,
    stampRotation: 0,
    signatureScale: 1,
    signatureOffsetX: 0,
    signatureOffsetY: 0,
  };

  const handleKopChange = (newKop: KopSuratConfig) => {
    setLayoutConfig((prev) => ({
      ...prev,
      kopConfig: newKop,
    }));
  };

  const handleSigChange = (newSig: SignatureStampConfig) => {
    setLayoutConfig((prev) => ({
      ...prev,
      signatureConfig: newSig,
    }));
  };

  // Upload custom frame PNG/JPG
  const handleUploadFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran file frame maksimal 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        frameAssetUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload custom logo PNG/JPG
  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        logo: {
          ...kopConfig.logo,
          assetUrl: base64,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload custom stamp PNG
  const handleUploadStamp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleSigChange({
        ...sigConfig,
        stampAssetUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  // Upload custom signature PNG
  const handleUploadSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      handleSigChange({
        ...sigConfig,
        signatureAssetUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  // Custom Text element handlers for Kop Surat (Website, Alamat, No SK, etc.)
  const handleAddCustomText = () => {
    const newId = `ct_${Date.now()}`;
    const newCustomText: CustomKopTextElement = {
      id: newId,
      name: 'Teks Baru (Alamat / Website)',
      text: 'www.kianorganizer.com | Jl. Dewi Sartika No.289, Jakarta',
      x: 56,
      y: Math.min(kopConfig.kopHeightPx - 25, 115),
      fontSizePt: 8.5,
      fontFamily: layoutConfig.fontFamily || 'Arial, sans-serif',
      color: '#4B5563',
      align: 'left',
      fontWeight: 'normal',
    };

    const updatedList = [...(kopConfig.customTexts || []), newCustomText];
    handleKopChange({
      ...kopConfig,
      customTexts: updatedList,
    });
    setSelectedKopElement(`customText_${newId}`);
  };

  const handleUpdateCustomText = (id: string, updates: Partial<CustomKopTextElement>) => {
    const updatedList = (kopConfig.customTexts || []).map((item) => {
      if (item.id === id) {
        return { ...item, ...updates };
      }
      return item;
    });
    handleKopChange({
      ...kopConfig,
      customTexts: updatedList,
    });
  };

  const handleDeleteCustomText = (id: string) => {
    const updatedList = (kopConfig.customTexts || []).filter((item) => item.id !== id);
    handleKopChange({
      ...kopConfig,
      customTexts: updatedList,
    });
    if (selectedKopElement === `customText_${id}`) {
      setSelectedKopElement('logo');
    }
  };

  const handleResetKopLayout = () => {
    if (!confirm('Kembalikan posisi Kop Surat ke default standar KIAN?')) return;
    handleKopChange({
      ...kopConfig,
      kopHeightPx: 215,
      logo: {
        enabled: true,
        assetUrl: kopConfig.logo.assetUrl,
        x: 56,
        y: 44,
        width: 220,
        height: 48,
      },
      titleBlock: {
        enabled: true,
        x: 56,
        y: 138,
        width: 682,
        align: 'center',
        titleFontSizePt: 13,
        numberFontSizePt: 10,
      },
      customTexts: [],
    });
  };

  const handleSaveTemplate = async () => {
    if (!name.trim()) {
      setMessage({ type: 'error', text: 'Nama template wajib diisi.' });
      return;
    }
    if (!typeId) {
      setMessage({ type: 'error', text: 'Pilih jenis dokumen terlebih dahulu.' });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      if (isEditing && initialTemplate) {
        const res = await updateTemplateAction(initialTemplate.id, {
          name,
          description,
          status,
          layout_config: layoutConfig,
          form_schema: formSchema,
          default_values: defaultValues,
          sample_data: previewData,
          forceNewVersion: true,
        });

        if (res.success) {
          setMessage({
            type: 'success',
            text: `Template berhasil diperbarui ke Versi ${res.newVersion || initialTemplate.current_version + 1}!`,
          });
          setTimeout(() => {
            router.push('/dashboard/documents/templates');
            router.refresh();
          }, 1200);
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal menyimpan template.' });
        }
      } else {
        const res = await createTemplateAction({
          name,
          description,
          type_id: typeId,
          status,
          layout_config: layoutConfig,
          form_schema: formSchema,
          default_values: defaultValues,
          sample_data: previewData,
        });

        if (res.success) {
          setMessage({ type: 'success', text: 'Template baru berhasil dibuat (v1)!' });
          setTimeout(() => {
            router.push('/dashboard/documents/templates');
            router.refresh();
          }, 1200);
        } else {
          setMessage({ type: 'error', text: res.error || 'Gagal membuat template.' });
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <span>🎨</span>
            <span>{isEditing ? `Edit Template: ${initialTemplate?.name}` : 'Buat Template Dokumen Baru'}</span>
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isEditing
              ? `Versi saat ini: v${initialTemplate?.current_version} • Perubahan disimpan sebagai versi baru tanpa merusak dokumen lama.`
              : 'Atur frame, custom logo, teks kop surat (alamat/web), font family, font size, stempel & tanda tangan.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>{isEditing ? 'Simpan Versi Baru' : 'Publikasikan Template'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
              : 'bg-red-500/10 border border-red-500/30 text-red-500'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Template Config Inspector */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
          {/* Tab Selector */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl overflow-x-auto">
            {[
              { id: 'KOP_SURAT', label: '📐 Kop & Teks' },
              { id: 'SECTIONS', label: '📑 Isi Konten' },
              { id: 'TYPOGRAPHY', label: '🔤 Font & Ukuran' },
              { id: 'SIGNATURE', label: '🖋️ TTD & Cap' },
              { id: 'INFO', label: 'ℹ️ Info' },
              { id: 'LAYOUT', label: '📄 Lampiran' },
              { id: 'DEFAULTS', label: '📝 Default' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as any)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* TAB 1: KOP SURAT & CUSTOM TEXTS */}
          {activeTab === 'KOP_SURAT' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                ✨ <strong>Drag &amp; Drop Interaktif:</strong> Klik &amp; geser <strong>Logo</strong>, <strong>Judul Surat</strong>, atau <strong>Teks Tambahan</strong> langsung pada Canvas A4 di sebelah kanan!
              </div>

              {/* 1. Upload Custom Frame Background */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>🖼️</span> Frame Background Dokumen (PNG/JPG)
                  </label>
                  {kopConfig.frameAssetUrl && (
                    <button
                      type="button"
                      onClick={() => handleKopChange({ ...kopConfig, frameAssetUrl: '' })}
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Hapus Frame Custom
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleUploadFrame}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
              </div>

              {/* 2. Upload Custom Logo */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>👑</span> Logo Kop Surat
                  </label>
                  {kopConfig.logo.assetUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        handleKopChange({
                          ...kopConfig,
                          logo: { ...kopConfig.logo, assetUrl: undefined },
                        })
                      }
                      className="text-[10px] text-red-500 hover:underline font-bold"
                    >
                      Reset Logo Vektor
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={handleUploadLogo}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
                />
              </div>

              {/* 3. ADD CUSTOM TEXT BLOCKS (ALAMAT, WEBSITE, NO TELP, DLL) */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                      <span>🏷️</span> Teks Tambahan Kop (Alamat, Web, dsb.)
                    </label>
                    <p className="text-[10px] text-indigo-600/80 dark:text-indigo-300/80">
                      Tambahkan teks bebas yang bisa digeser, diatur lebar maksimal, dan diformat.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomText}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] transition-all shadow-xs"
                  >
                    + Tambah Teks
                  </button>
                </div>

                {/* Custom texts list */}
                <div className="space-y-3">
                  {(kopConfig.customTexts || []).length === 0 ? (
                    <p className="text-[10px] text-zinc-400 italic text-center py-2">
                      Belum ada teks tambahan. Klik &quot;+ Tambah Teks&quot; untuk menambahkan website/alamat perusahaan.
                    </p>
                  ) : (
                    (kopConfig.customTexts || []).map((ct) => (
                      <div
                        key={ct.id}
                        onClick={() => setSelectedKopElement(`customText_${ct.id}`)}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 ${
                          selectedKopElement === `customText_${ct.id}`
                            ? 'border-indigo-500 bg-white dark:bg-zinc-900 ring-2 ring-indigo-500/30 shadow-md'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <input
                            type="text"
                            value={ct.name}
                            onChange={(e) => handleUpdateCustomText(ct.id, { name: e.target.value })}
                            className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-transparent border-0 p-0 focus:ring-0"
                            placeholder="Label (contoh: Alamat)"
                          />
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                              X:{ct.x} Y:{ct.y}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteCustomText(ct.id);
                              }}
                              className="text-red-500 hover:text-red-700 text-xs font-bold p-0.5"
                              title="Hapus Teks Ini"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <textarea
                          value={ct.text}
                          onChange={(e) => handleUpdateCustomText(ct.id, { text: e.target.value })}
                          rows={2}
                          placeholder="Ketik isi teks di sini..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-none font-sans"
                        />

                        {/* Max Width Controls */}
                        <div className="p-2 bg-zinc-50 dark:bg-zinc-800/70 rounded-lg border border-zinc-200 dark:border-zinc-700/60 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">
                              Maksimal Lebar Teks (Max Width)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-purple-600">
                                {ct.width ? `${ct.width} px` : 'Auto'}
                              </span>
                              {ct.width && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateCustomText(ct.id, { width: undefined });
                                  }}
                                  className="text-[9px] text-zinc-400 hover:text-zinc-700 underline"
                                >
                                  Reset Auto
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={100}
                              max={680}
                              step={10}
                              value={ct.width || 680}
                              onChange={(e) =>
                                handleUpdateCustomText(ct.id, { width: parseInt(e.target.value, 10) })
                              }
                              className="flex-1 accent-indigo-600 cursor-pointer"
                            />
                            <input
                              type="number"
                              min={50}
                              max={700}
                              value={ct.width || ''}
                              placeholder="Auto"
                              onChange={(e) =>
                                handleUpdateCustomText(ct.id, {
                                  width: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                })
                              }
                              className="w-16 px-1.5 py-0.5 text-right rounded border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono"
                            />
                          </div>
                        </div>

                        {/* Text Styling & Attributes */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="text-[9px] text-zinc-500">Ukuran (pt)</label>
                            <input
                              type="number"
                              step={0.5}
                              value={ct.fontSizePt}
                              onChange={(e) => handleUpdateCustomText(ct.id, { fontSizePt: parseFloat(e.target.value) || 8.5 })}
                              className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500">Warna Teks</label>
                            <input
                              type="color"
                              value={ct.color || '#333333'}
                              onChange={(e) => handleUpdateCustomText(ct.id, { color: e.target.value })}
                              className="w-full h-7 p-0.5 rounded border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500">Font</label>
                            <select
                              value={ct.fontFamily || layoutConfig.fontFamily}
                              onChange={(e) => handleUpdateCustomText(ct.id, { fontFamily: e.target.value })}
                              className="w-full px-1.5 py-1 rounded border border-zinc-200 dark:border-zinc-700 text-[10px]"
                            >
                              {AVAILABLE_FONTS.map((f) => (
                                <option key={f.value} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] text-zinc-500">Format</label>
                            <div className="flex items-center gap-1 mt-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCustomText(ct.id, {
                                    fontWeight: ct.fontWeight === 'bold' ? 'normal' : 'bold',
                                  });
                                }}
                                className={`flex-1 py-1 text-[10px] font-bold rounded border transition-all ${
                                  ct.fontWeight === 'bold'
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                B
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCustomText(ct.id, { isItalic: !ct.isItalic });
                                }}
                                className={`flex-1 py-1 text-[10px] italic font-serif rounded border transition-all ${
                                  ct.isItalic
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                I
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCustomText(ct.id, { isUnderline: !ct.isUnderline });
                                }}
                                className={`flex-1 py-1 text-[10px] underline font-bold rounded border transition-all ${
                                  ct.isUnderline
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                U
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 4. SAFE ZONE MARGIN KIRI & KANAN KONTEN DINAMIS */}
              <div className="p-3.5 bg-purple-50/60 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                    <span>📐</span> Margin Konten Dinamis (Safe Zone)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutConfig((prev) => ({
                        ...prev,
                        contentPaddingLeftPx: 56,
                        contentPaddingRightPx: 56,
                        paddingMm: { ...prev.paddingMm, left: 15, right: 15 },
                      }));
                    }}
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                  >
                    ↺ Reset 56px
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Left Margin */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Margin Kiri ({layoutConfig.contentPaddingLeftPx ?? 56}px)
                      </label>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={layoutConfig.contentPaddingLeftPx ?? 56}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentPaddingLeftPx: val,
                          paddingMm: { ...prev.paddingMm, left: Math.round(val / 3.78) },
                        }));
                      }}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>

                  {/* Right Margin */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                        Margin Kanan ({layoutConfig.contentPaddingRightPx ?? 56}px)
                      </label>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={layoutConfig.contentPaddingRightPx ?? 56}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentPaddingRightPx: val,
                          paddingMm: { ...prev.paddingMm, right: Math.round(val / 3.78) },
                        }));
                      }}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Kop Elements Coordinate Inspector */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                    Posisi Presisi Logo &amp; Judul
                  </span>
                  <button
                    type="button"
                    onClick={handleResetKopLayout}
                    className="text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-bold"
                  >
                    ↺ Reset Posisi
                  </button>
                </div>

                {/* LOGO INSPECTOR */}
                <div
                  onClick={() => setSelectedKopElement('logo')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKopElement === 'logo'
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Logo Header
                    </span>
                    <span className="text-[10px] text-purple-600 font-mono">
                      X: {kopConfig.logo.x}px | Y: {kopConfig.logo.y}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi X (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.x}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, x: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi Y (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.y}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, y: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Lebar (px)</label>
                      <input
                        type="number"
                        value={kopConfig.logo.width}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            logo: { ...kopConfig.logo, width: parseInt(e.target.value, 10) || 100 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* TITLE & NUMBER INSPECTOR */}
                <div
                  onClick={() => setSelectedKopElement('titleBlock')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    selectedKopElement === 'titleBlock'
                      ? 'border-purple-500 bg-purple-500/5 ring-1 ring-purple-500'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      Blok Judul &amp; Nomor Surat
                    </span>
                    <span className="text-[10px] text-purple-600 font-mono">
                      Y: {kopConfig.titleBlock.y}px
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500">Posisi Y (px)</label>
                      <input
                        type="number"
                        value={kopConfig.titleBlock.y}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, y: parseInt(e.target.value, 10) || 0 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Alignment</label>
                      <select
                        value={kopConfig.titleBlock.align}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, align: e.target.value as any },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      >
                        <option value="center">Tengah (Center)</option>
                        <option value="left">Kiri (Left)</option>
                        <option value="right">Kanan (Right)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500">Ukuran Judul (pt)</label>
                      <input
                        type="number"
                        value={kopConfig.titleBlock.titleFontSizePt}
                        onChange={(e) =>
                          handleKopChange({
                            ...kopConfig,
                            titleBlock: { ...kopConfig.titleBlock, titleFontSizePt: parseInt(e.target.value, 10) || 12 },
                          })
                        }
                        className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* FLOW START LIMIT HEIGHT */}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Tinggi Kop Surat / Batas Awal Konten Dinamis
                    </label>
                    <span className="text-xs font-mono font-bold text-purple-600">
                      {kopConfig.kopHeightPx} px
                    </span>
                  </div>
                  <input
                    type="range"
                    min={140}
                    max={400}
                    value={kopConfig.kopHeightPx}
                    onChange={(e) =>
                      handleKopChange({
                        ...kopConfig,
                        kopHeightPx: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: SECTIONS & DYNAMIC CONTENT BUILDER */}
          {activeTab === 'SECTIONS' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl text-[11px] text-purple-700 dark:text-purple-300">
                ✨ <strong>Struktur &amp; Isi Konten Dinamis:</strong> Atur urutan blok konten dokumen (Paragraf, Grid Rincian, Tabel Personil, Poin-Poin, Penerima Surat).
              </div>

              {/* Add New Section Buttons */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>➕</span> Tambah Blok Konten Baru
                  </label>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset()}
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                  >
                    ↺ Terapkan Preset Standar
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddSection('RECIPIENT_BLOCK')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>👤</span> Penerima Yth
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('PARAGRAPH')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📝</span> Paragraf Bebas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('KEY_VALUE_GRID')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📋</span> Grid Rincian
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('ASSIGNEE_TABLE')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>👥</span> Tabel Personil
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('REPEATABLE_LIST')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📑</span> Poin / List
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('DIVIDER')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>➖</span> Garis Pemisah
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('SIGNATURE_BLOCK')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>🖋️</span> Tanda Tangan
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('TEMBUSAN_BLOCK')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📄</span> Tembusan (CC)
                  </button>
                </div>
              </div>

              {/* Sections List */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">
                  Daftar Blok Konten ({flowSections.length})
                </span>

                {flowSections.map((sec, idx) => {
                  const typeLabel =
                    sec.type === 'RECIPIENT_BLOCK'
                      ? '👤 Penerima Surat (Kepada Yth)'
                      : sec.type === 'INTRO_TEXT'
                      ? '📝 Kalimat Pembuka'
                      : sec.type === 'PARAGRAPH' || sec.type === 'CUSTOM_PARAGRAPH'
                      ? '📝 Paragraf Isi'
                      : sec.type === 'CLOSING_TEXT'
                      ? '📝 Kalimat Penutup'
                      : sec.type === 'KEY_VALUE_GRID' || sec.type === 'EVENT_DETAILS'
                      ? '📋 Grid Rincian / Detail'
                      : sec.type === 'ASSIGNEE_TABLE'
                      ? '👥 Tabel Personil / Kru'
                      : sec.type === 'REPEATABLE_LIST'
                      ? '📑 Poin-Poin Pernyataan'
                      : sec.type === 'DIVIDER'
                      ? '➖ Garis Pemisah'
                      : sec.type === 'SIGNATURE_BLOCK'
                      ? '🖋️ Blok Tanda Tangan & Cap'
                      : sec.type === 'TEMBUSAN_BLOCK'
                      ? '📄 Tembusan (CC)'
                      : sec.type;

                  return (
                    <div
                      key={sec.id || idx}
                      className={`p-3.5 rounded-2xl border transition-all space-y-3 ${
                        sec.visible !== false
                          ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xs'
                          : 'bg-zinc-100/50 dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-800 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 px-1.5 py-0.5 rounded">
                            #{idx + 1}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                            {typeLabel}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                            title="Pindah ke Atas"
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'down')}
                            disabled={idx === flowSections.length - 1}
                            className="p-1 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30"
                            title="Pindah ke Bawah"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleSectionVisible(idx)}
                            className="p-1 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title={sec.visible !== false ? 'Sembunyikan' : 'Tampilkan'}
                          >
                            {sec.visible !== false ? '👁️' : '🙈'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(idx)}
                            className="p-1 text-xs rounded hover:bg-red-500/10 text-red-500"
                            title="Hapus Blok"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Content editor if applicable */}
                      {(sec.type === 'RECIPIENT_BLOCK' ||
                        sec.type === 'INTRO_TEXT' ||
                        sec.type === 'PARAGRAPH' ||
                        sec.type === 'CUSTOM_PARAGRAPH' ||
                        sec.type === 'CLOSING_TEXT') && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-500">
                            Template Teks / Isi Konten (Dapat memuat tag &#123;placeholder&#125;)
                          </label>
                          <textarea
                            rows={2}
                            value={
                              (sec.contentKey && previewData[sec.contentKey]) ||
                              previewData[sec.id] ||
                              sec.content ||
                              (sec.type === 'INTRO_TEXT' ? previewData.intro_text || '' : '') ||
                              (sec.type === 'CLOSING_TEXT' ? previewData.closing_text || '' : '') ||
                              (sec.type === 'RECIPIENT_BLOCK' ? previewData.recipient_info || '' : '')
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              handleEditSection(idx, { content: val });
                              const targetKey = sec.contentKey || sec.id || (sec.type === 'INTRO_TEXT' ? 'intro_text' : sec.type === 'CLOSING_TEXT' ? 'closing_text' : 'recipient_info');
                              setPreviewData((prev) => ({ ...prev, [targetKey]: val }));
                              setDefaultValues((prev) => ({ ...prev, [targetKey]: val }));
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-y font-sans"
                            placeholder="Tuliskan teks konten di sini..."
                          />
                        </div>
                      )}

                      {/* Spacing control */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
                        <span>Jarak Bawah: {sec.spacingBottomMm ?? 6} mm</span>
                        <input
                          type="range"
                          min={0}
                          max={20}
                          step={1}
                          value={sec.spacingBottomMm ?? 6}
                          onChange={(e) =>
                            handleEditSection(idx, { spacingBottomMm: parseInt(e.target.value, 10) })
                          }
                          className="w-32 accent-purple-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: TYPOGRAPHY (FONT & UKURAN TEKS UNTUK SEMUA ELEMENT) */}
          {activeTab === 'TYPOGRAPHY' && (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Tipografi Isi Dokumen (Body Text)
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Jenis Font Utama
                  </label>
                  <select
                    value={layoutConfig.fontFamily || "'Times New Roman', Times, serif"}
                    onChange={(e) =>
                      setLayoutConfig({
                        ...layoutConfig,
                        fontFamily: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Ukuran Teks Utama (pt)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={8}
                      max={16}
                      value={layoutConfig.fontSizeBasePt || 10.5}
                      onChange={(e) =>
                        setLayoutConfig({
                          ...layoutConfig,
                          fontSizeBasePt: parseFloat(e.target.value) || 10.5,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      Ukuran Teks Tabel (pt)
                    </label>
                    <input
                      type="number"
                      step={0.5}
                      min={7}
                      max={14}
                      value={layoutConfig.tableFontSizePt || 9.5}
                      onChange={(e) =>
                        setLayoutConfig({
                          ...layoutConfig,
                          tableFontSizePt: parseFloat(e.target.value) || 9.5,
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                  Tipografi Tabel Petugas
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Jenis Font Tabel
                  </label>
                  <select
                    value={layoutConfig.tableFontFamily || layoutConfig.fontFamily || "'Times New Roman', Times, serif"}
                    onChange={(e) =>
                      setLayoutConfig({
                        ...layoutConfig,
                        tableFontFamily: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
                  >
                    {AVAILABLE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SIGNATURE & STAMP CUSTOMIZATION */}
          {activeTab === 'SIGNATURE' && (
            <div className="space-y-4">
              {/* PRESET MODE SELECTOR */}
              <div className="p-3.5 bg-purple-500/10 dark:bg-purple-950/30 rounded-xl border border-purple-500/20 space-y-2">
                <span className="text-xs font-black text-purple-900 dark:text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span>⚡</span> Pilihan Format / Mode Pengesahan
                </span>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  Pilih mode tanda tangan dan stempel resmi yang akan ditampilkan pada dokumen:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      handleSigChange({
                        ...sigConfig,
                        showSignature: true,
                        showStamp: true,
                        showQrVerification: false,
                        signatureType: 'MANUAL',
                      })
                    }
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      sigConfig.showSignature && !sigConfig.showQrVerification
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                    }`}
                  >
                    <span>🖋️</span>
                    <span className="block text-[10px] mt-0.5">TTD Manual + Cap</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSigChange({
                        ...sigConfig,
                        showSignature: false,
                        showStamp: false,
                        showQrVerification: true,
                        signatureType: 'DIGITAL_QR',
                      })
                    }
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      !sigConfig.showSignature && sigConfig.showQrVerification
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                    }`}
                  >
                    <span>📱</span>
                    <span className="block text-[10px] mt-0.5">TTD Digital (QR)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleSigChange({
                        ...sigConfig,
                        showSignature: true,
                        showStamp: true,
                        showQrVerification: true,
                        signatureType: 'BOTH',
                      })
                    }
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      sigConfig.showSignature && sigConfig.showQrVerification
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/20'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400'
                    }`}
                  >
                    <span>✨</span>
                    <span className="block text-[10px] mt-0.5">Kombinasi (Semua)</span>
                  </button>
                </div>
              </div>

              {/* 1. TTD DIGITAL (QR CODE VERIFIKASI DENGAN LOGO KIAN) */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                      <span>📱</span> TTD Digital Resmi (QR Code Berlogo KIAN)
                    </label>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      QR Code publik untuk verifikasi keaslian surat tugas oleh orang tua atau pihak eksternal.
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={Boolean(sigConfig.showQrVerification)}
                      onChange={(e) =>
                        handleSigChange({
                          ...sigConfig,
                          showQrVerification: e.target.checked,
                          signatureType: e.target.checked
                            ? sigConfig.showSignature
                              ? 'BOTH'
                              : 'DIGITAL_QR'
                            : 'MANUAL',
                        })
                      }
                      className="rounded text-purple-600"
                    />
                    <span>Aktifkan QR</span>
                  </label>
                </div>

                {sigConfig.showQrVerification && (
                  <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 text-xs space-y-1">
                      <p className="font-bold flex items-center gap-1 text-[11px]">
                        <span>🔍</span> Fitur Verifikasi Publik Terhubung:
                      </p>
                      <p className="text-[10.5px] leading-relaxed">
                        Ketika QR discan menggunakan kamera HP, siapapun dapat melihat halaman validasi resmi KIAN HQ lengkap dengan nama peserta &amp; rincian tugas tanpa perlu login.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
                        <span>Ukuran QR Code</span>
                        <span className="font-mono font-bold text-purple-600">{sigConfig.qrSize ?? 84} px</span>
                      </div>
                      <input
                        type="range"
                        min={64}
                        max={120}
                        step={2}
                        value={sigConfig.qrSize ?? 84}
                        onChange={(e) =>
                          handleSigChange({
                            ...sigConfig,
                            qrSize: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full accent-purple-600 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 2. SIGNATURE GRAPHIC SETTINGS */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🖋️</span> Tanda Tangan Basah / Gambar (Signature)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={sigConfig.showSignature !== false}
                      onChange={(e) =>
                        handleSigChange({
                          ...sigConfig,
                          showSignature: e.target.checked,
                          signatureType: e.target.checked
                            ? sigConfig.showQrVerification
                              ? 'BOTH'
                              : 'MANUAL'
                            : 'DIGITAL_QR',
                        })
                      }
                      className="rounded text-purple-600"
                    />
                    <span>Aktifkan TTD Gambar</span>
                  </label>
                </div>

                {sigConfig.showSignature !== false && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Upload Tanda Tangan PNG Transparan
                      </label>
                      <input
                        type="file"
                        accept="image/png, image/webp"
                        onChange={handleUploadSignature}
                        className="w-full text-xs mt-1 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500">Skala TTD ({sigConfig.signatureScale ?? 1}x)</label>
                        <input
                          type="range"
                          min={0.5}
                          max={1.8}
                          step={0.1}
                          value={sigConfig.signatureScale ?? 1}
                          onChange={(e) => handleSigChange({ ...sigConfig, signatureScale: parseFloat(e.target.value) })}
                          className="w-full accent-purple-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500">Posisi Blok TTD</label>
                        <select
                          value={sigConfig.align || 'right'}
                          onChange={(e) => handleSigChange({ ...sigConfig, align: e.target.value as any })}
                          className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs"
                        >
                          <option value="right">Kanan (Standar)</option>
                          <option value="center">Tengah</option>
                          <option value="left">Kiri</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3. STAMP SETTINGS */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>🔵</span> Stempel / Cap Resmi
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={sigConfig.showStamp}
                      onChange={(e) => handleSigChange({ ...sigConfig, showStamp: e.target.checked })}
                      className="rounded text-purple-600"
                    />
                    <span>Aktifkan Stempel</span>
                  </label>
                </div>

                {sigConfig.showStamp && (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                        Upload Gambar Stempel Custom (PNG transparan)
                      </label>
                      <input
                        type="file"
                        accept="image/png, image/webp"
                        onChange={handleUploadStamp}
                        className="w-full text-xs mt-1 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white cursor-pointer"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500">Skala Ukuran ({sigConfig.stampScale ?? 1}x)</label>
                        <input
                          type="range"
                          min={0.5}
                          max={1.8}
                          step={0.1}
                          value={sigConfig.stampScale ?? 1}
                          onChange={(e) => handleSigChange({ ...sigConfig, stampScale: parseFloat(e.target.value) })}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500">Rotasi ({sigConfig.stampRotation ?? 0}°)</label>
                        <input
                          type="range"
                          min={-30}
                          max={30}
                          step={2}
                          value={sigConfig.stampRotation ?? 0}
                          onChange={(e) => handleSigChange({ ...sigConfig, stampRotation: parseInt(e.target.value, 10) })}
                          className="w-full accent-blue-600 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-zinc-500">Offset X ({sigConfig.stampOffsetX ?? -12}px)</label>
                        <input
                          type="number"
                          value={sigConfig.stampOffsetX ?? -12}
                          onChange={(e) => handleSigChange({ ...sigConfig, stampOffsetX: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-zinc-500">Offset Y ({sigConfig.stampOffsetY ?? 0}px)</label>
                        <input
                          type="number"
                          value={sigConfig.stampOffsetY ?? 0}
                          onChange={(e) => handleSigChange({ ...sigConfig, stampOffsetY: parseInt(e.target.value, 10) || 0 })}
                          className="w-full px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB: BASIC INFO */}
          {activeTab === 'INFO' && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Nama Template <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Surat Tugas KIAN Troopers"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Jenis Dokumen (Document Type) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTypeManagerOpen(true)}
                    className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1"
                  >
                    <span>⚙️</span> Kelola / Tambah Jenis
                  </button>
                </div>
                <select
                  value={typeId}
                  onChange={(e) => {
                    const newTid = e.target.value;
                    setTypeId(newTid);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold"
                >
                  {docTypesList.map((dt) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.icon} {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-zinc-400">
                    Format penomoran: {docTypesList.find((d) => d.id === typeId)?.numbering_format || '{sequence}/...'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset()}
                    className="text-[10.5px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <span>✨</span> Terapkan Susunan Standar {docTypesList.find((d) => d.id === typeId)?.name || ''}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Status Template
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'ACTIVE'}
                      onChange={() => setStatus('ACTIVE')}
                      className="text-purple-600"
                    />
                    <span>🟢 Active</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      checked={status === 'DRAFT'}
                      onChange={() => setStatus('DRAFT')}
                      className="text-purple-600"
                    />
                    <span>🟡 Draft</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Deskripsi / Petunjuk
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Deskripsi template ini..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-medium resize-none"
                />
              </div>
            </div>
          )}

          {/* TAB: LAYOUT SETTINGS */}
          {activeTab === 'LAYOUT' && (
            <div className="space-y-4">
              {/* Safe Zone Margins */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    <span>📐</span> Margin Area Cetak Safe Zone (Kiri &amp; Kanan)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setLayoutConfig((prev) => ({
                        ...prev,
                        contentPaddingLeftPx: 56,
                        contentPaddingRightPx: 56,
                        paddingMm: { ...prev.paddingMm, left: 15, right: 15 },
                      }));
                    }}
                    className="text-[10px] text-purple-600 hover:text-purple-800 font-bold"
                  >
                    ↺ Reset 56px
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">Margin Kiri ({layoutConfig.contentPaddingLeftPx ?? 56}px)</label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={layoutConfig.contentPaddingLeftPx ?? 56}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentPaddingLeftPx: val,
                          paddingMm: { ...prev.paddingMm, left: Math.round(val / 3.78) },
                        }));
                      }}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-500">Margin Kanan ({layoutConfig.contentPaddingRightPx ?? 56}px)</label>
                    <input
                      type="range"
                      min={10}
                      max={120}
                      step={2}
                      value={layoutConfig.contentPaddingRightPx ?? 56}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentPaddingRightPx: val,
                          paddingMm: { ...prev.paddingMm, right: Math.round(val / 3.78) },
                        }));
                      }}
                      className="w-full accent-purple-600 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  Ambang Batas Lampiran Otomatis (Annex Threshold)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={layoutConfig.annexThresholdRows ?? 4}
                  onChange={(e) =>
                    setLayoutConfig({
                      ...layoutConfig,
                      annexThresholdRows: parseInt(e.target.value, 10) || 4,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-mono font-bold"
                />
                <p className="text-[10px] text-zinc-400">
                  Jika personil &ge; {layoutConfig.annexThresholdRows ?? 4}, tabel otomatis dipindahkan ke Lampiran Halaman 2+.
                </p>
              </div>
            </div>
          )}

          {/* TAB: DEFAULT VALUES */}
          {activeTab === 'DEFAULTS' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Judul Dokumen
                </label>
                <input
                  type="text"
                  value={defaultValues.document_title || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, document_title: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Jabatan Penandatangan
                </label>
                <input
                  type="text"
                  value={defaultValues.signatory_position || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, signatory_position: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Nama Penandatangan
                </label>
                <input
                  type="text"
                  value={defaultValues.signatory_name || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, signatory_name: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                  Default Kalimat Penutup
                </label>
                <textarea
                  value={defaultValues.closing_text || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, closing_text: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  rows={2}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive A4 Visual Canvas Preview & Drag Area */}
        <div className="lg:col-span-7 space-y-3">
          <div className="w-full flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
              <span>🖱️</span> Drag Canvas Kop Surat (A4)
            </span>
            <span className="text-[10px] bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono px-2 py-0.5 rounded-full font-bold">
              Klik &amp; Drag Elemen
            </span>
          </div>

          <DocumentPreviewContainer defaultMode="fit" showToolbar>
            <DocumentCanvas
              formData={previewData}
              layoutConfig={layoutConfig}
              previewMode
              isBuilderInteractive
              selectedKopElement={selectedKopElement}
              onSelectKopElement={setSelectedKopElement}
              onKopConfigChange={handleKopChange}
              onSignatureConfigChange={handleSigChange}
            />
          </DocumentPreviewContainer>
        </div>
      </div>

      {/* Document Type Manager Modal */}
      <DocumentTypeManagerModal
        isOpen={isTypeManagerOpen}
        onClose={() => setIsTypeManagerOpen(false)}
        onTypesUpdated={handleTypesUpdated}
        onSelectType={(newTypeId) => {
          setTypeId(newTypeId);
          handleTypesUpdated();
        }}
      />
    </div>
  );
};
