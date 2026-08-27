import React from 'react';
import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import {
  getCertificates,
  getCertificateTemplates,
  getCertificateUserOptions,
  getUserMetricsSummary,
  isCertificateAdmin,
} from '@/modules/certificates/certificateActions';
import CertificateDashboardClient from './components/CertificateDashboardClient';

export const revalidate = 0;

export default async function CertificateDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/');
  }

  const { authorized } = await isCertificateAdmin();
  
  // Parallel fetch data
  const [certificates, templates, userOptions, userMetrics] = await Promise.all([
    getCertificates(),
    getCertificateTemplates(),
    authorized ? getCertificateUserOptions() : Promise.resolve([]),
    getUserMetricsSummary(session.userId),
  ]);

  // Personal user's certificate (if any)
  const myCertificate = certificates.find((c) => c.user_id === session.userId) || null;

  return (
    <div className="w-full space-y-6 pb-16 animate-fadeIn">
      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">📜</span>
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Sertifikat Capaian & Verifikasi
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Generate sertifikat otomatis berbasis akumulasi tugas, Sparks, dan lencana prestasi Kian HQ.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
              authorized
                ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                : 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
            }`}
          >
            {authorized ? 'ADMIN / COORDINATOR ACCESS' : 'PERSONAL MEMBER VIEW'}
          </span>
        </div>
      </div>

      {/* Main Interactive Client Component */}
      <CertificateDashboardClient
        initialCertificates={certificates}
        templates={templates}
        userOptions={userOptions}
        userMetrics={userMetrics}
        myCertificate={myCertificate}
        isAdmin={authorized}
        currentUserId={session.userId}
      />
    </div>
  );
}
