'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  AssigneeRow,
  CustomKopTextElement,
  DispensationAssigneeRow,
  FlowSectionConfig,
  KopSuratConfig,
  OrganizationSnapshot,
  SignatureStampConfig,
  TemplateLayoutConfig,
} from '../documentTypes';
import { DEFAULT_ORGANIZATION_PROFILE } from '../defaultTemplates';
import { getRealtimeDocumentDate } from '@/lib/dateUtils';

interface DocumentCanvasProps {
  formData: Record<string, any>;
  layoutConfig?: TemplateLayoutConfig;
  organization?: OrganizationSnapshot;
  signatory?: {
    name: string;
    position: string;
    signature_url?: string | null;
    stamp_url?: string | null;
  };
  className?: string;
  previewMode?: boolean;
  isBuilderInteractive?: boolean;
  selectedKopElement?: string | null;
  onSelectKopElement?: (elemId: string | null) => void;
  onKopConfigChange?: (newKop: KopSuratConfig) => void;
  onSignatureConfigChange?: (newSig: SignatureStampConfig) => void;
}

// Decorative Corner Shapes SVG
const CornerAccentTopRight = () => (
  <svg
    className="absolute top-0 right-0 w-28 h-28 pointer-events-none z-1"
    viewBox="0 0 120 120"
    fill="none"
  >
    <path d="M40 0 L120 0 L120 80 Z" fill="#0052CC" opacity="0.9" />
    <path d="M70 0 L120 0 L120 50 Z" fill="#E52320" />
    <path d="M95 0 L120 0 L120 25 Z" fill="#002B7F" />
  </svg>
);

const CornerAccentBottomLeft = () => (
  <svg
    className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none z-1"
    viewBox="0 0 120 120"
    fill="none"
  >
    <path d="M0 40 L0 120 L80 120 Z" fill="#0052CC" opacity="0.9" />
    <path d="M0 70 L0 120 L50 120 Z" fill="#E52320" />
    <path d="M0 95 L0 120 L25 120 Z" fill="#002B7F" />
  </svg>
);

