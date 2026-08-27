import React from 'react';
import { getCertificateByCode } from '@/modules/certificates/certificateActions';
import Link from 'next/link';

export const revalidate = 0;

export default async function CertificateVerificationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const certificate = await getCertificateByCode(code);

  const formattedDate = certificate
    ? new Date(
        certificate.issue_date > 10000000000 ? certificate.issue_date : certificate.issue_date * 1000
      ).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  const metrics = certificate?.performance_metrics || {
    tasks_completed: 0,
    sparks_earned: 0,
    badges_count: 0,
    badges_list: [],
    project_count: 0,
    score_grade: 'A',
    summary: '',
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-4 sm:p-8">
      {/* Top Brand Navbar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-zinc-950 font-black text-xl shadow-lg">
            K
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider uppercase text-white">KIAN HQ</h1>
            <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">System Certificate Verification</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all"
        >
          Masuk ke Kian HQ ➔
        </Link>
      </header>

      {/* Main Verification Card */}
      <main className="max-w-3xl mx-auto w-full my-auto py-10">
        {certificate ? (
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-md relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Authenticity Badge Banner */}
            <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl shrink-0">
                  ✅
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-wide uppercase">
                    OFFICIALLY VERIFIED CERTIFICATE
                  </h2>
                  <p className="text-xs text-emerald-400/80">
                    Sertifikat ini terdaftar dan valid dalam database resmi Kian HQ System.
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-xs font-mono font-bold tracking-wider">
                VALID
              </span>
            </div>

            {/* Certificate Details */}
            <div className="space-y-6">
              <div>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Certificate Code</p>
                <p className="text-2xl font-black text-amber-400 font-mono tracking-wider">
                  {certificate.certificate_code}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-zinc-800">
                <div>
                  <p className="text-xs text-zinc-400 uppercase font-semibold">Nama Pemegang / Penerima</p>
                  <p className="text-xl font-bold text-white mt-1">{certificate.user_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{certificate.user_role || 'Member'} • {certificate.user_email}</p>
                </div>

                <div>
                  <p className="text-xs text-zinc-400 uppercase font-semibold">Tanggal Penerbitan</p>
                  <p className="text-base font-bold text-zinc-200 mt-1">{formattedDate}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Diterbitkan oleh: {certificate.issued_by_name}</p>
                </div>
              </div>

              {/* Capaian Performance Recap */}
              <div className="pt-6 border-t border-zinc-800">
                <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-wider mb-3">
                  Rekapitulasi Capaian & Performa Peserta
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Tugas Diselesaikan</p>
                    <p className="text-lg font-black text-cyan-400">{metrics.tasks_completed} Tasks</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Total Sparks</p>
                    <p className="text-lg font-black text-amber-400">✨ {metrics.sparks_earned}</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Lencana Achieved</p>
                    <p className="text-lg font-black text-purple-400">🏅 {metrics.badges_count}</p>
                  </div>
                  <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Tier Performance</p>
                    <p className="text-lg font-black text-emerald-400">{metrics.score_grade}</p>
                  </div>
                </div>
              </div>

              {/* Badges List if any */}
              {metrics.badges_list && metrics.badges_list.length > 0 && (
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                    Lencana Prestasi Terverifikasi ({metrics.badges_list.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {metrics.badges_list.map((badge, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-purple-950/60 border border-purple-500/30 text-purple-200 text-xs rounded-lg font-medium flex items-center gap-1.5"
                      >
                        <span>🏅</span> {badge.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 font-mono">
                Data verifikasi ini disinkronkan secara real-time dari Cloudflare D1 Ledger Kian HQ.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mx-auto mb-4">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Sertifikat Tidak Ditemukan</h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Kode verifikasi <span className="font-mono text-zinc-200">{code}</span> tidak terdaftar dalam database resmi atau telah dibatalkan oleh Koordinator.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-zinc-600 font-mono border-t border-zinc-900">
        © {new Date().getFullYear()} KIAN HQ Operating System. All Rights Reserved.
      </footer>
    </div>
  );
}
