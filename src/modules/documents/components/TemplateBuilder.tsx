'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CustomDetailItem,
  CustomKopTextElement,
  DocumentAssetItem,
  DocumentTemplateItem,
  DocumentTypeItem,
  FlowSectionConfig,
  FormFieldSchema,
  KopSuratConfig,
  SignatureStampConfig,
  TableColumnConfig,
  TemplateLayoutConfig,
} from '../documentTypes';
import {
  createTemplateAction,
  updateTemplateAction,
} from '../templateActions';
import { getDocumentTypesAction } from '../documentTypeActions';
import { getDocumentAssets, uploadDocumentAssetAction } from '../assetActions';
import { DocumentCanvas } from './DocumentCanvas';
import { DocumentPreviewContainer } from './DocumentPreviewContainer';
import { DocumentTypeManagerModal } from './DocumentTypeManagerModal';
import {
  DEFAULT_SURAT_TUGAS_LAYOUT,
  DEFAULT_SURAT_TUGAS_SCHEMA,
  DEFAULT_SURAT_TUGAS_VALUES,
  getDefaultTemplateForType,
} from '../defaultTemplates';
import { getRealtimeDocumentDate } from '@/lib/dateUtils';

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
  const normalizeData = (data: Record<string, any>) => {
    const res = { ...data };
    if (
      typeof res.event_intro_text === 'string' &&
      res.event_intro_text.includes('BKOT (Bincang Kampus Bersama Orang Tua) UBSI')
    ) {
      res.event_intro_text = res.event_intro_text.replace(
        /BKOT \(Bincang Kampus Bersama Orang Tua\) UBSI/g,
        '{event_name}'
      );
    }
    if (
      typeof res.intro_text === 'string' &&
      res.intro_text.includes('Project Director Kian Troopers') &&
      !res.intro_text.includes('{signer_title_intro}')
    ) {
      res.intro_text = res.intro_text.replace(
        /Project Director Kian Troopers/g,
        '{signer_title_intro}'
      );
    }
    if (
      typeof res.intro_text === 'string' &&
      res.intro_text.includes('Rapat Koordinasi & Sinergi Program KIAN Troopers 2026')
    ) {
      res.intro_text = res.intro_text.replace(
        /Rapat Koordinasi & Sinergi Program KIAN Troopers 2026/g,
        '{event_name}'
      );
    }
    return res;
  };

  const [defaultValues, setDefaultValues] = useState<Record<string, any>>(() => {
    const raw = normalizeData(initialTemplate?.default_values || DEFAULT_SURAT_TUGAS_VALUES);
    return {
      ...raw,
      document_date_place: raw.document_date_place || getRealtimeDocumentDate('Jakarta'),
    };
  });

  // Sample data for previewing live canvas in builder
  const [previewData, setPreviewData] = useState<Record<string, any>>(() => {
    const raw = normalizeData(initialTemplate?.sample_data || defaultValues);
    return {
      ...raw,
      document_date_place: raw.document_date_place || getRealtimeDocumentDate('Jakarta'),
    };
  });

  const [activeTab, setActiveTab] = useState<'KOP_SURAT' | 'SECTIONS' | 'TYPOGRAPHY' | 'SIGNATURE' | 'INFO' | 'LAYOUT' | 'DEFAULTS'>('KOP_SURAT');
  const [selectedKopElement, setSelectedKopElement] = useState<string | null>('logo');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Existing Reusable Assets State (Frame & Logo)
  const [existingFrames, setExistingFrames] = useState<DocumentAssetItem[]>([]);
  const [existingLogos, setExistingLogos] = useState<DocumentAssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetModalCategory, setAssetModalCategory] = useState<'FRAME' | 'LOGO'>('FRAME');

  // Table Builder SubTab state
  const [tableEditorSubTab, setTableEditorSubTab] = useState<'COLUMNS' | 'ROWS'>('COLUMNS');

  // Load existing assets from library on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        setIsLoadingAssets(true);
        const [frames, logos] = await Promise.all([
          getDocumentAssets('FRAME'),
          getDocumentAssets('LOGO'),
        ]);
        setExistingFrames(frames);
        setExistingLogos(logos);
      } catch (e) {
        console.error('Failed to load document assets:', e);
      } finally {
        setIsLoadingAssets(false);
      }
    };
    loadAssets();
  }, []);

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

  const updateFieldValue = (key: string, value: any) => {
    setPreviewData((prev) => ({ ...prev, [key]: value }));
    setDefaultValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddSection = (type: FlowSectionConfig['type']) => {
    const newId = `sec_${Date.now()}`;
    let newSec: FlowSectionConfig = {
      id: newId,
      type,
      visible: true,
      spacingBottomMm: 6,
    };

    if (type === 'TITLE_AND_NUMBER') {
      newSec.title = 'Judul & Nomor Surat';
      newSec.contentKey = 'document_title';
    } else if (type === 'HEADER_LOGO') {
      newSec.title = 'Logo Kop Surat';
    } else if (type === 'RECIPIENT_BLOCK') {
      newSec.title = 'Tujuan / Penerima Surat';
      newSec.contentKey = 'recipient_info';
      newSec.content = 'Kepada Yth.\nBapak/Ibu Pimpinan\ndi Tempat';
      if (!previewData.recipient_info) {
        updateFieldValue('recipient_info', newSec.content);
      }
    } else if (type === 'INTRO_TEXT') {
      newSec.title = 'Kalimat Pembuka';
      newSec.contentKey = 'intro_text';
      newSec.content = previewData.intro_text || 'Yang bertanda tangan dibawah ini, {signer_title_intro}, menugaskan kepada :';
    } else if (type === 'CLOSING_TEXT') {
      newSec.title = 'Kalimat Penutup';
      newSec.contentKey = 'closing_text';
      newSec.content = previewData.closing_text || 'Demikianlah surat ini dibuat agar dapat dipergunakan sebagaimana mestinya.';
    } else if (type === 'PARAGRAPH') {
      newSec.title = 'Paragraf Isi Surat';
      newSec.contentKey = `body_text_${Date.now()}`;
      newSec.content = 'Sehubungan dengan hal tersebut, bersama surat ini kami sampaikan bahwa...';
      updateFieldValue(newSec.contentKey, newSec.content);
    } else if (type === 'KEY_VALUE_GRID') {
      newSec.title = 'Rincian Informasi / Grid';
      newSec.contentKey = 'details';
    } else if (type === 'ASSIGNEE_TABLE') {
      newSec.title = 'Tabel Personil / Kru';
      newSec.contentKey = 'assignees';
    } else if (type === 'REPEATABLE_LIST') {
      newSec.title = 'Poin-Poin Pernyataan';
      newSec.contentKey = 'statement_points';
      if (!previewData.statement_points || !previewData.statement_points.length) {
        updateFieldValue('statement_points', [
          '1. Seluruh data yang tercantum dalam dokumen ini adalah benar dan dapat dipertanggungjawabkan.',
          '2. Bersedia mematuhi ketentuan dan SOP KIAN Troopers yang berlaku.',
        ]);
      }
    } else if (type === 'DIVIDER') {
      newSec.title = 'Garis Pemisah';
    } else if (type === 'SIGNATURE_BLOCK') {
      newSec.title = 'Blok Tanda Tangan & Cap';
    } else if (type === 'TEMBUSAN_BLOCK') {
      newSec.title = 'Tembusan (CC)';
      newSec.contentKey = 'cc_list';
      if (!previewData.cc_list || !previewData.cc_list.length) {
        updateFieldValue('cc_list', ['1. Direktur Utama', '2. Divisi Terkait', '3. Arsip']);
      }
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

  // Select existing asset from library
  const handleSelectExistingAsset = (category: 'FRAME' | 'LOGO', assetUrl: string) => {
    if (category === 'FRAME') {
      handleKopChange({
        ...kopConfig,
        frameAssetUrl: assetUrl,
      });
    } else if (category === 'LOGO') {
      handleKopChange({
        ...kopConfig,
        logo: {
          ...kopConfig.logo,
          enabled: true,
          assetUrl,
        },
      });
    }
    setIsAssetModalOpen(false);
  };

  // Upload custom frame PNG/JPG
  const handleUploadFrame = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Ukuran file frame maksimal 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        frameAssetUrl: base64,
      });

      // Auto-save to reusable library
      try {
        const formData = new FormData();
        const baseName = file.name.replace(/\.[^/.]+$/, '') || 'Frame Background';
        formData.append('name', baseName);
        formData.append('category', 'FRAME');
        formData.append('file', file);
        const res = await uploadDocumentAssetAction(formData);
        if (res.success && res.asset) {
          setExistingFrames((prev) => [res.asset!, ...prev.filter((a) => a.id !== res.asset!.id)]);
        }
      } catch (err) {
        console.error('Failed to auto-save frame asset:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload custom logo PNG/JPG
  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran file logo maksimal 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      handleKopChange({
        ...kopConfig,
        logo: {
          ...kopConfig.logo,
          enabled: true,
          assetUrl: base64,
        },
      });

      // Auto-save to reusable library
      try {
        const formData = new FormData();
        const baseName = file.name.replace(/\.[^/.]+$/, '') || 'Logo Kop Surat';
        formData.append('name', baseName);
        formData.append('category', 'LOGO');
        formData.append('file', file);
        const res = await uploadDocumentAssetAction(formData);
        if (res.success && res.asset) {
          setExistingLogos((prev) => [res.asset!, ...prev.filter((a) => a.id !== res.asset!.id)]);
        }
      } catch (err) {
        console.error('Failed to auto-save logo asset:', err);
      }
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

  // ==========================================
  // FLEXIBLE TABLE BUILDER HELPERS & PRESETS
  // ==========================================
  const activeTableColumns: TableColumnConfig[] =
    layoutConfig.tableColumns && layoutConfig.tableColumns.length > 0
      ? layoutConfig.tableColumns
      : [
          { key: 'no', label: 'No', widthPercent: 8, align: 'center' },
          { key: 'nip', label: 'NIP', widthPercent: 22, align: 'center', dynamicToken: '{person_nip}' },
          { key: 'name', label: 'Nama Lengkap', widthPercent: 42, align: 'left', dynamicToken: '{person_name}' },
          { key: 'role', label: 'Tugas / Posisi', widthPercent: 28, align: 'left', dynamicToken: '{person_role}' },
        ];

  const handleUpdateTableColumns = (newCols: TableColumnConfig[]) => {
    setLayoutConfig((prev) => ({
      ...prev,
      tableColumns: newCols,
    }));
  };

  const handleAddTableColumn = () => {
    const newKey = `col_${Date.now().toString().slice(-4)}`;
    const newCol: TableColumnConfig = {
      key: newKey,
      label: 'Kolom Baru',
      widthPercent: 20,
      align: 'left',
      isManual: true,
    };
    const updated = [...activeTableColumns, newCol];
    handleUpdateTableColumns(updated);
  };

  const handleDeleteTableColumn = (index: number) => {
    if (activeTableColumns.length <= 1) {
      alert('Tabel minimal harus memiliki 1 kolom.');
      return;
    }
    const updated = activeTableColumns.filter((_, i) => i !== index);
    handleUpdateTableColumns(updated);
  };

  const handleEditTableColumn = (index: number, updates: Partial<TableColumnConfig>) => {
    const updated = [...activeTableColumns];
    updated[index] = { ...updated[index], ...updates };
    handleUpdateTableColumns(updated);
  };

  const handleMoveTableColumn = (index: number, direction: 'UP' | 'DOWN') => {
    if (
      (direction === 'UP' && index === 0) ||
      (direction === 'DOWN' && index === activeTableColumns.length - 1)
    )
      return;

    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    const updated = [...activeTableColumns];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    handleUpdateTableColumns(updated);
  };

  const handleBalanceColumnWidths = () => {
    const count = activeTableColumns.length;
    if (count === 0) return;
    const hasNo = activeTableColumns.some((c) => c.key === 'no');
    if (hasNo && count > 1) {
      const remainingWidth = 92;
      const equalShare = Math.floor(remainingWidth / (count - 1));
      const remainder = remainingWidth - equalShare * (count - 1);
      const updated = activeTableColumns.map((c, i) => {
        if (c.key === 'no') return { ...c, widthPercent: 8 };
        if (i === activeTableColumns.length - 1) {
          return { ...c, widthPercent: equalShare + remainder };
        }
        return { ...c, widthPercent: equalShare };
      });
      handleUpdateTableColumns(updated);
    } else {
      const equalShare = Math.floor(100 / count);
      const remainder = 100 - equalShare * count;
      const updated = activeTableColumns.map((c, i) => {
        if (i === activeTableColumns.length - 1) {
          return { ...c, widthPercent: equalShare + remainder };
        }
        return { ...c, widthPercent: equalShare };
      });
      handleUpdateTableColumns(updated);
    }
  };

  const handleApplyTablePreset = (presetType: 'OJT' | 'KRU' | 'INVENTARIS' | 'PENILAIAN') => {
    if (presetType === 'OJT') {
      const cols: TableColumnConfig[] = [
        { key: 'no', label: 'No', widthPercent: 6, align: 'center' },
        { key: 'name', label: 'Nama Lengkap', widthPercent: 28, align: 'left', dynamicToken: '{person_name}' },
        { key: 'campus', label: 'Asal Kampus / Institusi', widthPercent: 28, align: 'left', dynamicToken: '{person_campus}' },
        { key: 'division', label: 'Divisi Penempatan', widthPercent: 22, align: 'left', dynamicToken: '{person_division}' },
        { key: 'period', label: 'Periode', widthPercent: 16, align: 'center', dynamicToken: '{period}' },
      ];
      handleUpdateTableColumns(cols);
      updateFieldValue('assignees', [
        { no: 1, name: 'Aditya Pratama', campus: 'Universitas Indonesia', division: 'Event Production', period: 'Sep - Des 2026' },
        { no: 2, name: 'Siti Nurhaliza', campus: 'Universitas BSI Jakarta', division: 'Creative & Design', period: 'Sep - Des 2026' },
      ]);
    } else if (presetType === 'KRU') {
      const cols: TableColumnConfig[] = [
        { key: 'no', label: 'No', widthPercent: 8, align: 'center' },
        { key: 'nip', label: 'NIP / NIM', widthPercent: 22, align: 'center', dynamicToken: '{person_nip}' },
        { key: 'name', label: 'Nama Lengkap', widthPercent: 40, align: 'left', dynamicToken: '{person_name}' },
        { key: 'role', label: 'Tugas / Posisi', widthPercent: 30, align: 'left', dynamicToken: '{person_role}' },
      ];
      handleUpdateTableColumns(cols);
      updateFieldValue('assignees', [
        { no: 1, nip: '17250012', name: 'Rian Firmansyah', role: 'Stage Manager & Sound Lead' },
        { no: 2, nip: '17250045', name: 'Dewi Anggraini', role: 'Show Director & Operator' },
      ]);
    } else if (presetType === 'INVENTARIS') {
      const cols: TableColumnConfig[] = [
        { key: 'no', label: 'No', widthPercent: 8, align: 'center' },
        { key: 'item_name', label: 'Nama Barang / Peralatan', widthPercent: 36, align: 'left' },
        { key: 'spec', label: 'Spesifikasi / Serial', widthPercent: 26, align: 'left' },
        { key: 'qty', label: 'Jumlah', widthPercent: 12, align: 'center' },
        { key: 'notes', label: 'Keterangan', widthPercent: 18, align: 'left' },
      ];
      handleUpdateTableColumns(cols);
      updateFieldValue('assignees', [
        { no: 1, item_name: 'Wireless Microphone Shure', spec: 'SLXD24 / SM58', qty: '4 Unit', notes: 'Kondisi Baik' },
        { no: 2, item_name: 'Digital Mixer Yamaha', spec: 'TF5 32-Channel', qty: '1 Unit', notes: 'Main Console' },
      ]);
    } else if (presetType === 'PENILAIAN') {
      const cols: TableColumnConfig[] = [
        { key: 'no', label: 'No', widthPercent: 8, align: 'center' },
        { key: 'name', label: 'Nama Peserta', widthPercent: 32, align: 'left', dynamicToken: '{person_name}' },
        { key: 'division', label: 'Divisi / Unit', widthPercent: 26, align: 'left', dynamicToken: '{person_division}' },
        { key: 'score', label: 'Nilai Akhir', widthPercent: 16, align: 'center' },
        { key: 'status', label: 'Predikat / Status', widthPercent: 18, align: 'center' },
      ];
      handleUpdateTableColumns(cols);
      updateFieldValue('assignees', [
        { no: 1, name: 'Aditya Pratama', division: 'Event Production', score: '92.5', status: 'Sangat Memuaskan (A)' },
        { no: 2, name: 'Siti Nurhaliza', division: 'Creative & Design', score: '88.0', status: 'Memuaskan (B+)' },
      ]);
    }
  };

  const handleAddBlankRow = () => {
    const currentList = Array.isArray(previewData.assignees) ? [...previewData.assignees] : [];
    const newRow: Record<string, any> = {
      no: currentList.length + 1,
    };
    activeTableColumns.forEach((c) => {
      if (c.key !== 'no') {
        newRow[c.key] = '';
      }
    });
    updateFieldValue('assignees', [...currentList, newRow]);
  };

  const handleGenerateSampleRows = () => {
    const currentList = Array.isArray(previewData.assignees) ? [...previewData.assignees] : [];
    const sampleNames = ['Rian Pratama', 'Siti Rahmawati', 'Budi Santoso', 'Anisa Rahayu', 'Fajar Ramadhan'];
    const sampleCampuses = ['Universitas Indonesia', 'Institut Teknologi Bandung', 'Universitas Gadjah Mada', 'Universitas BSI Jakarta', 'Universitas Bina Nusantara'];
    const sampleDivs = ['Event Production', 'Creative & Design', 'Marketing & Social Media', 'Audio Visual & Broadcast', 'Logistics & Operational'];
    const idx = currentList.length % sampleNames.length;

    const newRow: Record<string, any> = {
      no: currentList.length + 1,
    };

    activeTableColumns.forEach((col) => {
      const k = col.key.toLowerCase();
      if (k === 'name' || k === 'nama') newRow[col.key] = sampleNames[idx];
      else if (k === 'campus' || k === 'kampus' || k === 'institusi') newRow[col.key] = sampleCampuses[idx];
      else if (k === 'division' || k === 'divisi' || k === 'unit') newRow[col.key] = sampleDivs[idx];
      else if (k === 'period' || k === 'periode') newRow[col.key] = 'Sep - Des 2026';
      else if (k === 'nip' || k === 'nim') newRow[col.key] = `1725${Math.floor(1000 + Math.random() * 9000)}`;
      else if (k === 'role' || k === 'tugas' || k === 'jabatan') newRow[col.key] = 'Koordinator / Officer';
      else if (k === 'score' || k === 'nilai') newRow[col.key] = '90.0';
      else if (k === 'status' || k === 'predikat') newRow[col.key] = 'Lulus / Sangat Baik';
      else if (k === 'qty' || k === 'jumlah') newRow[col.key] = '1 Unit';
      else if (col.dynamicToken) newRow[col.key] = col.dynamicToken;
      else newRow[col.key] = '';
    });

    updateFieldValue('assignees', [...currentList, newRow]);
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

    // Ensure effectiveFormSchema retains event_custom_details if custom details or grid are present
    let effectiveFormSchema = [...formSchema];
    const hasEventGrid = layoutConfig.flowSections?.some(
      (s) => s.type === 'KEY_VALUE_GRID' || s.type === 'EVENT_DETAILS'
    );
    const hasCustomDetails = previewData.event_custom_details || defaultValues.event_custom_details;
    if ((hasEventGrid || hasCustomDetails) && !effectiveFormSchema.some((f) => f.key === 'event_custom_details')) {
      const insertIdx = effectiveFormSchema.findIndex((f) => f.key === 'event_location' || f.key === 'event_days');
      const customField: FormFieldSchema = {
        key: 'event_custom_details',
        label: 'Rincian Tambahan / Kustom (Dresscode, Perlengkapan, dll)',
        type: 'key_value_list',
        required: false,
        defaultValue: defaultValues.event_custom_details || [{ id: '1', label: 'Dresscode', value: 'Batik / Formal Bebas Rapi' }],
        helpText: 'Tambahkan rincian tambahan seperti dresscode, pakaian, perlengkapan, catatan, atau kontak PIC.',
      };
      if (insertIdx !== -1) {
        effectiveFormSchema.splice(insertIdx + 1, 0, customField);
      } else {
        effectiveFormSchema.push(customField);
      }
    }

    try {
      if (isEditing && initialTemplate) {
        const res = await updateTemplateAction(initialTemplate.id, {
          name,
          description,
          status,
          layout_config: layoutConfig,
          form_schema: effectiveFormSchema,
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
          form_schema: effectiveFormSchema,
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

              {/* 1. Upload / Select Frame Background */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
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
                      Hapus Frame
                    </button>
                  )}
                </div>

                {/* Active Frame Preview if any */}
                {kopConfig.frameAssetUrl ? (
                  <div className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-purple-200 dark:border-purple-800/60">
                    <img
                      src={kopConfig.frameAssetUrl}
                      alt="Active Frame"
                      className="w-12 h-16 object-contain border border-zinc-200 dark:border-zinc-700 rounded bg-zinc-50 dark:bg-zinc-800"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded">
                        Frame Aktif
                      </span>
                      <p className="text-[11px] text-zinc-500 truncate mt-1">
                        Frame terpasang pada latar dokumen A4.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Belum ada background frame custom (menggunakan layout putih polos).
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssetModalCategory('FRAME');
                      setIsAssetModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>📚</span>
                    <span>Pilih dari Library ({existingFrames.length})</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                    <span>📤</span>
                    <span>Upload Baru</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleUploadFrame}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* 2. Upload / Select Custom Logo */}
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <span>👑</span> Logo Kop Surat
                  </label>
                  {kopConfig.logo.assetUrl ? (
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
                  ) : null}
                </div>

                {/* Active Logo Preview */}
                <div className="flex items-center gap-3 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  {kopConfig.logo.assetUrl ? (
                    <img
                      src={kopConfig.logo.assetUrl}
                      alt="Logo Kop"
                      className="w-16 h-10 object-contain border border-zinc-200 dark:border-zinc-700 rounded bg-white"
                    />
                  ) : (
                    <div className="w-16 h-10 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded flex items-center justify-center text-[10px] font-bold text-purple-700">
                      KIAN
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold px-1.5 py-0.5 rounded">
                      {kopConfig.logo.assetUrl ? 'Logo Custom Aktif' : 'Logo Vektor Bawaan'}
                    </span>
                    <p className="text-[11px] text-zinc-500 truncate mt-1">
                      {kopConfig.logo.assetUrl ? 'Menggunakan gambar logo yang diupload' : 'Format vektor default KIAN Troopers'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssetModalCategory('LOGO');
                      setIsAssetModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>📚</span>
                    <span>Pilih dari Library ({existingLogos.length})</span>
                  </button>

                  <label className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                    <span>📤</span>
                    <span>Upload Baru</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={handleUploadLogo}
                      className="hidden"
                    />
                  </label>
                </div>
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
                    onClick={() => handleAddSection('TITLE_AND_NUMBER')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>🏷️</span> Judul Dokumen
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('RECIPIENT_BLOCK')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>👤</span> Penerima Yth
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('INTRO_TEXT')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📝</span> Kalimat Pembuka
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('PARAGRAPH')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📄</span> Paragraf Bebas
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
                    <span>📑</span> Poin / Diktum
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('CLOSING_TEXT')}
                    className="p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 hover:border-purple-500 text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300 text-left transition-all"
                  >
                    <span>📝</span> Kalimat Penutup
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
                    sec.type === 'HEADER_LOGO'
                      ? '👑 Logo Kop Surat'
                      : sec.type === 'TITLE_AND_NUMBER'
                      ? '🏷️ Judul & Nomor Surat'
                      : sec.type === 'RECIPIENT_BLOCK'
                      ? '👤 Penerima Surat (Kepada Yth)'
                      : sec.type === 'INTRO_TEXT'
                      ? '📝 Kalimat Pembuka'
                      : sec.type === 'PARAGRAPH' || sec.type === 'CUSTOM_PARAGRAPH'
                      ? '📝 Paragraf Bebas / Isi'
                      : sec.type === 'CLOSING_TEXT'
                      ? '📝 Kalimat Penutup'
                      : sec.type === 'KEY_VALUE_GRID' || sec.type === 'EVENT_DETAILS'
                      ? '📋 Grid Rincian / Detail'
                      : sec.type === 'ASSIGNEE_TABLE'
                      ? '👥 Tabel Personil / Kru'
                      : sec.type === 'REPEATABLE_LIST'
                      ? '📑 Poin-Poin Diktum / Pernyataan'
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

                      {/* 1. TITLE & NUMBER EDITOR */}
                      {sec.type === 'TITLE_AND_NUMBER' && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300">
                                Judul Dokumen (Bisa Multi-baris / Tekan Enter)
                              </label>
                              <span className="text-[9.5px] text-purple-600 dark:text-purple-400 font-medium">
                                ↵ Enter untuk baris baru
                              </span>
                            </div>
                            <textarea
                              rows={2}
                              value={previewData.document_title || ''}
                              onChange={(e) => updateFieldValue('document_title', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold uppercase resize-y leading-tight font-sans"
                              placeholder="Contoh:&#10;SURAT KEPUTUSAN&#10;PENERIMAAN PESERTA MAGANG"
                            />
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {[
                                { label: 'SK 1 Baris', value: 'SURAT KEPUTUSAN' },
                                { label: 'SK 2 Baris (Magang)', value: 'SURAT KEPUTUSAN\nPENERIMAAN MAGANG' },
                                { label: 'SK 3 Baris (Tentang)', value: 'SURAT KEPUTUSAN\nTENTANG\nPENETAPAN TIM PRODUKSI' },
                                { label: 'SURAT TUGAS', value: 'SURAT TUGAS' },
                                { label: 'SURAT UNDANGAN', value: 'SURAT UNDANGAN' },
                                { label: 'SURAT KETERANGAN', value: 'SURAT KETERANGAN' },
                                { label: 'SURAT PERNYATAAN', value: 'SURAT PERNYATAAN' },
                                { label: 'SURAT PERINGATAN', value: 'SURAT PERINGATAN' },
                              ].map((presetItem) => (
                                <button
                                  key={presetItem.label}
                                  type="button"
                                  onClick={() => updateFieldValue('document_title', presetItem.value)}
                                  className={`text-[9.5px] px-2 py-0.5 rounded-md border font-bold transition-all ${
                                    previewData.document_title === presetItem.value
                                      ? 'bg-purple-600 text-white border-purple-600'
                                      : 'bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
                                  }`}
                                >
                                  {presetItem.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div>
                              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                Nomor Surat Contoh
                              </label>
                              <input
                                type="text"
                                value={previewData.document_number || ''}
                                onChange={(e) => updateFieldValue('document_number', e.target.value)}
                                className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                                placeholder="001/SK-DIR/KIAN/IX/2026"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                Jabatan Intro
                              </label>
                              <input
                                type="text"
                                value={previewData.signer_title_intro || ''}
                                onChange={(e) => updateFieldValue('signer_title_intro', e.target.value)}
                                className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                placeholder="Project Director Kian Troopers"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 2. HEADER LOGO */}
                      {sec.type === 'HEADER_LOGO' && (
                        <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-zinc-800 dark:text-zinc-200 block text-[11px]">
                              Logo Kop Surat KIAN
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              X: {kopConfig.logo.x}px | Y: {kopConfig.logo.y}px | Lebar: {kopConfig.logo.width}px
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('KOP_SURAT')}
                            className="px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-[10px] hover:bg-purple-200"
                          >
                            📐 Atur di Tab Kop
                          </button>
                        </div>
                      )}

                      {/* 3. RECIPIENT BLOCK (KEPADA YTH) */}
                      {sec.type === 'RECIPIENT_BLOCK' && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300">
                              Teks Penerima Surat (Kepada Yth)
                            </label>
                            <div className="flex items-center gap-1">
                              {['{person_name}', '{person_institution}', '{person_role}'].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const current = previewData.recipient_info || '';
                                    const next = current ? `${current}\n${tag}` : tag;
                                    handleEditSection(idx, { content: next });
                                    updateFieldValue('recipient_info', next);
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-mono font-bold hover:bg-purple-100"
                                >
                                  +{tag}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={previewData.recipient_info || sec.content || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleEditSection(idx, { content: val });
                              updateFieldValue('recipient_info', val);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-y font-sans leading-relaxed"
                            placeholder="Kepada Yth.&#10;Bapak/Ibu Pimpinan&#10;di Tempat"
                          />
                        </div>
                      )}

                      {/* 4. INTRO / PARAGRAPH / CLOSING TEXT */}
                      {(sec.type === 'INTRO_TEXT' ||
                        sec.type === 'PARAGRAPH' ||
                        sec.type === 'CUSTOM_PARAGRAPH' ||
                        sec.type === 'CLOSING_TEXT') && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300">
                              Template Teks / Isi Konten
                            </label>
                            <div className="flex flex-wrap items-center gap-1">
                              {[
                                '{signer_title_intro}',
                                '{event_name}',
                                '{person_name}',
                                '{person_role}',
                              ].map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const targetKey =
                                      sec.contentKey ||
                                      sec.id ||
                                      (sec.type === 'INTRO_TEXT'
                                        ? 'intro_text'
                                        : sec.type === 'CLOSING_TEXT'
                                        ? 'closing_text'
                                        : 'body_content');
                                    const current =
                                      previewData[targetKey] || sec.content || '';
                                    const next = current ? `${current} ${tag}` : tag;
                                    handleEditSection(idx, { content: next });
                                    updateFieldValue(targetKey, next);
                                  }}
                                  className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-mono font-bold hover:bg-purple-100"
                                >
                                  +{tag}
                                </button>
                              ))}
                            </div>
                          </div>
                          <textarea
                            rows={3}
                            value={
                              (sec.contentKey && previewData[sec.contentKey]) ||
                              previewData[sec.id] ||
                              sec.content ||
                              (sec.type === 'INTRO_TEXT' ? previewData.intro_text || '' : '') ||
                              (sec.type === 'CLOSING_TEXT' ? previewData.closing_text || '' : '') ||
                              previewData.body_content ||
                              ''
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              handleEditSection(idx, { content: val });
                              const targetKey =
                                sec.contentKey ||
                                sec.id ||
                                (sec.type === 'INTRO_TEXT'
                                  ? 'intro_text'
                                  : sec.type === 'CLOSING_TEXT'
                                  ? 'closing_text'
                                  : 'body_content');
                              updateFieldValue(targetKey, val);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs resize-y font-sans leading-relaxed"
                            placeholder="Tuliskan isi teks di sini..."
                          />
                        </div>
                      )}

                      {/* 5. KEY_VALUE_GRID / EVENT DETAILS / PERSON DETAILS */}
                      {(sec.type === 'KEY_VALUE_GRID' || sec.type === 'EVENT_DETAILS') && (() => {
                        const customList: CustomDetailItem[] = Array.isArray(previewData.event_custom_details)
                          ? previewData.event_custom_details
                          : [];

                        const handleAddCustomDetail = (label: string, value: string = '') => {
                          const newItem: CustomDetailItem = {
                            id: `cd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                            label,
                            value,
                          };
                          updateFieldValue('event_custom_details', [...customList, newItem]);
                        };

                        const handleUpdateCustomDetail = (id: string, field: 'label' | 'value', val: string) => {
                          const nextList = customList.map((it) => (it.id === id ? { ...it, [field]: val } : it));
                          updateFieldValue('event_custom_details', nextList);
                        };

                        const handleRemoveCustomDetail = (id: string) => {
                          updateFieldValue('event_custom_details', customList.filter((it) => it.id !== id));
                        };

                        const handleMoveCustomDetail = (index: number, direction: 'up' | 'down') => {
                          const newIdx = direction === 'up' ? index - 1 : index + 1;
                          if (newIdx < 0 || newIdx >= customList.length) return;
                          const nextList = [...customList];
                          const [moved] = nextList.splice(index, 1);
                          nextList.splice(newIdx, 0, moved);
                          updateFieldValue('event_custom_details', nextList);
                        };

                        return (
                          <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 block">
                                📅 Detail Rincian Acara &amp; Data
                              </span>
                              <span className="text-[9.5px] text-purple-600 dark:text-purple-400 font-medium">
                                Fleksibel &amp; Dapat Dikustom
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block">
                                    Kalimat Pengantar Rincian
                                  </label>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {['{event_name}', '{signer_title_intro}', '{person_name}', '{person_role}'].map((tag) => (
                                      <button
                                        key={tag}
                                        type="button"
                                        onClick={() => {
                                          const current = previewData.event_intro_text || '';
                                          const next = current ? `${current} ${tag}` : tag;
                                          updateFieldValue('event_intro_text', next);
                                        }}
                                        className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 font-mono font-bold hover:bg-purple-100 dark:hover:bg-purple-900/60 cursor-pointer"
                                        title={`Sisipkan tag ${tag}`}
                                      >
                                        +{tag}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <input
                                  type="text"
                                  value={previewData.event_intro_text || ''}
                                  onChange={(e) => updateFieldValue('event_intro_text', e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-mono"
                                  placeholder="Untuk berpartisipasi pada event {event_name}, dengan rincian sebagai berikut:"
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                    Nama Acara / Event
                                  </label>
                                  <input
                                    type="text"
                                    value={previewData.event_name || ''}
                                    onChange={(e) => updateFieldValue('event_name', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                                    placeholder="BKOT UBSI 2026"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                    Hari / Tanggal
                                  </label>
                                  <input
                                    type="text"
                                    value={previewData.event_days || ''}
                                    onChange={(e) => updateFieldValue('event_days', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                    placeholder="Jum'at - Sabtu, 11 - 12 September 2026"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                    Waktu / Pukul
                                  </label>
                                  <input
                                    type="text"
                                    value={previewData.event_time || ''}
                                    onChange={(e) => updateFieldValue('event_time', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                    placeholder="07.30 WIB - Selesai"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                    Tempat / Lokasi
                                  </label>
                                  <input
                                    type="text"
                                    value={previewData.event_location || ''}
                                    onChange={(e) => updateFieldValue('event_location', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                    placeholder="Hotel Santika Depok"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Dynamic Custom Details Section (Dresscode, Perlengkapan, Catatan, dll) */}
                            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/80 space-y-2">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[10.5px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                  <span>👔</span> Rincian Tambahan / Kustom (Dresscode, Perlengkapan, dll.)
                                </span>
                                <span className="text-[9.5px] text-zinc-500 font-mono">
                                  {customList.length} Item
                                </span>
                              </div>

                              {/* Quick Preset Buttons */}
                              <div className="flex flex-wrap gap-1 items-center">
                                <span className="text-[9px] font-semibold text-zinc-400 mr-0.5">Tambah Cepat:</span>
                                {[
                                  { label: 'Dresscode', icon: '👔', defVal: 'Batik / Formal Bebas Rapi' },
                                  { label: 'Pakaian', icon: '👕', defVal: 'Kemeja Putih & Celana Hitam' },
                                  { label: 'Agenda', icon: '📋', defVal: 'Pembukaan, Workshop & Foto Bersama' },
                                  { label: 'Perlengkapan', icon: '🎒', defVal: 'Laptop, ID Card & Alat Tulis' },
                                  { label: 'Catatan', icon: '📌', defVal: 'Hadir 15 menit sebelum acara dimulai' },
                                  { label: 'Biaya / HTM', icon: '💰', defVal: 'Gratis / Ditanggung Perusahaan' },
                                  { label: 'Kontak PIC', icon: '📞', defVal: '0812-xxxx-xxxx (Admin)' },
                                ].map((preset) => (
                                  <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => handleAddCustomDetail(preset.label, preset.defVal)}
                                    className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 transition-all flex items-center gap-1 active:scale-95"
                                  >
                                    <span>{preset.icon}</span> + {preset.label}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleAddCustomDetail('', '')}
                                  className="text-[9.5px] font-bold px-2 py-0.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600 transition-all flex items-center gap-1 active:scale-95"
                                >
                                  <span>➕</span> + Kustom Bebas
                                </button>
                              </div>

                              {/* Custom Details List */}
                              {customList.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  {customList.map((item, idx) => (
                                    <div
                                      key={item.id || idx}
                                      className="flex items-center gap-1.5 bg-white dark:bg-zinc-900/80 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700/70 shadow-2xs"
                                    >
                                      {/* Reorder Buttons */}
                                      <div className="flex flex-col gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => handleMoveCustomDetail(idx, 'up')}
                                          className="text-[8px] leading-none px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Geser ke Atas"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === customList.length - 1}
                                          onClick={() => handleMoveCustomDetail(idx, 'down')}
                                          className="text-[8px] leading-none px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                          title="Geser ke Bawah"
                                        >
                                          ▼
                                        </button>
                                      </div>

                                      {/* Label Input */}
                                      <input
                                        type="text"
                                        value={item.label}
                                        onChange={(e) => handleUpdateCustomDetail(item.id, 'label', e.target.value)}
                                        placeholder="Label (e.g. Dresscode)"
                                        className="w-[120px] shrink-0 px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-bold text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-purple-500"
                                      />

                                      <span className="text-zinc-400 font-bold">:</span>

                                      {/* Value Input */}
                                      <input
                                        type="text"
                                        value={item.value}
                                        onChange={(e) => handleUpdateCustomDetail(item.id, 'value', e.target.value)}
                                        placeholder="Isi rincian / detail keterangan..."
                                        className="flex-1 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-purple-500"
                                      />

                                      {/* Delete Button */}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCustomDetail(item.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 p-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors"
                                        title="Hapus baris rincian ini"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Secondary Person Details */}
                            <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10.5px] font-bold text-zinc-700 dark:text-zinc-300">
                                  👤 Atau Rincian Personil (Surat Keterangan / Pernyataan)
                                </span>
                                {(previewData.person_name || previewData.person_role) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      updateFieldValue('person_name', '');
                                      updateFieldValue('person_nip', '');
                                      updateFieldValue('person_role', '');
                                      updateFieldValue('person_institution', '');
                                      updateFieldValue('person_address', '');
                                    }}
                                    className="text-[9.5px] text-red-500 hover:underline"
                                  >
                                    Kosongkan Data Orang
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-500 block mb-0.5">Nama Orang</label>
                                  <input
                                    type="text"
                                    value={previewData.person_name || ''}
                                    onChange={(e) => updateFieldValue('person_name', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                    placeholder="Mohamad Abi"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-500 block mb-0.5">Jabatan / Posisi</label>
                                  <input
                                    type="text"
                                    value={previewData.person_role || ''}
                                    onChange={(e) => updateFieldValue('person_role', e.target.value)}
                                    className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                    placeholder="Program Director Kian Troopers"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 6. ASSIGNEE & CUSTOM TABLE BUILDER */}
                      {(sec.type === 'ASSIGNEE_TABLE' || sec.type === 'CUSTOM_TABLE') && (
                        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-3">
                          {/* Header & Sub-Tab Switcher */}
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-700/60 pb-2.5">
                            <div>
                              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                <span>📊</span> Builder Tabel Fleksibel
                              </span>
                              <p className="text-[10.5px] text-zinc-500">
                                Kustom nama kategori/kolom, atur auto-generate dinamis, atau input manual (bisa dikosongkan).
                              </p>
                            </div>

                            <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-900/80 p-0.5 rounded-lg text-[10.5px] font-bold">
                              <button
                                type="button"
                                onClick={() => setTableEditorSubTab('COLUMNS')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                  tableEditorSubTab === 'COLUMNS'
                                    ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                              >
                                📐 Struktur Kolom ({activeTableColumns.length})
                              </button>
                              <button
                                type="button"
                                onClick={() => setTableEditorSubTab('ROWS')}
                                className={`px-2.5 py-1 rounded-md transition-all ${
                                  tableEditorSubTab === 'ROWS'
                                    ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 shadow-xs'
                                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                                }`}
                              >
                                📝 Data Baris ({((previewData.assignees as any[]) || []).length})
                              </button>
                            </div>
                          </div>

                          {/* SUBTAB 1: STRUKTUR KOLOM & KATEGORI */}
                          {tableEditorSubTab === 'COLUMNS' && (
                            <div className="space-y-3">
                              {/* Quick Presets */}
                              <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-200/70 dark:border-purple-800/40 space-y-1.5">
                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 block">
                                  ⚡ Preset Format Kolom Cepat:
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {[
                                    { key: 'OJT', label: '🎓 Magang / OJT (5 Kolom)' },
                                    { key: 'KRU', label: '👥 Kru / Surat Tugas (4 Kolom)' },
                                    { key: 'INVENTARIS', label: '📦 Inventaris / Barang (5 Kolom)' },
                                    { key: 'PENILAIAN', label: '📊 Penilaian & Evaluasi (5 Kolom)' },
                                  ].map((p) => (
                                    <button
                                      key={p.key}
                                      type="button"
                                      onClick={() => handleApplyTablePreset(p.key as any)}
                                      className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-all shadow-2xs"
                                    >
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Columns List */}
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                                  Daftar Kolom &amp; Konfigurasi ({activeTableColumns.length} Kolom)
                                </span>

                                {activeTableColumns.map((col, colIdx) => (
                                  <div
                                    key={col.key || colIdx}
                                    className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-2 text-xs shadow-2xs"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="w-5 text-center font-mono font-bold text-purple-600 bg-purple-50 dark:bg-purple-950 px-1 py-0.5 rounded text-[10px]">
                                          #{colIdx + 1}
                                        </span>
                                        <input
                                          type="text"
                                          value={col.label}
                                          onChange={(e) =>
                                            handleEditTableColumn(colIdx, { label: e.target.value })
                                          }
                                          className="font-bold text-zinc-900 dark:text-zinc-100 bg-transparent border-b border-dashed border-zinc-300 dark:border-zinc-700 focus:border-purple-500 px-1 py-0.5 text-xs flex-1"
                                          placeholder="Nama Kategori / Header Kolom"
                                        />
                                      </div>

                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveTableColumn(colIdx, 'UP')}
                                          disabled={colIdx === 0}
                                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 text-[10px]"
                                          title="Geser Kiri / Atas"
                                        >
                                          ▲
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveTableColumn(colIdx, 'DOWN')}
                                          disabled={colIdx === activeTableColumns.length - 1}
                                          className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 text-[10px]"
                                          title="Geser Kanan / Bawah"
                                        >
                                          ▼
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTableColumn(colIdx)}
                                          className="p-1 text-red-500 hover:text-red-700 text-xs ml-1"
                                          title="Hapus Kolom"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    </div>

                                    {/* Column Settings Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                                      <div>
                                        <label className="text-[9.5px] font-bold text-zinc-500 block mb-0.5">
                                          Field Key (Data):
                                        </label>
                                        <input
                                          type="text"
                                          value={col.key}
                                          onChange={(e) =>
                                            handleEditTableColumn(colIdx, {
                                              key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                                            })
                                          }
                                          disabled={col.key === 'no'}
                                          className="w-full px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-mono text-[10.5px] disabled:opacity-60"
                                          placeholder="key_name"
                                        />
                                      </div>

                                      <div>
                                        <label className="text-[9.5px] font-bold text-zinc-500 block mb-0.5">
                                          Lebar Kolom ({col.widthPercent}%):
                                        </label>
                                        <input
                                          type="number"
                                          min={3}
                                          max={90}
                                          value={col.widthPercent}
                                          onChange={(e) =>
                                            handleEditTableColumn(colIdx, {
                                              widthPercent: Number(e.target.value) || 10,
                                            })
                                          }
                                          className="w-full px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-[10.5px]"
                                        />
                                      </div>

                                      <div>
                                        <label className="text-[9.5px] font-bold text-zinc-500 block mb-0.5">
                                          Perataan Teks:
                                        </label>
                                        <div className="flex items-center gap-1">
                                          {(['left', 'center', 'right'] as const).map((aln) => (
                                            <button
                                              key={aln}
                                              type="button"
                                              onClick={() => handleEditTableColumn(colIdx, { align: aln })}
                                              className={`flex-1 py-0.5 rounded text-[10px] font-bold capitalize ${
                                                col.align === aln
                                                  ? 'bg-purple-600 text-white'
                                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                                              }`}
                                            >
                                              {aln === 'left' ? 'Kiri' : aln === 'center' ? 'Tengah' : 'Kanan'}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Dynamic content generation token selector / manual badge */}
                                    {col.key !== 'no' && (
                                      <div className="pt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                        <span className="text-zinc-500">Auto-isi / Tag:</span>
                                        {[
                                          { token: '{person_name}', label: 'Nama' },
                                          { token: '{person_campus}', label: 'Kampus' },
                                          { token: '{person_division}', label: 'Divisi' },
                                          { token: '{period}', label: 'Periode' },
                                          { token: '{person_nip}', label: 'NIP' },
                                          { token: '{person_role}', label: 'Jabatan' },
                                        ].map((t) => (
                                          <button
                                            key={t.token}
                                            type="button"
                                            onClick={() =>
                                              handleEditTableColumn(colIdx, {
                                                dynamicToken: col.dynamicToken === t.token ? undefined : t.token,
                                              })
                                            }
                                            className={`px-1.5 py-0.5 rounded font-mono font-bold transition-all ${
                                              col.dynamicToken === t.token
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-purple-50'
                                            }`}
                                          >
                                            {t.token}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleAddTableColumn}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold hover:opacity-90 transition-all flex items-center gap-1"
                                >
                                  <span>+</span> Tambah Kolom Baru
                                </button>

                                <button
                                  type="button"
                                  onClick={handleBalanceColumnWidths}
                                  className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200 transition-all flex items-center gap-1"
                                >
                                  <span>⚖️</span> Seimbangkan Lebar (100%)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* SUBTAB 2: DATA BARIS & PREVIEW */}
                          {tableEditorSubTab === 'ROWS' && (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                                  Daftar Baris Contoh ({((previewData.assignees as any[]) || []).length} Baris)
                                </span>

                                <div className="flex flex-wrap items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleGenerateSampleRows}
                                    className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 font-bold text-[10.5px] hover:bg-purple-100 transition-all flex items-center gap-1"
                                  >
                                    <span>⚡</span> Auto-Generate Contoh
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleAddBlankRow}
                                    className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-[10.5px] hover:opacity-90 transition-all"
                                  >
                                    + Tambah Baris Manual
                                  </button>
                                </div>
                              </div>

                              <p className="text-[10.5px] text-zinc-500">
                                ℹ️ Isian kolom manual dapat dikosongkan jika baris belum memiliki data tetap.
                              </p>

                              {/* Interactive Rows Editor with Dynamic Columns */}
                              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {(((previewData.assignees as any[]) || []).length === 0 ? (
                                  <div className="p-4 text-center text-zinc-400 italic text-xs border border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl">
                                    Tabel masih kosong. Klik &quot;+ Tambah Baris Manual&quot; atau &quot;⚡ Auto-Generate Contoh&quot;.
                                  </div>
                                ) : (
                                  ((previewData.assignees as any[]) || []).map((row: any, rIdx: number) => (
                                    <div
                                      key={rIdx}
                                      className="p-2.5 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700/80 space-y-2 shadow-2xs"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                                          Baris #{rIdx + 1}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const list = previewData.assignees.filter((_: any, i: number) => i !== rIdx);
                                            updateFieldValue('assignees', list);
                                          }}
                                          className="text-red-500 hover:text-red-700 text-xs font-bold"
                                          title="Hapus Baris Ini"
                                        >
                                          ✕ Hapus Baris
                                        </button>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {activeTableColumns
                                          .filter((c) => c.key !== 'no')
                                          .map((col) => (
                                            <div key={col.key}>
                                              <label className="text-[9.5px] font-bold text-zinc-500 block mb-0.5 truncate">
                                                {col.label} ({col.key}):
                                              </label>
                                              <input
                                                type="text"
                                                value={row[col.key] || ''}
                                                onChange={(e) => {
                                                  const list = [...previewData.assignees];
                                                  list[rIdx] = { ...list[rIdx], [col.key]: e.target.value };
                                                  updateFieldValue('assignees', list);
                                                }}
                                                className={`w-full px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs ${
                                                  col.key === 'name' ? 'font-semibold' : col.key === 'nip' ? 'font-mono' : ''
                                                }`}
                                                placeholder={`Bisa dikosongkan atau ketik ${col.label}...`}
                                              />
                                            </div>
                                          ))}
                                      </div>
                                    </div>
                                  ))
                                ))}
                              </div>

                              {(((previewData.assignees as any[]) || []).length > 0 && (
                                <div className="pt-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => updateFieldValue('assignees', [])}
                                    className="text-[10px] text-red-500 hover:underline font-bold"
                                  >
                                    🗑️ Kosongkan Seluruh Baris
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 7. REPEATABLE LIST (DIKTUM / POIN PERNYATAAN) */}
                      {sec.type === 'REPEATABLE_LIST' && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                              Poin-Poin Diktum / Pernyataan ({((previewData.statement_points as string[]) || []).length} Poin)
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const currentList = Array.isArray(previewData.statement_points) ? [...previewData.statement_points] : [];
                                const nextList = [
                                  ...currentList,
                                  `${currentList.length + 1}. Poin keputusan / pernyataan baru...`,
                                ];
                                updateFieldValue('statement_points', nextList);
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                            >
                              + Tambah Poin
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {(((previewData.statement_points as string[]) || []).map((pt: string, pIdx: number) => (
                              <div key={pIdx} className="flex items-start gap-1.5">
                                <textarea
                                  rows={2}
                                  value={pt}
                                  onChange={(e) => {
                                    const list = [...previewData.statement_points];
                                    list[pIdx] = e.target.value;
                                    updateFieldValue('statement_points', list);
                                  }}
                                  className="flex-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs leading-relaxed"
                                  placeholder="Tuliskan poin diktum..."
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = previewData.statement_points.filter((_: any, i: number) => i !== pIdx);
                                    updateFieldValue('statement_points', list);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1 text-xs font-bold"
                                  title="Hapus Poin"
                                >
                                  ✕
                                </button>
                              </div>
                            )))}
                          </div>
                        </div>
                      )}

                      {/* 8. SIGNATURE BLOCK */}
                      {sec.type === 'SIGNATURE_BLOCK' && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2.5">
                          <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-700">
                            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                              Identitas Penandatangan &amp; Tanggal
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveTab('SIGNATURE')}
                              className="text-[10px] font-bold text-purple-600 hover:underline"
                            >
                              🖋️ Atur Posisi Cap di Tab TTD
                            </button>
                          </div>

                          <div className="space-y-2">
                            <div>
                              <div className="flex items-center justify-between mb-0.5">
                                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
                                  Tempat &amp; Tanggal Surat
                                </label>
                                <button
                                  type="button"
                                  onClick={() => updateFieldValue('document_date_place', getRealtimeDocumentDate('Jakarta'))}
                                  className="text-[9.5px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5"
                                >
                                  ⚡ Tanggal Hari Ini (Realtime)
                                </button>
                              </div>
                              <input
                                type="text"
                                value={previewData.document_date_place || ''}
                                onChange={(e) => updateFieldValue('document_date_place', e.target.value)}
                                className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                placeholder={getRealtimeDocumentDate('Jakarta')}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                  Jabatan Penandatangan
                                </label>
                                <input
                                  type="text"
                                  value={previewData.signatory_position || ''}
                                  onChange={(e) => updateFieldValue('signatory_position', e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-semibold"
                                  placeholder="Program Director Kian Troopers"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 block mb-0.5">
                                  Nama Penandatangan
                                </label>
                                <input
                                  type="text"
                                  value={previewData.signatory_name || ''}
                                  onChange={(e) => updateFieldValue('signatory_name', e.target.value)}
                                  className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold underline"
                                  placeholder="Mohamad Abi"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 9. TEMBUSAN BLOCK */}
                      {sec.type === 'TEMBUSAN_BLOCK' && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/70 rounded-xl border border-zinc-200 dark:border-zinc-700/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">
                              Daftar Tembusan (CC) ({((previewData.cc_list as string[]) || []).length} Pihak)
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const currentList = Array.isArray(previewData.cc_list) ? [...previewData.cc_list] : [];
                                const nextList = [
                                  ...currentList,
                                  `${currentList.length + 1}. Pihak Terkait / Arsip`,
                                ];
                                updateFieldValue('cc_list', nextList);
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white hover:bg-purple-700"
                            >
                              + Tambah Tembusan
                            </button>
                          </div>

                          <div className="space-y-1">
                            {(((previewData.cc_list as string[]) || []).map((ccItem: string, ccIdx: number) => (
                              <div key={ccIdx} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={ccItem}
                                  onChange={(e) => {
                                    const list = [...previewData.cc_list];
                                    list[ccIdx] = e.target.value;
                                    updateFieldValue('cc_list', list);
                                  }}
                                  className="flex-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                                  placeholder="1. Direktur Utama"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const list = previewData.cc_list.filter((_: any, i: number) => i !== ccIdx);
                                    updateFieldValue('cc_list', list);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-0.5 text-xs font-bold"
                                  title="Hapus"
                                >
                                  ✕
                                </button>
                              </div>
                            )))}
                          </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400">
                    Default Judul Dokumen (Multi-baris)
                  </label>
                  <span className="text-[9.5px] text-purple-600">↵ Enter untuk baris baru</span>
                </div>
                <textarea
                  rows={2}
                  value={defaultValues.document_title || ''}
                  onChange={(e) => {
                    const next = { ...defaultValues, document_title: e.target.value };
                    setDefaultValues(next);
                    setPreviewData(next);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs uppercase font-bold resize-y"
                  placeholder="Contoh:&#10;SURAT KEPUTUSAN&#10;PENERIMAAN MAGANG"
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

      {/* Asset Library Picker Modal (Frame & Logo) */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 w-full max-w-2xl shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <span>{assetModalCategory === 'FRAME' ? '🖼️' : '👑'}</span>
                  <span>
                    {assetModalCategory === 'FRAME'
                      ? 'Pilih Background Frame dari Library'
                      : 'Pilih Logo Kop Surat dari Library'}
                  </span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Gunakan aset yang sudah pernah diupload sebelumnya untuk template ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssetModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[400px] pr-1">
              {isLoadingAssets ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-zinc-500">Memuat library aset...</p>
                </div>
              ) : (
                (() => {
                  const assets = assetModalCategory === 'FRAME' ? existingFrames : existingLogos;
                  const currentSelectedUrl =
                    assetModalCategory === 'FRAME'
                      ? kopConfig.frameAssetUrl
                      : kopConfig.logo.assetUrl;

                  if (assets.length === 0) {
                    return (
                      <div className="py-12 text-center space-y-3">
                        <div className="text-3xl">📂</div>
                        <p className="text-xs text-zinc-500 font-medium">
                          Belum ada aset {assetModalCategory === 'FRAME' ? 'Frame Background' : 'Logo Kop'} yang tersimpan di library.
                        </p>
                        <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 cursor-pointer shadow-xs">
                          <span>📤</span>
                          <span>Upload {assetModalCategory === 'FRAME' ? 'Frame' : 'Logo'} Sekarang</span>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/svg+xml, image/webp"
                            onChange={(e) => {
                              if (assetModalCategory === 'FRAME') handleUploadFrame(e);
                              else handleUploadLogo(e);
                              setIsAssetModalOpen(false);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {assets.map((ast) => {
                        const isSelected = currentSelectedUrl === ast.asset_url;
                        return (
                          <div
                            key={ast.id}
                            onClick={() => handleSelectExistingAsset(assetModalCategory, ast.asset_url)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                              isSelected
                                ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 dark:border-purple-600 ring-2 ring-purple-500/30 shadow-xs'
                                : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-white dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="w-full h-28 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center p-2 overflow-hidden">
                              <img
                                src={ast.asset_url}
                                alt={ast.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between gap-1">
                                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex-1">
                                  {ast.name}
                                </p>
                                {isSelected && (
                                  <span className="text-[10px] bg-purple-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                                    ✓ Aktif
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                {new Date(ast.created_at * 1000).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>

                            <button
                              type="button"
                              className={`w-full py-1 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-700 group-hover:bg-purple-600 group-hover:text-white text-zinc-700 dark:text-zinc-300'
                              }`}
                            >
                              {isSelected ? 'Sedang Digunakan' : 'Gunakan Aset Ini'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <label className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer flex items-center gap-1.5">
                <span>📤</span>
                <span>Upload File Baru ke Library</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/svg+xml, image/webp"
                  onChange={(e) => {
                    if (assetModalCategory === 'FRAME') handleUploadFrame(e);
                    else handleUploadLogo(e);
                    setIsAssetModalOpen(false);
                  }}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => setIsAssetModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs font-bold hover:opacity-90"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