// KIAN Troopers Brand Logo Header Vector
const BrandLogoHeader = ({ className = '' }: { className?: string }) => (
  <div className={`flex flex-col select-none ${className}`}>
    <div className="flex items-center gap-2">
      <span className="text-2xl font-black italic tracking-tighter text-[#0066CC]">
        KI<span className="text-[#002B7F]">AN</span>
      </span>
      <span className="text-2xl font-black italic tracking-wider text-black font-sans">
        TROOPERS
      </span>
    </div>
  </div>
);

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  formData,
  layoutConfig,
  organization = DEFAULT_ORGANIZATION_PROFILE,
  signatory,
  className = '',
  previewMode = false,
  isBuilderInteractive = false,
  selectedKopElement = null,
  onSelectKopElement,
  onKopConfigChange,
  onSignatureConfigChange,
}) => {
  const assignees: AssigneeRow[] = Array.isArray(formData.assignees)
    ? formData.assignees
    : [];

  const dispensationAssignees: DispensationAssigneeRow[] = Array.isArray(formData.dispensation_assignees)
    ? formData.dispensation_assignees
    : Array.isArray(formData.dispensationAssignees)
    ? formData.dispensationAssignees
    : [];

  const kop: KopSuratConfig = layoutConfig?.kopConfig || {
    frameAssetUrl: layoutConfig?.frameAssetUrl || '',
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

  const sigConfig: SignatureStampConfig = layoutConfig?.signatureConfig || {
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

  const threshold = layoutConfig?.annexThresholdRows ?? 4;
  const isMultiPageAnnex = assignees.length >= threshold;

  // Split assignees into chunked pages for Annex if multi-page
  const ROWS_PER_ANNEX_PAGE = 12;
  const annexPages: AssigneeRow[][] = [];
  if (isMultiPageAnnex) {
    for (let i = 0; i < assignees.length; i += ROWS_PER_ANNEX_PAGE) {
      annexPages.push(assignees.slice(i, i + ROWS_PER_ANNEX_PAGE));
    }
  }

  // Dispensation multi-page Annex chunking
  const isMultiPageDispAnnex = dispensationAssignees.length >= (layoutConfig?.annexThresholdRows ?? 3);
  const ROWS_PER_DISP_ANNEX_PAGE = 5;
  const dispAnnexPages: DispensationAssigneeRow[][] = [];
  if (isMultiPageDispAnnex) {
    for (let i = 0; i < dispensationAssignees.length; i += ROWS_PER_DISP_ANNEX_PAGE) {
      dispAnnexPages.push(dispensationAssignees.slice(i, i + ROWS_PER_DISP_ANNEX_PAGE));
    }
  }

  const interpolatePlaceholders = (text: string | undefined, data: Record<string, any>): string => {
    if (!text) return '';
    return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      if (data[key] !== undefined && data[key] !== null) {
        return String(data[key]);
      }
      return match;
    });
  };

  const documentTitle = formData.document_title || 'SURAT TUGAS';
  const docNumber = formData.document_number || '1/KIAN/TROOPERS/IX/2026';
  const signerIntro = formData.signer_title_intro || 'Project Director Kian Troopers';
  const rawIntroText =
    formData.intro_text ||
    'Yang bertanda tangan dibawah ini, {signer_title_intro}, menugaskan kepada :';
  const introText = interpolatePlaceholders(rawIntroText, {
    ...formData,
    signer_title_intro: signerIntro,
  });

  const eventName =
    formData.event_name || 'BKOT (Bincang Kampus Bersama Orang Tua) UBSI';
  const rawEventIntro =
    formData.event_intro_text ||
    'Untuk berpartisipasi pada event {event_name}, dengan rincian sebagai berikut:';
  const eventIntro = interpolatePlaceholders(rawEventIntro, {
    ...formData,
    event_name: eventName,
  });
  const eventDays =
    formData.event_days || "Jum'at - Sabtu, 11 - 12 September 2026";
  const eventTime = formData.event_time || '07.30 WIB - Selesai';
  const eventLocation = formData.event_location || 'Hotel Santika Depok';

  const rawClosingText =
    formData.closing_text ||
    'Demikianlah penugasan ini agar dapat dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.';
  const closingText = interpolatePlaceholders(rawClosingText, formData);

  const docDatePlace =
    formData.document_date_place || getRealtimeDocumentDate('Jakarta');
  const signatoryPos =
    formData.signatory_position ||
    signatory?.position ||
    'Program Director Kian Troopers';
  const signatoryName =
    formData.signatory_name || signatory?.name || 'Mohamad Abi';
  const showStamp = (formData.show_stamp !== false) && sigConfig.showStamp;
  const showSignature = (formData.show_signature !== false) && (sigConfig.showSignature !== false);
  const showQr = (formData.show_qr_verification !== false) && Boolean(sigConfig.showQrVerification);
  const qrSizePx = sigConfig.qrSize ?? 72;

  const ccList: string[] = Array.isArray(formData.cc_list)
    ? formData.cc_list
    : ['1. CEO', '2. CBO', '3. Ybs'];

  // Global typography & Safe Zone margins
  const baseFontFamily = layoutConfig?.fontFamily || 'Times New Roman, Times, serif';
  const baseFontSize = layoutConfig?.fontSizeBasePt ? `${layoutConfig.fontSizeBasePt}pt` : '10.5pt';
  const tableFontFamily = layoutConfig?.tableFontFamily || baseFontFamily;
  const tableFontSize = layoutConfig?.tableFontSizePt ? `${layoutConfig.tableFontSizePt}pt` : '9.5pt';

  const contentPaddingLeft = layoutConfig?.contentPaddingLeftPx ?? (layoutConfig?.paddingMm?.left ? Math.round(layoutConfig.paddingMm.left * 3.78) : 56);
  const contentPaddingRight = layoutConfig?.contentPaddingRightPx ?? (layoutConfig?.paddingMm?.right ? Math.round(layoutConfig.paddingMm.right * 3.78) : 56);

  const isDraftOrPending = Boolean(
    formData.status &&
      formData.status !== 'ISSUED' &&
      formData.status !== 'GENERATED' &&
      formData.status !== 'SIGNED'
  );

  const activeTableColumns =
    layoutConfig?.tableColumns && layoutConfig.tableColumns.length > 0
      ? layoutConfig.tableColumns
      : [
          { key: 'no', label: 'No', widthPercent: 8, align: 'center' as const },
          { key: 'nip', label: 'NIP', widthPercent: 22, align: 'center' as const },
          { key: 'name', label: 'NAMA', widthPercent: 42, align: 'left' as const },
          { key: 'role', label: 'Tugas', widthPercent: 28, align: 'left' as const },
        ];

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const docIdForVerification = formData.document_id || formData.id || formData.document_number || 'preview';
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/document/${encodeURIComponent(docIdForVerification)}`
    : `https://kianhq.com/verify/document/${encodeURIComponent(docIdForVerification)}`;

  useEffect(() => {
    let isMounted = true;
    import('qrcode')
      .then(({ default: QRCode }) => {
        return QRCode.toDataURL(verificationUrl, {
          margin: 1,
          width: 200,
          errorCorrectionLevel: 'H',
          color: {
            dark: '#002B7F',
            light: '#FFFFFF',
          },
        });
      })
      .then((url) => {
        if (isMounted && url) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate document QR Code:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [verificationUrl]);

  // Drag-and-drop state inside interactive builder
  const canvasRef = useRef<HTMLDivElement>(null);
  const kopRef = useRef(kop);
  kopRef.current = kop;

  const [draggingTarget, setDraggingTarget] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    mouseX: number;
    mouseY: number;
    origX: number;
    origY: number;
  }>({ mouseX: 0, mouseY: 0, origX: 0, origY: 0 });

  const handleStartDrag = (
    e: React.MouseEvent,
    targetId: string
  ) => {
    if (!isBuilderInteractive || !onKopConfigChange) return;
    e.stopPropagation();
    e.preventDefault();

    if (onSelectKopElement) onSelectKopElement(targetId);
    setDraggingTarget(targetId);

    const currentKop = kopRef.current;
    let initialX = 0;
    let initialY = 0;

    if (targetId === 'logo') {
      initialX = currentKop.logo.x;
      initialY = currentKop.logo.y;
    } else if (targetId === 'titleBlock') {
      initialX = currentKop.titleBlock.x;
      initialY = currentKop.titleBlock.y;
    } else if (targetId === 'flowLimit') {
      initialX = 0;
      initialY = currentKop.kopHeightPx;
    } else if (targetId.startsWith('customText_')) {
      const cId = targetId.replace('customText_', '');
      const item = (currentKop.customTexts || []).find((c) => c.id === cId);
      if (item) {
        initialX = item.x;
        initialY = item.y;
      }
    }

    setDragStartPos({
      mouseX: e.clientX,
      mouseY: e.clientY,
      origX: initialX,
      origY: initialY,
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingTarget || !onKopConfigChange) return;

      const scale = canvasRef.current
        ? canvasRef.current.getBoundingClientRect().width / 794
        : 1;

      const deltaX = Math.round((e.clientX - dragStartPos.mouseX) / (scale || 1));
      const deltaY = Math.round((e.clientY - dragStartPos.mouseY) / (scale || 1));
      const currentKop = kopRef.current;

      if (draggingTarget === 'logo') {
        const nextX = Math.max(0, Math.min(650, dragStartPos.origX + deltaX));
        const nextY = Math.max(0, Math.min(1000, dragStartPos.origY + deltaY));
        onKopConfigChange({
          ...currentKop,
          logo: { ...currentKop.logo, x: nextX, y: nextY },
        });
      } else if (draggingTarget === 'titleBlock') {
        const nextX = Math.max(0, Math.min(500, dragStartPos.origX + deltaX));
        const nextY = Math.max(0, Math.min(1000, dragStartPos.origY + deltaY));
        onKopConfigChange({
          ...currentKop,
          titleBlock: { ...currentKop.titleBlock, x: nextX, y: nextY },
        });
      } else if (draggingTarget === 'flowLimit') {
        const nextH = Math.max(100, Math.min(600, dragStartPos.origY + deltaY));
        onKopConfigChange({
          ...currentKop,
          kopHeightPx: nextH,
        });
      } else if (draggingTarget.startsWith('customText_')) {
        const cId = draggingTarget.replace('customText_', '');
        const updatedList = (currentKop.customTexts || []).map((item) => {
          if (item.id === cId) {
            return {
              ...item,
              x: Math.max(0, Math.min(750, dragStartPos.origX + deltaX)),
              y: Math.max(0, Math.min(1080, dragStartPos.origY + deltaY)),
            };
          }
          return item;
        });
        onKopConfigChange({
          ...currentKop,
          customTexts: updatedList,
        });
      }
    };

    const handleMouseUp = () => {
      if (draggingTarget) {
        setDraggingTarget(null);
      }
    };

    if (draggingTarget) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingTarget, dragStartPos, onKopConfigChange]);

  const hasCustomFrame = Boolean(kop.frameAssetUrl && kop.frameAssetUrl.trim().length > 0);

  return (
    <div
      className={`flex flex-col items-center gap-8 print:gap-0 select-text ${className}`}
      style={{ fontFamily: baseFontFamily }}
    >
      {/* ======================================================== */}
      {/* PAGE 1: SURAT UTAMA                                      */}
      {/* ======================================================== */}
      <div
        ref={canvasRef}
        id="document-page-1"
        className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col overflow-hidden"
        style={{
          width: '794px', // Standard A4 width @ 96 DPI (210mm)
          minWidth: '794px',
          maxWidth: '794px',
          height: '1123px', // Standard A4 height @ 96 DPI (297mm)
          minHeight: '1123px',
          maxHeight: '1123px',
          flexShrink: 0,
          paddingTop: '48px',
          paddingBottom: '42px',
          paddingLeft: `${contentPaddingLeft}px`,
          paddingRight: `${contentPaddingRight}px`,
          fontFamily: baseFontFamily,
          fontSize: baseFontSize,
          boxSizing: 'border-box',
        }}
      >
        {/* Frame Background Layer */}
        {hasCustomFrame ? (
          <img
            src={kop.frameAssetUrl}
            alt="Custom Frame"
            className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none"
            style={{ opacity: kop.frameOpacity ?? 1 }}
          />
        ) : (
          <>
            <div className="absolute inset-5 border-[1.5px] border-[#002B7F]/80 pointer-events-none z-1" />
            <CornerAccentTopRight />
            <CornerAccentBottomLeft />
          </>
        )}

        {/* Visual Safe Zone Margin Guides (In Interactive Builder Mode) */}
        {isBuilderInteractive && (
          <>
            <div
              className="absolute top-0 bottom-0 pointer-events-none border-r border-dashed border-indigo-400/50 z-20"
              style={{ left: `${contentPaddingLeft}px` }}
            >
              <span className="absolute top-2 left-1 text-[8px] font-mono font-bold text-indigo-600 bg-indigo-50/90 px-1 py-0.5 rounded shadow-xs">
                ◀ Margin Kiri ({contentPaddingLeft}px)
              </span>
            </div>
            <div
              className="absolute top-0 bottom-0 pointer-events-none border-l border-dashed border-indigo-400/50 z-20"
              style={{ right: `${contentPaddingRight}px` }}
            >
              <span className="absolute top-2 right-1 text-[8px] font-mono font-bold text-indigo-600 bg-indigo-50/90 px-1 py-0.5 rounded shadow-xs">
                Margin Kanan ({contentPaddingRight}px) ▶
              </span>
            </div>
          </>
        )}

        {/* Draft / Unofficial Watermark Overlay */}
        {isDraftOrPending && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-25 select-none overflow-hidden">
            <div className="transform -rotate-45 border-4 border-dashed border-red-500/25 px-12 py-5 rounded-3xl bg-white/40 backdrop-blur-[1px] shadow-sm">
              <span className="text-3xl sm:text-4xl font-black text-red-500/30 tracking-widest uppercase font-mono block text-center">
                {formData.status === 'PENDING_APPROVAL'
                  ? 'MENUNGGU PERSETUJUAN'
                  : formData.status === 'REJECTED'
                  ? 'DRAF DITOLAK'
                  : 'DRAF RESMI (BELUM DITERBITKAN)'}
              </span>
              <span className="text-[11px] font-bold text-red-500/40 tracking-wider uppercase block text-center mt-1">
                TIDAK BERLAKU SEBAGAI DOKUMEN HUKUM / TUGAS RESMI
              </span>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* KOP & DRAGGABLE LAYER (ABSOLUTE POSITIONED & DRAGGABLE)  */}
        {/* ======================================================== */}
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* 1. LOGO ELEMENT */}
          {kop.logo.enabled && (
            <div
              onMouseDown={(e) => handleStartDrag(e, 'logo')}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectKopElement) onSelectKopElement('logo');
              }}
              className={`absolute pointer-events-auto transition-shadow duration-150 ${
                isBuilderInteractive
                  ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-purple-500 rounded p-1'
                  : ''
              } ${
                isBuilderInteractive && selectedKopElement === 'logo'
                  ? 'ring-2 ring-purple-600 bg-purple-500/10 shadow-lg'
                  : ''
              }`}
              style={{
                left: `${kop.logo.x}px`,
                top: `${kop.logo.y}px`,
                width: `${kop.logo.width}px`,
              }}
            >
              {kop.logo.assetUrl ? (
                <img
                  src={kop.logo.assetUrl}
                  alt="Logo"
                  className="w-full object-contain pointer-events-none select-none max-h-16"
                />
              ) : (
                <BrandLogoHeader />
              )}
              {isBuilderInteractive && selectedKopElement === 'logo' && (
                <span className="absolute -top-4 -left-1 text-[8px] bg-purple-600 text-white font-mono font-bold px-1 rounded shadow-xs">
                  Logo (Drag)
                </span>
              )}
            </div>
          )}

          {/* 2. TITLE & DOCUMENT NUMBER BLOCK */}
          {kop.titleBlock.enabled && (
            <div
              onMouseDown={(e) => handleStartDrag(e, 'titleBlock')}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectKopElement) onSelectKopElement('titleBlock');
              }}
              className={`absolute pointer-events-auto transition-shadow duration-150 ${
                isBuilderInteractive
                  ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-purple-500 rounded p-1'
                  : ''
              } ${
                isBuilderInteractive && selectedKopElement === 'titleBlock'
                  ? 'ring-2 ring-purple-600 bg-purple-500/10 shadow-lg'
                  : ''
              }`}
              style={{
                left: `${kop.titleBlock.x}px`,
                top: `${kop.titleBlock.y}px`,
                width: `${kop.titleBlock.width}px`,
                textAlign: kop.titleBlock.align || 'center',
                fontFamily: kop.titleBlock.fontFamily || baseFontFamily,
              }}
            >
              <h1
                className="font-bold tracking-wider underline uppercase text-black select-none whitespace-pre-line leading-tight block break-words"
                style={{ fontSize: `${kop.titleBlock.titleFontSizePt}pt` }}
              >
                {documentTitle}
              </h1>
              <p
                className="font-normal text-zinc-800 mt-1 select-none"
                style={{ fontSize: `${kop.titleBlock.numberFontSizePt}pt` }}
              >
                Nomor : {docNumber}
              </p>
              {isBuilderInteractive && selectedKopElement === 'titleBlock' && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] bg-purple-600 text-white font-mono font-bold px-1.5 rounded shadow-xs">
                  Judul &amp; Nomor (Drag)
                </span>
              )}
            </div>
          )}

          {/* 3. CUSTOM ADDED TEXT ELEMENTS (Alamat, Website, Kontak, dll.) */}
          {(kop.customTexts || []).map((ct) => (
            <div
              key={ct.id}
              onMouseDown={(e) => handleStartDrag(e, `customText_${ct.id}`)}
              onClick={(e) => {
                e.stopPropagation();
                if (onSelectKopElement) onSelectKopElement(`customText_${ct.id}`);
              }}
              className={`absolute pointer-events-auto transition-shadow duration-150 ${
                isBuilderInteractive
                  ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-indigo-500 rounded px-1'
                  : ''
              } ${
                isBuilderInteractive && selectedKopElement === `customText_${ct.id}`
                  ? 'ring-2 ring-indigo-600 bg-indigo-500/10 shadow-lg'
                  : ''
              }`}
              style={{
                left: `${ct.x}px`,
                top: `${ct.y}px`,
                width: ct.width ? `${ct.width}px` : 'auto',
                maxWidth: ct.width ? `${ct.width}px` : '680px',
                fontSize: `${ct.fontSizePt}pt`,
                fontFamily: ct.fontFamily || baseFontFamily,
                fontWeight: ct.fontWeight || 'normal',
                color: ct.color || '#333333',
                textAlign: ct.align || 'left',
                fontStyle: ct.isItalic ? 'italic' : 'normal',
                textDecoration: ct.isUnderline ? 'underline' : 'none',
              }}
            >
              <span className="select-none whitespace-pre-wrap leading-tight block break-words">
                {ct.text}
              </span>
              {isBuilderInteractive && selectedKopElement === `customText_${ct.id}` && (
                <span className="absolute -top-3.5 -left-1 text-[8px] bg-indigo-600 text-white font-mono font-bold px-1 rounded shadow-xs">
                  {ct.name || 'Custom Teks'} (Drag)
                </span>
              )}
            </div>
          ))}

          {/* 4. VISUAL FLOW START LIMIT GUIDE (IN BUILDER MODE ONLY) */}
          {isBuilderInteractive && (
            <div
              onMouseDown={(e) => handleStartDrag(e, 'flowLimit')}
              className="absolute inset-x-4 pointer-events-auto flex items-center justify-between cursor-row-resize group z-30"
              style={{ top: `${kop.kopHeightPx}px` }}
              title="Drag ke atas/bawah untuk mengatur batas mulai isi konten"
            >
              <div className="flex-1 border-t-2 border-dashed border-purple-500 opacity-70 group-hover:opacity-100" />
              <span className="bg-purple-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded shadow-sm">
                ▼ Mulai Isi Konten Dinamis ({kop.kopHeightPx}px)
              </span>
              <div className="flex-1 border-t-2 border-dashed border-purple-500 opacity-70 group-hover:opacity-100" />
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* DYNAMIC FLOW CONTENT CONTAINER (STARTS BELOW KOP SURAT)  */}
        {/* ======================================================== */}
        <div
          className="relative z-10 flex flex-col flex-1"
          style={{
            marginTop: `${Math.max(120, kop.kopHeightPx - 48)}px`,
            fontSize: baseFontSize,
          }}
        >
          {(() => {
            const interpolatePlaceholders = (text: string | undefined, data: Record<string, any>): string => {
              if (!text) return '';
              return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
                if (data[key] !== undefined && data[key] !== null) {
                  return String(data[key]);
                }
                return match;
              });
            };

            const defaultFlowList: FlowSectionConfig[] = [
              { id: 'sec_intro', type: 'INTRO_TEXT', visible: true, spacingBottomMm: 4 },
              { id: 'sec_table', type: 'ASSIGNEE_TABLE', visible: true, spacingBottomMm: 6 },
              { id: 'sec_event', type: 'EVENT_DETAILS', visible: true, spacingBottomMm: 6 },
              { id: 'sec_closing', type: 'CLOSING_TEXT', visible: true, spacingBottomMm: 8 },
              { id: 'sec_sig', type: 'SIGNATURE_BLOCK', visible: true, spacingBottomMm: 6 },
              { id: 'sec_cc', type: 'TEMBUSAN_BLOCK', visible: true, spacingBottomMm: 4 },
            ];

            const flowList = layoutConfig?.flowSections && layoutConfig.flowSections.length > 0
              ? layoutConfig.flowSections
              : defaultFlowList;

            return flowList.map((sec, secIdx) => {
              if (sec.visible === false) return null;
              const mbStyle = sec.spacingBottomMm !== undefined ? `${sec.spacingBottomMm * 3.78}px` : '10px';

              // 1. RECIPIENT BLOCK
              if (sec.type === 'RECIPIENT_BLOCK') {
                const rawRecipient = formData[sec.contentKey || 'recipient_info'] || sec.content || formData.recipient_info;
                if (!rawRecipient) return null;
                const interpolated = interpolatePlaceholders(rawRecipient, formData);
                return (
                  <div key={sec.id || secIdx} className="leading-relaxed text-zinc-900" style={{ marginBottom: mbStyle }}>
                    <div className="whitespace-pre-line font-normal">{interpolated}</div>
                  </div>
                );
              }

              // 2. PARAGRAPHS (INTRO / PARAGRAPH / BODY / CLOSING)
              if (
                sec.type === 'INTRO_TEXT' ||
                sec.type === 'PARAGRAPH' ||
                sec.type === 'CUSTOM_PARAGRAPH' ||
                sec.type === 'CLOSING_TEXT'
              ) {
                let rawText = '';
                if (sec.contentKey && formData[sec.contentKey]) {
                  rawText = formData[sec.contentKey];
                } else if (formData[sec.id]) {
                  rawText = formData[sec.id];
                } else if (sec.content) {
                  rawText = sec.content;
                } else if (sec.type === 'INTRO_TEXT') {
                  rawText = introText;
                } else if (sec.type === 'CLOSING_TEXT') {
                  rawText = closingText;
                } else if (formData.body_content) {
                  rawText = formData.body_content;
                }

                if (!rawText) return null;
                const interpolated = interpolatePlaceholders(rawText, formData);
                return (
                  <div key={sec.id || secIdx} className="leading-relaxed text-zinc-900 text-justify" style={{ marginBottom: mbStyle }}>
                    <p className="whitespace-pre-line">{interpolated}</p>
                  </div>
                );
              }

              // 3. KEY_VALUE_GRID / EVENT_DETAILS / PERSON DETAILS
              if (sec.type === 'KEY_VALUE_GRID' || sec.type === 'EVENT_DETAILS') {
                const customDetails: any[] = Array.isArray(formData.event_custom_details)
                  ? formData.event_custom_details
                  : [];
                const personCustomDetails: any[] = Array.isArray(formData.person_custom_details)
                  ? formData.person_custom_details
                  : [];

                const hasPersonData = Boolean(formData.person_name || personCustomDetails.length > 0);
                const hasEventData = Boolean(
                  formData.event_days ||
                  formData.event_name ||
                  formData.event_location ||
                  formData.event_time ||
                  formData.event_agenda ||
                  customDetails.length > 0
                );
                const intro = formData.event_intro_text || sec.content;
                const interpolatedIntro = intro ? interpolatePlaceholders(intro, formData) : null;

                return (
                  <div key={sec.id || secIdx} className="leading-relaxed text-zinc-900" style={{ marginBottom: mbStyle }}>
                    {interpolatedIntro && <p className="mb-1.5 text-justify">{interpolatedIntro}</p>}

                    {hasPersonData && (
                      <div className="grid grid-cols-[130px_12px_1fr] gap-y-1 pl-4 my-1">
                        {formData.person_name && (
                          <>
                            <span className="font-normal">{formData.person_name_label || 'Nama'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.person_name}</span>
                          </>
                        )}

                        {formData.person_nip && (
                          <>
                            <span className="font-normal">{formData.person_nip_label || 'NIP / NIM'}</span>
                            <span>:</span>
                            <span className="font-medium font-mono">{formData.person_nip}</span>
                          </>
                        )}

                        {formData.person_role && (
                          <>
                            <span className="font-normal">{formData.person_role_label || 'Jabatan / Posisi'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.person_role}</span>
                          </>
                        )}

                        {formData.person_institution && (
                          <>
                            <span className="font-normal">{formData.person_institution_label || 'Institusi / Asal'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.person_institution}</span>
                          </>
                        )}

                        {formData.person_address && (
                          <>
                            <span className="font-normal">{formData.person_address_label || 'Alamat'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.person_address}</span>
                          </>
                        )}

                        {personCustomDetails.map((item: any, idx: number) => {
                          if (!item || (!item.label && !item.value)) return null;
                          return (
                            <React.Fragment key={item.id || idx}>
                              <span className="font-normal">{item.label || 'Keterangan'}</span>
                              <span>:</span>
                              <span className="font-medium whitespace-pre-line">{item.value}</span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {hasEventData && !hasPersonData && (
                      <div className="grid grid-cols-[115px_12px_1fr] gap-y-1 pl-6 my-1">
                        {formData.event_days && (
                          <>
                            <span className="font-normal">{formData.event_days_label || 'Hari'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.event_days}</span>
                          </>
                        )}
                        {formData.event_time && (
                          <>
                            <span className="font-normal">{formData.event_time_label || 'Pukul'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.event_time}</span>
                          </>
                        )}
                        {formData.event_location && (
                          <>
                            <span className="font-normal">{formData.event_location_label || 'Tempat'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.event_location}</span>
                          </>
                        )}
                        {formData.event_agenda && (
                          <>
                            <span className="font-normal">{formData.event_agenda_label || 'Agenda'}</span>
                            <span>:</span>
                            <span className="font-medium">{formData.event_agenda}</span>
                          </>
                        )}
                        {/* Dynamic Custom Details (e.g. Dresscode, Perlengkapan, Biaya, PIC, dll) */}
                        {customDetails.map((item: any, idx: number) => {
                          if (!item || (!item.label && !item.value)) return null;
                          return (
                            <React.Fragment key={item.id || idx}>
                              <span className="font-normal">{item.label || 'Keterangan'}</span>
                              <span>:</span>
                              <span className="font-medium whitespace-pre-line">{item.value}</span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // 4. ASSIGNEE_TABLE
              if (sec.type === 'ASSIGNEE_TABLE') {
                if (assignees.length === 0) return null;
                return !isMultiPageAnnex ? (
                  <div key={sec.id || secIdx} style={{ marginBottom: mbStyle }}>
                    <table
                      className="w-full border-collapse border border-zinc-800 text-zinc-900 bg-white/90"
                      style={{ fontFamily: tableFontFamily, fontSize: tableFontSize }}
                    >
                      <thead>
                        <tr className="bg-zinc-100/70">
                          {activeTableColumns.map((col, cIdx) => (
                            <th
                              key={col.key || cIdx}
                              className={`border border-zinc-800 px-2 py-1.5 font-bold ${
                                col.align === 'center'
                                  ? 'text-center'
                                  : col.align === 'right'
                                  ? 'text-right'
                                  : 'text-left'
                              }`}
                              style={{ width: col.widthPercent ? `${col.widthPercent}%` : undefined }}
                            >
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {assignees.map((row, idx) => (
                          <tr key={idx}>
                            {activeTableColumns.map((col, cIdx) => {
                              let cellVal = (row as any)[col.key];
                              if (col.key === 'no') cellVal = row.no || idx + 1;
                              return (
                                <td
                                  key={col.key || cIdx}
                                  className={`border border-zinc-800 px-2 py-1.5 ${
                                    col.align === 'center'
                                      ? 'text-center'
                                      : col.align === 'right'
                                      ? 'text-right'
                                      : 'text-left'
                                  } ${col.key === 'name' ? 'font-medium' : col.key === 'nip' ? 'font-mono' : ''}`}
                                >
                                  {cellVal !== undefined && cellVal !== null ? cellVal : ''}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div key={sec.id || secIdx} style={{ marginBottom: mbStyle }} className="p-3 bg-zinc-50/90 border border-dashed border-zinc-400 rounded text-xs text-zinc-700 italic flex items-center justify-between">
                    <span>
                      📋 <strong>Daftar Nama Personil ({assignees.length} Orang)</strong> terlampir lengkap pada <strong>Lampiran Dokumen</strong> (Halaman 2).
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                      Lihat Lampiran
                    </span>
                  </div>
                );
              }

              // 4b. DISPENSATION_TABLE (Mahasiswa & Perkuliahan)
              if (sec.type === 'DISPENSATION_TABLE') {
                if (dispensationAssignees.length === 0) return null;

                return !isMultiPageDispAnnex ? (
                  <div key={sec.id || secIdx} style={{ marginBottom: mbStyle }}>
                    <table
                      className="w-full border-collapse border border-zinc-800 text-zinc-900 bg-white/95"
                      style={{ fontFamily: tableFontFamily, fontSize: tableFontSize }}
                    >
                      <thead>
                        <tr className="bg-zinc-100/80 text-zinc-950 font-bold">
                          <th className="border border-zinc-800 px-1.5 py-1.5 text-center w-[6%]">No</th>
                          <th className="border border-zinc-800 px-2 py-1.5 text-left w-[25%]">Nama &amp; NIM</th>
                          <th className="border border-zinc-800 px-2 py-1.5 text-left w-[25%]">Program Studi &amp; Kampus</th>
                          <th className="border border-zinc-800 px-1.5 py-1.5 text-center w-[12%]">Kelas</th>
                          <th className="border border-zinc-800 px-2 py-1.5 text-left w-[32%]">Mata Kuliah &amp; Waktu</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dispensationAssignees.map((row, idx) => {
                          const activeCourses = (row.courses || []).filter((c) => c.selected !== false);
                          return (
                            <tr key={idx} className="align-top">
                              <td className="border border-zinc-800 px-1.5 py-1.5 text-center font-bold">
                                {row.no || idx + 1}
                              </td>
                              <td className="border border-zinc-800 px-2 py-1.5">
                                <div className="font-bold text-zinc-950">{row.name}</div>
                                {row.nim && (
                                  <div className="text-[8pt] font-mono text-zinc-600">NIM: {row.nim}</div>
                                )}
                              </td>
                              <td className="border border-zinc-800 px-2 py-1.5">
                                <div className="font-medium text-zinc-900">{row.studyProgram}</div>
                                {row.university && (
                                  <div className="text-[8pt] text-zinc-600 leading-tight">{row.university}</div>
                                )}
                              </td>
                              <td className="border border-zinc-800 px-1.5 py-1.5 text-center font-medium font-mono text-[8.5pt]">
                                {row.classCode || '-'}
                              </td>
                              <td className="border border-zinc-800 px-2 py-1.5">
                                {activeCourses.length === 0 ? (
                                  <span className="text-zinc-500 italic text-[8pt]">Semua Perkuliahan pada Hari Tersebut</span>
                                ) : (
                                  <div className="space-y-1.5">
                                    {activeCourses.map((c, cIdx) => {
                                      const codePrefix = c.courseCode ? `[${c.courseCode}] ` : '';
                                      const lecturerStr = c.lecturerName
                                        ? (c.lecturerCode ? `[${c.lecturerCode}] ${c.lecturerName}` : c.lecturerName)
                                        : '';

                                      return (
                                        <div
                                          key={c.id || cIdx}
                                          className="text-[8pt] leading-tight pb-1.5 last:pb-0 border-b border-zinc-200/70 last:border-b-0"
                                        >
                                          <div className="font-bold text-zinc-950">
                                            • {codePrefix}{c.courseName}
                                          </div>
                                          <div className="text-[7.5pt] text-zinc-700 pl-2 mt-0.5">
                                            <span>⏰ {c.dayName ? `${c.dayName}, ` : ''}{c.startTime} - {c.endTime} WIB</span>
                                            {c.room && <span className="ml-1.5 text-zinc-600 font-medium">| 📍 Ruang: {c.room}</span>}
                                          </div>
                                          {(lecturerStr || c.notes) && (
                                            <div className="text-[7.5pt] text-zinc-600 pl-2 italic mt-0.5">
                                              {lecturerStr && <span>👨‍🏫 Dosen: {lecturerStr}</span>}
                                              {lecturerStr && c.notes && <span className="mx-1">|</span>}
                                              {c.notes && <span className="text-zinc-500 font-normal">({c.notes})</span>}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div key={sec.id || secIdx} style={{ marginBottom: mbStyle }} className="p-3 bg-zinc-50/90 border border-dashed border-zinc-400 rounded text-xs text-zinc-700 italic flex items-center justify-between">
                    <span>
                      📋 <strong>Daftar Rincian Mahasiswa &amp; Perkuliahan ({dispensationAssignees.length} Mahasiswa)</strong> terlampir lengkap pada <strong>Lampiran Dokumen</strong> (Halaman 2).
                    </span>
                    <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                      Lihat Lampiran
                    </span>
                  </div>
                );
              }

              // 5. REPEATABLE LIST
              if (sec.type === 'REPEATABLE_LIST') {
                const listData: string[] = Array.isArray(formData[sec.contentKey || 'statement_points'])
                  ? formData[sec.contentKey || 'statement_points']
                  : Array.isArray(formData[sec.id])
                  ? formData[sec.id]
                  : Array.isArray(formData.statement_points)
                  ? formData.statement_points
                  : [];

                if (listData.length === 0) return null;
                return (
                  <div key={sec.id || secIdx} className="leading-relaxed text-zinc-900 pl-4 space-y-1.5" style={{ marginBottom: mbStyle }}>
                    {listData.map((item, idx) => (
                      <div key={idx} className="text-justify">
                        {item}
                      </div>
                    ))}
                  </div>
                );
              }

              // 6. DIVIDER
              if (sec.type === 'DIVIDER') {
                return (
                  <hr key={sec.id || secIdx} className="border-t border-zinc-300 my-2" style={{ marginBottom: mbStyle }} />
                );
              }

              // 7. SIGNATURE_BLOCK
              if (sec.type === 'SIGNATURE_BLOCK') {
                return (
                  <div key={sec.id || secIdx} className="mt-2 mb-2" style={{ marginBottom: mbStyle }}>
                    <div
                      className={`flex pr-4 mb-2 ${
                        sigConfig.align === 'center'
                          ? 'justify-center'
                          : sigConfig.align === 'left'
                          ? 'justify-start'
                          : 'justify-end'
                      }`}
                    >
                      <div className="flex flex-col items-center text-center w-72">
                        <p className="text-zinc-900">{docDatePlace}</p>
                        <p className="font-normal text-zinc-900 mb-1">{signatoryPos}</p>

                        {/* Main Signature / QR / Stamp Space */}
                        <div
                          className={`relative flex items-center justify-center my-1 ${
                            showQr && showSignature
                              ? 'h-24 w-64 gap-3'
                              : showQr
                              ? 'h-24 w-52'
                              : 'h-20 w-48'
                          }`}
                        >
                          {/* Custom Stamp / Cap overlay */}
                          {showStamp && (
                            <div
                              className="absolute pointer-events-none z-10"
                              style={{
                                left: `${sigConfig.stampOffsetX ?? -12}px`,
                                top: `${sigConfig.stampOffsetY ?? 0}px`,
                                transform: `scale(${sigConfig.stampScale ?? 1}) rotate(${sigConfig.stampRotation ?? 0}deg)`,
                                opacity: sigConfig.stampOpacity ?? 0.85,
                                width: '96px',
                                height: '96px',
                              }}
                            >
                              {sigConfig.stampAssetUrl ? (
                                <img src={sigConfig.stampAssetUrl} alt="Stamp" className="w-full h-full object-contain" />
                              ) : (
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                  <circle cx="50" cy="50" r="45" stroke="#0066CC" strokeWidth="2.5" fill="none" strokeDasharray="4 2" />
                                  <circle cx="50" cy="50" r="38" stroke="#0066CC" strokeWidth="1.5" fill="none" />
                                  <text x="50" y="34" textAnchor="middle" fill="#0066CC" fontSize="7" fontWeight="900" letterSpacing="1">
                                    KIAN TROOPERS
                                  </text>
                                  <text x="50" y="52" textAnchor="middle" fill="#002B7F" fontSize="12" fontWeight="900">
                                    ★ KIAN ★
                                  </text>
                                  <text x="50" y="68" textAnchor="middle" fill="#0066CC" fontSize="6" fontWeight="bold">
                                    INDONESIA
                                  </text>
                                </svg>
                              )}
                            </div>
                          )}

                          {/* Hand Signature Graphic */}
                          {showSignature && (
                            <div className="z-20 flex items-center justify-center">
                              {sigConfig.signatureAssetUrl || signatory?.signature_url ? (
                                <img
                                  src={sigConfig.signatureAssetUrl || signatory?.signature_url || ''}
                                  alt="Signature"
                                  className="max-h-16 object-contain"
                                  style={{ transform: `scale(${sigConfig.signatureScale ?? 1})` }}
                                />
                              ) : (
                                <svg
                                  viewBox="0 0 200 80"
                                  className="w-40 h-16 text-zinc-900 stroke-current fill-none"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ transform: `scale(${sigConfig.signatureScale ?? 1})` }}
                                >
                                  <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40 M 60 45 Q 110 50 170 38" />
                                </svg>
                              )}
                            </div>
                          )}

                          {/* Digital Signature QR Code */}
                          {showQr && (
                            <div className="z-20 flex flex-col items-center justify-center">
                              <a
                                href={verificationUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Klik / Scan untuk Verifikasi Keaslian Dokumen"
                                className="relative rounded-lg p-1 bg-white border border-blue-900/30 shadow-xs flex items-center justify-center hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer group"
                                style={{ width: `${qrSizePx}px`, height: `${qrSizePx}px` }}
                              >
                                {qrCodeDataUrl ? (
                                  <img src={qrCodeDataUrl} alt="QR Verifikasi Dokumen" className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-[8px] font-mono text-zinc-400">
                                    QR Code
                                  </div>
                                )}
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-md bg-white border border-blue-900/40 shadow-xs flex items-center justify-center p-0.5 pointer-events-none">
                                  <div className="w-full h-full rounded bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white leading-none">
                                    K
                                  </div>
                                </div>
                              </a>
                              <span className="text-[7.5px] font-bold text-zinc-600 mt-1 uppercase tracking-tight block">
                                Scan TTD Digital
                              </span>
                            </div>
                          )}
                        </div>

                        <p className="font-bold text-zinc-950 underline mt-1">{signatoryName}</p>
                      </div>
                    </div>
                  </div>
                );
              }

              // 8. TEMBUSAN_BLOCK
              if (sec.type === 'TEMBUSAN_BLOCK') {
                if (ccList.length === 0) return null;
                return (
                  <div key={sec.id || secIdx} className="pt-2 pl-8 text-[10.5px] text-zinc-800 max-w-[360px]" style={{ marginBottom: mbStyle }}>
                    <p className="font-bold mb-0.5">Tembusan :</p>
                    <ul className="space-y-0.5 pl-1">
                      {ccList.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              }

              return null;
            });
          })()}
        </div>

        {/* Fixed Bottom Footer (Only rendered when not using custom background frame) */}
        {!hasCustomFrame && (
          <div className="relative z-10 pt-3 border-t border-zinc-200 mt-2 flex items-end justify-between text-[8.5px] leading-tight text-zinc-600 font-sans">
            <div className="max-w-[420px]">
              <p>{organization.address_line_1}</p>
              <p>{organization.address_line_2}</p>
              <p className="mt-0.5 font-medium text-zinc-700">
                Telp. {organization.phone}, Email : {organization.email}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-semibold text-zinc-800">
                {organization.website}
              </span>
              <div className="flex items-center gap-1">
                <span className="w-3 h-1.5 bg-[#0066CC] rounded-xs" />
                <span className="w-3 h-1.5 bg-[#E52320] rounded-xs" />
                <span className="w-3 h-1.5 bg-[#002B7F] rounded-xs" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* PAGE 2+: LAMPIRAN SURAT TUGAS (If Multi-page Annex)      */}
      {/* ======================================================== */}
      {isMultiPageAnnex &&
        annexPages.map((pageRows, pageIdx) => {
          const isLastPage = pageIdx === annexPages.length - 1;
          const pageNumber = pageIdx + 2;

          return (
            <div
              key={pageIdx}
              id={`document-page-${pageNumber}`}
              className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col overflow-hidden"
              style={{
                width: '794px',
                minWidth: '794px',
                maxWidth: '794px',
                height: '1123px',
                minHeight: '1123px',
                maxHeight: '1123px',
                flexShrink: 0,
                paddingTop: '48px',
                paddingBottom: '42px',
                paddingLeft: `${contentPaddingLeft}px`,
                paddingRight: `${contentPaddingRight}px`,
                fontFamily: baseFontFamily,
                fontSize: baseFontSize,
                boxSizing: 'border-box',
              }}
            >
              {/* Frame Background Layer */}
              {hasCustomFrame ? (
                <img
                  src={kop.frameAssetUrl}
                  alt="Custom Frame"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none"
                  style={{ opacity: kop.frameOpacity ?? 1 }}
                />
              ) : (
                <>
                  <div className="absolute inset-5 border-[1.5px] border-[#002B7F]/80 pointer-events-none z-1" />
                  <CornerAccentTopRight />
                  <CornerAccentBottomLeft />
                </>
              )}

              <div className="relative z-10 flex flex-col flex-1">
                {/* Header Logo */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <BrandLogoHeader />
                  <span className="text-[10px] font-sans font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                    Halaman {pageNumber} dari {annexPages.length + 1}
                  </span>
                </div>

                {/* Annex Title Block */}
                <div className="text-center my-3">
                  <h2 className="text-sm font-bold tracking-wider underline uppercase text-black">
                    LAMPIRAN SURAT TUGAS
                  </h2>
                  <p className="text-[11px] font-normal text-zinc-700 mt-0.5">
                    Nomor : {docNumber}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    Event: <strong>{eventName}</strong> ({eventDays})
                  </p>
                </div>

                {/* Full Paginated Assignee Table */}
                <div className="mb-4">
                  <table
                    className="w-full border-collapse border border-zinc-800 text-zinc-900 bg-white/90"
                    style={{ fontFamily: tableFontFamily, fontSize: tableFontSize }}
                  >
                    <thead>
                      <tr className="bg-zinc-100">
                        {activeTableColumns.map((col, cIdx) => (
                          <th
                            key={col.key || cIdx}
                            className={`border border-zinc-800 px-2 py-1.5 font-bold ${
                              col.align === 'center'
                                ? 'text-center'
                                : col.align === 'right'
                                ? 'text-right'
                                : 'text-left'
                            }`}
                            style={{ width: col.widthPercent ? `${col.widthPercent}%` : undefined }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, rIdx) => {
                        const globalIndex =
                          pageIdx * ROWS_PER_ANNEX_PAGE + rIdx + 1;
                        return (
                          <tr key={rIdx} className="hover:bg-zinc-50">
                            {activeTableColumns.map((col, cIdx) => {
                              let cellVal = (row as any)[col.key];
                              if (col.key === 'no') cellVal = row.no || globalIndex;
                              return (
                                <td
                                  key={col.key || cIdx}
                                  className={`border border-zinc-800 px-2 py-1.5 ${
                                    col.align === 'center'
                                      ? 'text-center'
                                      : col.align === 'right'
                                      ? 'text-right'
                                      : 'text-left'
                                  } ${col.key === 'name' ? 'font-medium' : col.key === 'nip' ? 'font-mono' : ''}`}
                                >
                                  {cellVal !== undefined && cellVal !== null ? cellVal : ''}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* On the Last Lampiran Page, show the Official Validation Signatory */}
                {isLastPage && (
                  <div className="flex justify-end mt-auto mb-2 pr-4">
                    <div className="flex flex-col items-center text-center w-64">
                      <p className="text-zinc-900">{docDatePlace}</p>
                      <p className="font-normal text-zinc-900 mb-1">
                        {signatoryPos}
                      </p>

                      <div className="relative w-48 h-16 flex items-center justify-center gap-2">
                        {showStamp && (
                          <div
                            className="absolute pointer-events-none z-10"
                            style={{
                              left: `${sigConfig.stampOffsetX ?? -12}px`,
                              top: `${sigConfig.stampOffsetY ?? 0}px`,
                              transform: `scale(${sigConfig.stampScale ?? 1}) rotate(${sigConfig.stampRotation ?? 0}deg)`,
                              opacity: sigConfig.stampOpacity ?? 0.85,
                              width: '72px',
                              height: '72px',
                            }}
                          >
                            {sigConfig.stampAssetUrl ? (
                              <img
                                src={sigConfig.stampAssetUrl}
                                alt="Stamp"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <svg viewBox="0 0 100 100" className="w-full h-full">
                                <circle
                                  cx="50"
                                  cy="50"
                                  r="45"
                                  stroke="#0066CC"
                                  strokeWidth="2.5"
                                  fill="none"
                                  strokeDasharray="4 2"
                                />
                                <text
                                  x="50"
                                  y="52"
                                  textAnchor="middle"
                                  fill="#002B7F"
                                  fontSize="12"
                                  fontWeight="900"
                                >
                                  ★ KIAN ★
                                </text>
                              </svg>
                            )}
                          </div>
                        )}
                        {showSignature && (
                          <svg
                            viewBox="0 0 200 80"
                            className="w-32 h-12 text-zinc-900 z-20 stroke-current fill-none"
                            strokeWidth="2.5"
                            style={{
                              transform: `scale(${sigConfig.signatureScale ?? 1})`,
                            }}
                          >
                            <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40" />
                          </svg>
                        )}
                        {showQr && !showSignature && (
                          <div className="z-20 w-14 h-14 bg-white p-0.5 rounded border border-blue-900/30 flex items-center justify-center relative">
                            {qrCodeDataUrl && (
                              <img src={qrCodeDataUrl} alt="QR" className="w-full h-full object-contain" />
                            )}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded bg-white border border-blue-900/40 flex items-center justify-center pointer-events-none">
                              <span className="text-[6px] font-black text-blue-700">K</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <p className="font-bold text-zinc-950 underline">
                        {signatoryName}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Annex Page Footer */}
              {!hasCustomFrame && (
                <div className="relative z-10 pt-2 border-t border-zinc-200 mt-2 flex items-center justify-between text-[8px] text-zinc-500 font-sans">
                  <span>
                    Lampiran Surat Tugas Resmi KIAN Troopers - {docNumber}
                  </span>
                  <span>{organization.website}</span>
                </div>
              )}
            </div>
          );
        })}

      {/* ======================================================== */}
      {/* PAGE 2+: LAMPIRAN SURAT DISPENSASI (If Multi-page Annex) */}
      {/* ======================================================== */}
      {isMultiPageDispAnnex &&
        dispAnnexPages.map((pageRows, pageIdx) => {
          const isLastPage = pageIdx === dispAnnexPages.length - 1;
          const pageNumber = pageIdx + 2;

          return (
            <div
              key={pageIdx}
              id={`document-page-${pageNumber}`}
              className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col overflow-hidden"
              style={{
                width: '794px',
                minWidth: '794px',
                maxWidth: '794px',
                height: '1123px',
                minHeight: '1123px',
                maxHeight: '1123px',
                flexShrink: 0,
                paddingTop: '48px',
                paddingBottom: '42px',
                paddingLeft: `${contentPaddingLeft}px`,
                paddingRight: `${contentPaddingRight}px`,
                fontFamily: baseFontFamily,
                fontSize: baseFontSize,
                boxSizing: 'border-box',
              }}
            >
              {/* Frame Background Layer */}
              {hasCustomFrame ? (
                <img
                  src={kop.frameAssetUrl}
                  alt="Custom Frame"
                  className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0 select-none"
                  style={{ opacity: kop.frameOpacity ?? 1 }}
                />
              ) : (
                <>
                  <div className="absolute inset-5 border-[1.5px] border-[#002B7F]/80 pointer-events-none z-1" />
                  <CornerAccentTopRight />
                  <CornerAccentBottomLeft />
                </>
              )}

              <div className="relative z-10 flex flex-col flex-1">
                {/* Header Logo */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
                  <BrandLogoHeader />
                  <span className="text-[10px] font-sans font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">
                    Halaman {pageNumber} dari {dispAnnexPages.length + 1}
                  </span>
                </div>

                {/* Annex Title Block */}
                <div className="text-center my-3">
                  <h2 className="text-sm font-bold tracking-wider underline uppercase text-black">
                    LAMPIRAN PERMOHONAN DISPENSASI PERKULIAHAN
                  </h2>
                  <p className="text-[11px] font-normal text-zinc-700 mt-0.5">
                    Nomor : {docNumber}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    Event: <strong>{eventName}</strong> ({eventDays})
                  </p>
                </div>

                {/* Full Paginated Dispensation Table */}
                <div className="mb-4">
                  <table
                    className="w-full border-collapse border border-zinc-800 text-zinc-900 bg-white/95"
                    style={{ fontFamily: tableFontFamily, fontSize: tableFontSize }}
                  >
                    <thead>
                      <tr className="bg-zinc-100 text-zinc-950 font-bold">
                        <th className="border border-zinc-800 px-1.5 py-1.5 text-center w-[6%]">No</th>
                        <th className="border border-zinc-800 px-2 py-1.5 text-left w-[25%]">Nama &amp; NIM</th>
                        <th className="border border-zinc-800 px-2 py-1.5 text-left w-[25%]">Program Studi &amp; Kampus</th>
                        <th className="border border-zinc-800 px-1.5 py-1.5 text-center w-[12%]">Kelas</th>
                        <th className="border border-zinc-800 px-2 py-1.5 text-left w-[32%]">Mata Kuliah &amp; Waktu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, rIdx) => {
                        const globalIndex = pageIdx * ROWS_PER_DISP_ANNEX_PAGE + rIdx + 1;
                        const activeCourses = (row.courses || []).filter((c) => c.selected !== false);

                        return (
                          <tr key={rIdx} className="align-top hover:bg-zinc-50">
                            <td className="border border-zinc-800 px-1.5 py-1.5 text-center font-bold">
                              {row.no || globalIndex}
                            </td>
                            <td className="border border-zinc-800 px-2 py-1.5">
                              <div className="font-bold text-zinc-950">{row.name}</div>
                              {row.nim && (
                                <div className="text-[8pt] font-mono text-zinc-600">NIM: {row.nim}</div>
                              )}
                            </td>
                            <td className="border border-zinc-800 px-2 py-1.5">
                              <div className="font-medium text-zinc-900">{row.studyProgram}</div>
                              {row.university && (
                                <div className="text-[8pt] text-zinc-600 leading-tight">{row.university}</div>
                              )}
                            </td>
                            <td className="border border-zinc-800 px-1.5 py-1.5 text-center font-medium font-mono text-[8.5pt]">
                              {row.classCode || '-'}
                            </td>
                            <td className="border border-zinc-800 px-2 py-1.5">
                              {activeCourses.length === 0 ? (
                                <span className="text-zinc-500 italic text-[8pt]">Semua Perkuliahan pada Hari Tersebut</span>
                              ) : (
                                <div className="space-y-1.5">
                                  {activeCourses.map((c, cIdx) => {
                                    const codePrefix = c.courseCode ? `[${c.courseCode}] ` : '';
                                    const lecturerStr = c.lecturerName
                                      ? (c.lecturerCode ? `[${c.lecturerCode}] ${c.lecturerName}` : c.lecturerName)
                                      : '';

                                    return (
                                      <div
                                        key={c.id || cIdx}
                                        className="text-[8pt] leading-tight pb-1.5 last:pb-0 border-b border-zinc-200/70 last:border-b-0"
                                      >
                                        <div className="font-bold text-zinc-950">
                                          • {codePrefix}{c.courseName}
                                        </div>
                                        <div className="text-[7.5pt] text-zinc-700 pl-2 mt-0.5">
                                          <span>⏰ {c.dayName ? `${c.dayName}, ` : ''}{c.startTime} - {c.endTime} WIB</span>
                                          {c.room && <span className="ml-1.5 text-zinc-600 font-medium">| 📍 Ruang: {c.room}</span>}
                                        </div>
                                        {(lecturerStr || c.notes) && (
                                          <div className="text-[7.5pt] text-zinc-600 pl-2 italic mt-0.5">
                                            {lecturerStr && <span>👨‍🏫 Dosen: {lecturerStr}</span>}
                                            {lecturerStr && c.notes && <span className="mx-1">|</span>}
                                            {c.notes && <span className="text-zinc-500 font-normal">({c.notes})</span>}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* On Last Page, render official Signatory */}
                {isLastPage && (
                  <div className="flex justify-end mt-auto mb-2 pr-4">
                    <div className="flex flex-col items-center text-center w-64">
                      <p className="text-zinc-900">{docDatePlace}</p>
                      <p className="font-normal text-zinc-900 mb-1">{signatoryPos}</p>

                      <div className="relative w-48 h-16 flex items-center justify-center gap-2">
                        {showStamp && (
                          <div
                            className="absolute pointer-events-none z-10"
                            style={{
                              left: `${sigConfig.stampOffsetX ?? -12}px`,
                              top: `${sigConfig.stampOffsetY ?? 0}px`,
                              transform: `scale(${sigConfig.stampScale ?? 1}) rotate(${sigConfig.stampRotation ?? 0}deg)`,
                              opacity: sigConfig.stampOpacity ?? 0.85,
                              width: '72px',
                              height: '72px',
                            }}
                          >
                            <svg viewBox="0 0 100 100" className="w-full h-full">
                              <circle cx="50" cy="50" r="45" stroke="#0066CC" strokeWidth="2.5" fill="none" strokeDasharray="4 2" />
                              <text x="50" y="52" textAnchor="middle" fill="#002B7F" fontSize="12" fontWeight="900">
                                ★ KIAN ★
                              </text>
                            </svg>
                          </div>
                        )}
                        {showSignature && (
                          <svg
                            viewBox="0 0 200 80"
                            className="w-32 h-12 text-zinc-900 z-20 stroke-current fill-none"
                            strokeWidth="2.5"
                            style={{ transform: `scale(${sigConfig.signatureScale ?? 1})` }}
                          >
                            <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40" />
                          </svg>
                        )}
                      </div>

                      <p className="font-bold text-zinc-950 underline">{signatoryName}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Annex Page Footer */}
              {!hasCustomFrame && (
                <div className="relative z-10 pt-2 border-t border-zinc-200 mt-2 flex items-center justify-between text-[8px] text-zinc-500 font-sans">
                  <span>
                    Lampiran Surat Permohonan Dispensasi KIAN Troopers - {docNumber}
                  </span>
                  <span>{organization.website}</span>
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};
