'use client';

import React from 'react';
import {
  AssigneeRow,
  OrganizationSnapshot,
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
}

// Decorative Corner Shapes SVG
const CornerAccentTopRight = () => (
  <svg
    className="absolute top-0 right-0 w-28 h-28 pointer-events-none"
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
    className="absolute bottom-0 left-0 w-28 h-28 pointer-events-none"
    viewBox="0 0 120 120"
    fill="none"
  >
    <path d="M0 40 L0 120 L80 120 Z" fill="#0052CC" opacity="0.9" />
    <path d="M0 70 L0 120 L50 120 Z" fill="#E52320" />
    <path d="M0 95 L0 120 L25 120 Z" fill="#002B7F" />
  </svg>
);

// KIAN Troopers Brand Logo Header
const BrandLogoHeader = () => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <span className="text-2xl font-black italic tracking-tighter text-[#0066CC]">
        KI<span className="text-[#002B7F]">AN</span>
      </span>
      <span className="text-2xl font-black italic tracking-wider text-black font-sans">
        TROOPERS
      </span>
    </div>
    <span className="text-[9px] text-zinc-700 tracking-tight font-medium font-sans">
      Kreasi Inovasi Anak Nusantara
    </span>
  </div>
);

export const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  formData,
  layoutConfig,
  organization = DEFAULT_ORGANIZATION_PROFILE,
  signatory,
  className = '',
  previewMode = false,
}) => {
  const assignees: AssigneeRow[] = Array.isArray(formData.assignees)
    ? formData.assignees
    : [];

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
  const showStamp = formData.show_stamp !== false;

  const ccList: string[] = Array.isArray(formData.cc_list)
    ? formData.cc_list
    : ['1. CEO', '2. CBO', '3. Ybs'];

  return (
    <div
      className={`flex flex-col items-center gap-8 print:gap-0 select-text ${className}`}
    >
      {/* ======================================================== */}
      {/* PAGE 1: SURAT UTAMA                                      */}
      {/* ======================================================== */}
      <div
        id="document-page-1"
        className="document-print-page relative bg-white text-zinc-900 shadow-2xl print:shadow-none box-border flex flex-col justify-between overflow-hidden"
        style={{
          width: '794px', // Standard A4 width @ 96 DPI (210mm)
          minHeight: '1123px', // Standard A4 height @ 96 DPI (297mm)
          height: '1123px',
          padding: '48px 56px 42px 56px',
          fontFamily: "'Times New Roman', Times, serif",
          boxSizing: 'border-box',
        }}
      >
        {/* Frame Outer Border & Corner Accents */}
        <div className="absolute inset-5 border-[1.5px] border-[#002B7F]/80 pointer-events-none" />
        <CornerAccentTopRight />
        <CornerAccentBottomLeft />

        {/* Content Container (Flow layout) */}
        <div className="relative z-10 flex flex-col flex-1">
          {/* 1. Header / Logo */}
          <div className="flex items-center justify-between pb-3">
            <BrandLogoHeader />
          </div>

          {/* 2. Document Title & Number */}
          <div className="text-center my-4">
            <h1 className="text-base font-bold tracking-wider underline uppercase text-black">
              {documentTitle}
            </h1>
            <p className="text-xs font-normal text-zinc-800 mt-1">
              Nomor : {docNumber}
            </p>
          </div>

          {/* 3. Opening Intro Text */}
          <div className="text-xs leading-relaxed text-zinc-900 mb-3 text-justify">
            <p>{introText}</p>
          </div>

          {/* 4. Assignee Section: Inline Table or Multi-Page Lampiran Pointer */}
          {!isMultiPageAnnex ? (
            <div className="mb-4">
              <table className="w-full border-collapse border border-zinc-800 text-xs text-zinc-900">
                <thead>
                  <tr className="bg-zinc-100/50">
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
            <div className="mb-4 p-3 bg-zinc-50 border border-dashed border-zinc-400 rounded text-xs text-zinc-700 italic flex items-center justify-between">
              <span>
                📋 <strong>Daftar Nama Petugas ({assignees.length} Personil)</strong> terlampir lengkap pada <strong>Lampiran Surat Tugas</strong> (Halaman 2).
              </span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded">
                Lihat Lampiran
              </span>
            </div>
          )}

          {/* 5. Event Details */}
          <div className="text-xs leading-relaxed text-zinc-900 mb-3">
            <p className="mb-1.5 text-justify">{eventIntro}</p>
            <div className="grid grid-cols-[80px_12px_1fr] gap-y-1 pl-6 text-xs">
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

          {/* 6. Closing Text */}
          <div className="text-xs leading-relaxed text-zinc-900 mb-4 text-justify">
            <p>{closingText}</p>
          </div>

          {/* 7. Signature Block (Right Aligned) */}
          <div className="flex justify-end mt-2 mb-2 pr-4">
            <div className="flex flex-col items-center text-center w-64">
              <p className="text-xs text-zinc-900">{docDatePlace}</p>
              <p className="text-xs font-normal text-zinc-900 mb-2">
                {signatoryPos}
              </p>

              {/* Signature Graphic & Stamp Overlay */}
              <div className="relative w-48 h-20 flex items-center justify-center my-1">
                {/* Stamp / Cap overlay */}
                {showStamp && (
                  <div className="absolute -left-2 top-0 w-24 h-24 pointer-events-none opacity-85 z-10">
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
                  </div>
                )}

                {/* Hand Signature Graphic */}
                {signatory?.signature_url ? (
                  <img
                    src={signatory.signature_url}
                    alt="Signature"
                    className="max-h-16 object-contain z-20"
                  />
                ) : (
                  <svg
                    viewBox="0 0 200 80"
                    className="w-40 h-16 text-zinc-900 z-20 stroke-current fill-none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40 M 60 45 Q 110 50 170 38" />
                  </svg>
                )}
              </div>

              <p className="text-xs font-bold text-zinc-950 underline mt-1">
                {signatoryName}
              </p>
            </div>
          </div>

          {/* 8. Tembusan List (Bottom Left) */}
          {ccList.length > 0 && (
            <div className="mt-auto pt-2 pl-2 text-[11px] text-zinc-800">
              <p className="font-bold mb-0.5">Tembusan :</p>
              <ul className="space-y-0.5 pl-1">
                {ccList.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* 9. Fixed Bottom Footer */}
        <div className="relative z-10 pt-3 border-t border-zinc-200 mt-3 flex items-end justify-between text-[8.5px] leading-tight text-zinc-600 font-sans">
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
                padding: '48px 56px 42px 56px',
                fontFamily: "'Times New Roman', Times, serif",
                boxSizing: 'border-box',
              }}
            >
              {/* Frame Outer Border & Corner Accents */}
              <div className="absolute inset-5 border-[1.5px] border-[#002B7F]/80 pointer-events-none" />
              <CornerAccentTopRight />
              <CornerAccentBottomLeft />

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
                  <table className="w-full border-collapse border border-zinc-800 text-xs text-zinc-900">
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
                      <p className="text-xs text-zinc-900">{docDatePlace}</p>
                      <p className="text-xs font-normal text-zinc-900 mb-1">
                        {signatoryPos}
                      </p>

                      <div className="relative w-44 h-16 flex items-center justify-center">
                        {showStamp && (
                          <div className="absolute -left-2 top-0 w-20 h-20 pointer-events-none opacity-85 z-10">
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
                          </div>
                        )}
                        <svg
                          viewBox="0 0 200 80"
                          className="w-36 h-14 text-zinc-900 z-20 stroke-current fill-none"
                          strokeWidth="2.5"
                        >
                          <path d="M20 50 C 40 10, 60 70, 80 30 C 100 10, 110 60, 140 35 Q 160 20 180 40" />
                        </svg>
                      </div>

                      <p className="text-xs font-bold text-zinc-950 underline">
                        {signatoryName}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Annex Page Footer */}
              <div className="relative z-10 pt-2 border-t border-zinc-200 mt-2 flex items-center justify-between text-[8px] text-zinc-500 font-sans">
                <span>
                  Lampiran Surat Tugas Resmi KIAN Troopers - {docNumber}
                </span>
                <span>{organization.website}</span>
              </div>
            </div>
          );
        })}
    </div>
  );
};
