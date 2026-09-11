import React from 'react';
import { getPublicDocumentVerification } from '@/modules/documents/documentActions';
import Link from 'next/link';
import type { Metadata } from 'next';

export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const res = await getPublicDocumentVerification(id);
  if (!res.isValid || !res.document) {
    return {
      title: 'Verifikasi Dokumen Tidak Ditemukan | KIAN HQ',
      description: 'Verifikasi surat tugas dan dokumen resmi KIAN HQ.',
    };
  }

  return {
    title: `Verifikasi: ${res.document.document_number} - ${res.document.title} | KIAN HQ`,
    description: `Verifikasi keaslian surat tugas resmi KIAN Troopers: ${res.document.document_number}.`,
  };
}

export default async function PublicDocumentVerificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const res = await getPublicDocumentVerification(id);
  const doc = res.document;

  const formattedDate = doc?.issued_at
    ? new Date(
        doc.issued_at > 10000000000 ? doc.issued_at : doc.issued_at * 1000
      ).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col justify-between p-4 sm:p-8 selection:bg-purple-500 selection:text-white">
      {/* Top Brand Navbar */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-500/20">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-white">
                KIAN HQ
              </h1>
              <span className="text-[9px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                OFFICIAL
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono tracking-widest uppercase">
              Digital Document Authenticity Verification
            </p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-all active:scale-95 shadow-xs"
        >
          Masuk Portal Kian HQ ➔
        </Link>
      </header>

      {/* Main Verification Content */}
      <main className="max-w-3xl mx-auto w-full my-auto py-8">
        {res.isValid && doc ? (
          <div className="bg-zinc-900/95 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden space-y-6">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Official Authenticity Badge Banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 shadow-md">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-2xl shrink-0 border border-emerald-500/30">
                  ✅
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-white">
                      DOKUMEN RESMI TERVERIFIKASI
                    </h2>
                    <span className="px-2 py-0.5 bg-emerald-500/30 border border-emerald-500/40 rounded-full text-[10px] font-mono font-black text-emerald-300">
                      VALID
                    </span>
                  </div>
                  <p className="text-xs text-emerald-400/90 mt-0.5">
                    Surat Tugas ini terdaftar secara sah dan valid dalam database resmi sistem KIAN HQ.
                  </p>
                </div>
              </div>
            </div>

            {/* Header Document Number & Title */}
            <div className="space-y-1 pt-2">
              <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest block font-bold">
                Nomor Surat Resmi / Document Number
              </span>
              <p className="text-xl sm:text-2xl font-black text-purple-400 font-mono tracking-wider break-all">
                {doc.document_number}
              </p>
              <p className="text-sm font-bold text-zinc-200 pt-1">
                Perihal: <span className="text-white">{doc.title}</span>
              </p>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
              <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                  Ditandatangani Oleh (Signatory)
                </span>
                <p className="text-base font-extrabold text-white">
                  {doc.signatory.name}
                </p>
                <p className="text-xs text-purple-300 font-medium">
                  {doc.signatory.position}
                </p>
              </div>

              <div className="bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80 space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider block">
                  Tanggal &amp; Lembaga Penerbit
                </span>
                <p className="text-base font-extrabold text-zinc-200">
                  {formattedDate}
                </p>
                <p className="text-xs text-zinc-400 font-medium">
                  {doc.organization?.name || 'KIAN Troopers Indonesia'}
                </p>
              </div>
            </div>

            {/* Event / Penugasan Details if present */}
            {(doc.event.intro || doc.event.days || doc.event.location || doc.event.time) && (
              <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl p-4 sm:p-5 space-y-2.5">
                <span className="text-[10px] font-black uppercase text-purple-400 tracking-wider flex items-center gap-1.5">
                  <span>📅</span> Rincian Penugasan / Kegiatan
                </span>
                {doc.event.intro && (
                  <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                    {doc.event.intro}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-xs">
                  {doc.event.days && (
                    <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold">Hari / Tanggal</span>
                      <span className="font-semibold text-zinc-200">{doc.event.days}</span>
                    </div>
                  )}
                  {doc.event.time && (
                    <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold">Waktu Pelaksanaan</span>
                      <span className="font-semibold text-zinc-200">{doc.event.time}</span>
                    </div>
                  )}
                  {doc.event.location && (
                    <div className="bg-zinc-950/70 p-2.5 rounded-xl border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 block uppercase font-bold">Lokasi / Tempat</span>
                      <span className="font-semibold text-zinc-200">{doc.event.location}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Assignees Table (Daftar Petugas Terverifikasi) */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <span>👥</span> Daftar Petugas / Personil Terverifikasi ({doc.assignees.length} Orang)
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Daftar nama dan identitas resmi personil yang ditugaskan pada surat ini.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/25 rounded-full text-[10px] font-mono font-bold">
                  Official Delegation
                </span>
              </div>

              {doc.assignees.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 font-bold uppercase text-[10px]">
                        <th className="py-3 px-3.5 text-center w-12">No</th>
                        <th className="py-3 px-3.5 w-32">NIP / NIM</th>
                        <th className="py-3 px-4">Nama Lengkap</th>
                        <th className="py-3 px-4">Peran / Tugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
                      {doc.assignees.map((item, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-center font-mono text-zinc-500 font-bold">
                            {item.no || idx + 1}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono text-purple-400">
                            {item.nip || '-'}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-white">
                            {item.name}
                          </td>
                          <td className="py-2.5 px-4 text-zinc-300">
                            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-[11px] border border-zinc-700">
                              {item.role}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-center text-xs text-zinc-500 italic">
                  Tidak ada data tabel petugas terlampir secara inline.
                </div>
              )}
            </div>

            {/* Tembusan list if any */}
            {doc.tembusan && doc.tembusan.length > 0 && (
              <div className="pt-2 text-xs text-zinc-400 space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Tembusan Surat:
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-zinc-300 pl-1">
                  {doc.tembusan.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bottom Security Note */}
            <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="space-y-0.5">
                <p className="text-[11px] font-mono text-zinc-400">
                  🔐 <strong>TTD Digital &amp; QR Signature</strong> disahkan via KIAN HQ Operating System.
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  Document Hash / Ledger ID: <span className="text-zinc-400">{doc.id}</span>
                </p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                ● Live Verified Ledger
              </span>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-red-500/30 rounded-3xl p-8 sm:p-12 text-center max-w-md mx-auto space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-3xl mx-auto border border-red-500/30">
              ⚠️
            </div>
            <h2 className="text-xl font-black text-white">
              Dokumen Tidak Ditemukan
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Nomor atau ID dokumen <span className="font-mono text-zinc-200 font-bold break-all">"{id}"</span> tidak terdaftar dalam arsip resmi KIAN HQ atau belum pernah diterbitkan secara sah.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                className="inline-block px-5 py-2.5 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 transition-all"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-zinc-600 font-mono border-t border-zinc-900">
        © {new Date().getFullYear()} KIAN HQ Document Verification Ledger. PT Kian Kreasi Anak Nusantara.
      </footer>
    </div>
  );
}
