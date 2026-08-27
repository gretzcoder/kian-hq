'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { CertificateItem, CertificateTemplate } from '../certificateTypes';

interface CertificateCardViewProps {
  certificate: CertificateItem;
  templateOverride?: CertificateTemplate;
  onDownloadPdf?: () => void;
  isDownloading?: boolean;
}

export const CertificateCardView: React.FC<CertificateCardViewProps> = ({
  certificate,
  templateOverride,
  onDownloadPdf,
  isDownloading = false,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);

  const tpl = templateOverride || certificate.template_data || {
    id: 'default',
    name: 'Standard Gold',
    description: '',
    layout_type: 'CLASSIC',
    background_color: '#0b0f19',
    border_style: 'GOLD',
    accent_color: '#eab308',
    signatory_name: 'Kian HQ Management',
    signatory_title: 'Program Director',
    custom_subtext: 'Sertifikat ini diberikan sebagai bentuk penghargaan resmi atas performa tinggi, dedikasi, dan penyelesaian tugas di Kian HQ.',
    is_active: 1,
    created_at: 0,
    updated_at: 0,
  };

  // Verification URL for QR code
  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/certificate/${certificate.certificate_code}`
    : `https://kianhq.com/verify/certificate/${certificate.certificate_code}`;

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(verificationUrl, {
      margin: 1,
      width: 160,
      color: {
        dark: tpl.accent_color || '#eab308',
        light: '#00000000', // transparent
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate QR Code:', err);
      });
    return () => {
      isMounted = false;
    };
  }, [verificationUrl, tpl.accent_color]);

  const formattedDate = new Date(
    certificate.issue_date > 10000000000 ? certificate.issue_date : certificate.issue_date * 1000
  ).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const metrics = certificate.performance_metrics || {
    tasks_completed: 0,
    sparks_earned: 0,
    badges_count: 0,
    badges_list: [],
    project_count: 0,
    score_grade: 'A',
    summary: '',
  };

  // Render Theme Variations
  const getThemeStyles = () => {
    switch (tpl.layout_type) {
      case 'MODERN':
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-cyan-950 to-slate-900',
          border: 'border-2 border-cyan-500/50 shadow-[0_0_50px_rgba(6,182,212,0.15)]',
          accentText: 'text-cyan-400',
          badgeBg: 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-300',
          sealColor: 'from-cyan-500 to-blue-600',
        };
      case 'ELEGANT':
        return {
          bg: 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950',
          border: 'border-2 border-indigo-400/40 shadow-[0_0_50px_rgba(99,102,241,0.15)]',
          accentText: 'text-indigo-300',
          badgeBg: 'bg-indigo-950/60 border border-indigo-500/30 text-indigo-200',
          sealColor: 'from-indigo-500 to-purple-600',
        };
      case 'VIBRANT':
        return {
          bg: 'bg-gradient-to-br from-zinc-950 via-purple-950 to-pink-950',
          border: 'border-2 border-pink-500/40 shadow-[0_0_50px_rgba(236,72,153,0.15)]',
          accentText: 'text-pink-400',
          badgeBg: 'bg-pink-950/60 border border-pink-500/30 text-pink-200',
          sealColor: 'from-pink-500 to-rose-600',
        };
      case 'CLASSIC':
      default:
        return {
          bg: 'bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950',
          border: 'border-2 border-amber-500/40 shadow-[0_0_50px_rgba(245,158,11,0.15)]',
          accentText: 'text-amber-400',
          badgeBg: 'bg-amber-950/60 border border-amber-500/30 text-amber-300',
          sealColor: 'from-amber-500 to-yellow-600',
        };
    }
  };

  const style = getThemeStyles();

  return (
    <div className="w-full flex flex-col items-center">
      {/* Certificate Frame Printable Area */}
      <div
        id="certificate-print-area"
        ref={cardRef}
        className={`w-full max-w-4xl relative rounded-2xl p-6 sm:p-10 md:p-14 text-white overflow-hidden font-sans transition-all duration-300 ${style.bg} ${style.border}`}
      >
        {/* Subtle Decorative Background Vector Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-white/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        {/* Outer Fine Line Gold/Accent Border Inside Frame */}
        <div className="w-full h-full border border-white/10 rounded-xl p-5 sm:p-8 flex flex-col justify-between relative z-10 backdrop-blur-3xs">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-white/10 pb-6">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${style.sealColor} flex items-center justify-center text-white font-black text-xl shadow-lg`}>
                K
              </div>
              <div>
                <h3 className="font-extrabold tracking-wider text-lg sm:text-xl text-white uppercase">
                  KIAN HQ
                </h3>
                <p className="text-[11px] text-zinc-400 tracking-widest uppercase">
                  AI-Powered Creative Operating System
                </p>
              </div>
            </div>

            <div className="text-center sm:text-right">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-mono font-bold tracking-widest uppercase ${style.badgeBg}`}>
                {certificate.status === 'PUBLISHED' ? 'OFFICIAL CERTIFICATE' : 'DRAFT PREVIEW'}
              </span>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                ID: <span className="text-white font-bold">{certificate.certificate_code}</span>
              </p>
            </div>
          </div>

          {/* Certificate Title & Recipient Body */}
          <div className="my-8 text-center flex flex-col items-center">
            <p className={`text-xs sm:text-sm font-semibold tracking-widest uppercase mb-2 ${style.accentText}`}>
              Sertifikat Penghargaan & Capaian
            </p>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mb-4 capitalize font-serif">
              {certificate.title || 'Certificate of Achievement'}
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl leading-relaxed mb-6">
              Diberikan secara resmi dan terverifikasi di ekosistem Kian HQ kepada:
            </p>

            {/* User Recipient Name & Role */}
            <div className="mb-6">
              <h2 className={`text-3xl sm:text-5xl font-black tracking-wide ${style.accentText} drop-shadow-md`}>
                {certificate.user_name}
              </h2>
              <p className="text-sm sm:text-base text-zinc-300 font-medium mt-1">
                {certificate.user_role ? `${certificate.user_role} • ${certificate.user_email}` : certificate.user_email}
              </p>
            </div>

            {/* Custom Subtext Description */}
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed italic border-t border-b border-white/10 py-4 px-2">
              "{tpl.custom_subtext}"
            </p>
          </div>

          {/* Recapitulated Performance Metrics Grid */}
          <div className="my-4 bg-black/40 backdrop-blur-md rounded-xl p-4 border border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-2 border-r border-white/10 last:border-0 sm:last:border-r">
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Tugas Selesai</p>
              <p className={`text-xl sm:text-2xl font-black ${style.accentText}`}>
                {metrics.tasks_completed} <span className="text-xs font-normal text-zinc-400">Tasks</span>
              </p>
            </div>

            <div className="p-2 sm:border-r border-white/10">
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Total Sparks</p>
              <p className="text-xl sm:text-2xl font-black text-amber-400">
                ✨ {metrics.sparks_earned}
              </p>
            </div>

            <div className="p-2 border-r border-white/10">
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Badge Unlocked</p>
              <p className="text-xl sm:text-2xl font-black text-purple-400">
                🏅 {metrics.badges_count}
              </p>
            </div>

            <div className="p-2">
              <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Performance Tier</p>
              <p className={`text-xl sm:text-2xl font-black ${style.accentText}`}>
                {metrics.score_grade}
              </p>
            </div>
          </div>

          {/* Footer Section: Signatory, Date, and QR Code */}
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-6">
            
            {/* Left: Issue Date & Verification Note */}
            <div className="text-center sm:text-left">
              <p className="text-xs text-zinc-400">Diterbitkan pada:</p>
              <p className="text-sm font-semibold text-white mt-0.5">{formattedDate}</p>
              <p className="text-[11px] text-zinc-500 mt-2 font-mono">
                System Verified Code: {certificate.certificate_code}
              </p>
            </div>

            {/* Center: Signatory & Seal */}
            <div className="text-center flex flex-col items-center">
              <div className="h-10 flex items-center justify-center font-serif text-lg italic text-amber-200/90 font-bold border-b border-white/20 px-6 pb-1">
                {tpl.signatory_name}
              </div>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                {tpl.signatory_title}
              </p>
            </div>

            {/* Right: Authentic QR Code */}
            <div className="flex items-center gap-3 bg-black/30 p-2 rounded-xl border border-white/10">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="Certificate Verification QR Code" className="w-16 h-16 rounded-md bg-black/40" />
              ) : (
                <div className="w-16 h-16 bg-zinc-800 animate-pulse rounded-md flex items-center justify-center text-[10px] text-zinc-500">
                  QR Loading
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Scan Verifikasi</p>
                <p className="text-[10px] text-zinc-400 leading-tight">Pindai QR untuk memeriksa otentisitas data.</p>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Action Controls below Certificate */}
      {onDownloadPdf && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={onDownloadPdf}
            disabled={isDownloading}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all ${
              isDownloading
                ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-zinc-950 shadow-amber-500/20 active:scale-95'
            }`}
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                Mengekspor PDF...
              </>
            ) : (
              <>
                <span>📥</span> Download Certificate PDF
              </>
            )}
          </button>

          <a
            href={verificationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 flex items-center gap-2 transition-all active:scale-95"
          >
            <span>🔗</span> Buka Halaman Verifikasi
          </a>
        </div>
      )}
    </div>
  );
};
