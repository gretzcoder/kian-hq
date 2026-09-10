'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  AssigneeRow,
  CustomKopTextElement,
  KopSuratConfig,
  OrganizationSnapshot,
  SignatureStampConfig,
  TemplateLayoutConfig,
} from '../documentTypes';
import { DEFAULT_ORGANIZATION_PROFILE } from '../defaultTemplates';

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

  const documentTitle = formData.document_title || 'SURAT TUGAS';
  const docNumber = formData.document_number || '1/KIAN/TROOPERS/IX/2026';
  const signerIntro = formData.signer_title_intro || 'Project Director Kian Troopers';
  const introText =
    formData.intro_text ||
    `Yang bertanda tangan dibawah ini, ${signerIntro}, menugaskan kepada :`;

  const eventName =
    formData.event_name || 'BKOT (Bincang Kampus Bersama Orang Tua) UBSI';
  const eventIntro =
    formData.event_intro_text ||
    `Untuk berpartisipasi pada event ${eventName}, dengan rincian sebagai berikut:`;
  const eventDays =
    formData.event_days || "Jum'at - Sabtu, 11 - 12 September 2026";
  const eventTime = formData.event_time || '07.30 WIB - Selesai';
  const eventLocation = formData.event_location || 'Hotel Santika Depok';

  const closingText =
    formData.closing_text ||
    'Demikianlah penugasan ini agar dapat dilaksanakan sebagaimana mestinya. Atas perhatian dan kerja samanya, kami mengucapkan terima kasih.';

  const docDatePlace =
    formData.document_date_place || 'Jakarta, 10 September 2026';
  const signatoryPos =
    formData.signatory_position ||
    signatory?.position ||
    'Program Director Kian Troopers';
  const signatoryName =
    formData.signatory_name || signatory?.name || 'Mohamad Abi';
  const showStamp = (formData.show_stamp !== false) && sigConfig.showStamp;

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
        className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col justify-between overflow-hidden"
        style={{
          width: '794px', // Standard A4 width @ 96 DPI (210mm)
          minHeight: '1123px', // Standard A4 height @ 96 DPI (297mm)
          height: '1123px',
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
              {isBuilderInteractive && (
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
                className="font-bold tracking-wider underline uppercase text-black select-none"
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
              {isBuilderInteractive && (
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
              {isBuilderInteractive && (
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
          {/* Opening Intro Text */}
          <div className="leading-relaxed text-zinc-900 mb-3 text-justify">
            <p>{introText}</p>
          </div>

          {/* Assignee Section: Inline Table or Multi-Page Lampiran Pointer */}
          {!isMultiPageAnnex ? (
            <div className="mb-4">
              <table
                className="w-full border-collapse border border-zinc-800 text-zinc-900 bg-white/90"
                style={{ fontFamily: tableFontFamily, fontSize: tableFontSize }}
              >
                <thead>
                  <tr className="bg-zinc-100/70">
                    <th className="border border-zinc-800 px-2 py-1.5 text-center font-bold w-[8%]">
                      No
                    </th>
                    <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[22%]">
                      NIP
                    </th>
                    <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[42%]">
                      NAMA
                    </th>
                    <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[28%]">
                      Tugas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assignees.map((row, idx) => (
                    <tr key={idx}>
                      <td className="border border-zinc-800 px-2 py-1.5 text-center">
                        {row.no || idx + 1}
                      </td>
                      <td className="border border-zinc-800 px-3 py-1.5 text-center font-mono">
                        {row.nip || '-'}
                      </td>
                      <td className="border border-zinc-800 px-3 py-1.5 font-medium">
                        {row.name || '-'}
                      </td>
                      <td className="border border-zinc-800 px-3 py-1.5">
                        {row.role || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-4 p-3 bg-zinc-50/90 border border-dashed border-zinc-400 rounded text-xs text-zinc-700 italic flex items-center justify-between">
              <span>
                📋 <strong>Daftar Nama Petugas ({assignees.length} Personil)</strong> terlampir lengkap pada <strong>Lampiran Surat Tugas</strong> (Halaman 2).
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                Lihat Lampiran
              </span>
            </div>
          )}

          {/* Event Details */}
          <div className="leading-relaxed text-zinc-900 mb-3">
            <p className="mb-1.5 text-justify">{eventIntro}</p>
            <div className="grid grid-cols-[80px_12px_1fr] gap-y-1 pl-6">
              <span className="font-normal">Hari</span>
              <span>:</span>
              <span className="font-medium">{eventDays}</span>

              <span className="font-normal">Pukul</span>
              <span>:</span>
              <span className="font-medium">{eventTime}</span>

              <span className="font-normal">Tempat</span>
              <span>:</span>
              <span className="font-medium">{eventLocation}</span>
            </div>
          </div>

          {/* Closing Text */}
          <div className="leading-relaxed text-zinc-900 mb-3 text-justify">
            <p>{closingText}</p>
          </div>

          {/* Signature & Tembusan Section (Clean layout that never overlaps bottom corner graphics!) */}
          <div className="mt-2 mb-2">
            {/* Signature Block */}
            <div
              className={`flex pr-4 mb-2 ${
                sigConfig.align === 'center'
                  ? 'justify-center'
                  : sigConfig.align === 'left'
                  ? 'justify-start'
                  : 'justify-end'
              }`}
            >
              <div className="flex flex-col items-center text-center w-64">
                <p className="text-zinc-900">{docDatePlace}</p>
                <p className="font-normal text-zinc-900 mb-1">
                  {signatoryPos}
                </p>

                {/* Signature Graphic & Stamp Overlay */}
                <div className="relative w-48 h-20 flex items-center justify-center my-1">
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
                          <circle
                            cx="50"
                            cy="50"
                            r="38"
                            stroke="#0066CC"
                            strokeWidth="1.5"
                            fill="none"
                          />
                          <text
                            x="50"
                            y="34"
                            textAnchor="middle"
                            fill="#0066CC"
                            fontSize="7"
                            fontWeight="900"
                            letterSpacing="1"
                          >
                            KIAN TROOPERS
                          </text>
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
                          <text
                            x="50"
                            y="68"
                            textAnchor="middle"
                            fill="#0066CC"
                            fontSize="6"
                            fontWeight="bold"
                          >
                            INDONESIA
                          </text>
                        </svg>
                      )}
                    </div>
                  )}

                  {/* Hand Signature Graphic */}
                  {sigConfig.signatureAssetUrl || signatory?.signature_url ? (
                    <img
                      src={sigConfig.signatureAssetUrl || signatory?.signature_url || ''}
                      alt="Signature"
                      className="max-h-16 object-contain z-20"
                      style={{
                        transform: `scale(${sigConfig.signatureScale ?? 1})`,
                      }}
                    />
                  ) : (
                    <svg
                      viewBox="0 0 200 80"
                      className="w-40 h-16 text-zinc-900 z-20 stroke-current fill-none"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: `scale(${sigConfig.signatureScale ?? 1})`,
                      }}
                    >
                      <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40 M 60 45 Q 110 50 170 38" />
                    </svg>
                  )}
                </div>

                <p className="font-bold text-zinc-950 underline mt-1">
                  {signatoryName}
                </p>
              </div>
            </div>

            {/* FIXED TEMBUSAN: Placed with safe left padding (pl-8) and minimum bottom clearance so it NEVER collides with bottom-left graphics */}
            {ccList.length > 0 && (
              <div className="pt-2 pl-8 text-[10.5px] text-zinc-800 max-w-[360px]">
                <p className="font-bold mb-0.5">Tembusan :</p>
                <ul className="space-y-0.5 pl-1">
                  {ccList.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
              className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col justify-between overflow-hidden"
              style={{
                width: '794px',
                minHeight: '1123px',
                height: '1123px',
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
                        <th className="border border-zinc-800 px-2 py-1.5 text-center font-bold w-[8%]">
                          No
                        </th>
                        <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[22%]">
                          NIP / NIM
                        </th>
                        <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[42%]">
                          NAMA LENGKAP
                        </th>
                        <th className="border border-zinc-800 px-3 py-1.5 text-center font-bold w-[28%]">
                          PENUGASAN
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, rIdx) => {
                        const globalIndex =
                          pageIdx * ROWS_PER_ANNEX_PAGE + rIdx + 1;
                        return (
                          <tr key={rIdx} className="hover:bg-zinc-50">
                            <td className="border border-zinc-800 px-2 py-1.5 text-center">
                              {row.no || globalIndex}
                            </td>
                            <td className="border border-zinc-800 px-3 py-1.5 text-center font-mono">
                              {row.nip || '-'}
                            </td>
                            <td className="border border-zinc-800 px-3 py-1.5 font-medium">
                              {row.name || '-'}
                            </td>
                            <td className="border border-zinc-800 px-3 py-1.5">
                              {row.role || '-'}
                            </td>
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

                      <div className="relative w-44 h-16 flex items-center justify-center">
                        {showStamp && (
                          <div
                            className="absolute pointer-events-none z-10"
                            style={{
                              left: `${sigConfig.stampOffsetX ?? -12}px`,
                              top: `${sigConfig.stampOffsetY ?? 0}px`,
                              transform: `scale(${sigConfig.stampScale ?? 1}) rotate(${sigConfig.stampRotation ?? 0}deg)`,
                              opacity: sigConfig.stampOpacity ?? 0.85,
                              width: '80px',
                              height: '80px',
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
                        <svg
                          viewBox="0 0 200 80"
                          className="w-36 h-14 text-zinc-900 z-20 stroke-current fill-none"
                          strokeWidth="2.5"
                          style={{
                            transform: `scale(${sigConfig.signatureScale ?? 1})`,
                          }}
                        >
                          <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40" />
                        </svg>
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
    </div>
  );
};
