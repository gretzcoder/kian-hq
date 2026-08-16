'use client';

import { useState, useTransition } from 'react';
import { completeFeatureTourAction } from '@/modules/profile/actions';

interface FeatureTourModalProps {
  userName: string;
  userType: string;
  roles: string[];
  permissions: string[];
  isMentor?: boolean;
}

export function FeatureTourModal({
  userName,
  userType,
  roles,
  permissions,
  isMentor = false,
}: FeatureTourModalProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const isExecutive = roles.includes('EXECUTIVE') || permissions.includes('ADMIN_SYSTEM');
  const isCoordinator = roles.includes('COORDINATOR') || permissions.includes('WORKSPACE_MANAGE');
  const isMentorRole = isMentor || roles.some((r) => r.toUpperCase().includes('MENTOR'));

  // Define steps dynamically based on account type and role
  const getTourSteps = () => {
    if (isExecutive) {
      return [
        {
          badge: '👑 EKSEKUTIF & SUPERADMIN',
          title: `Selamat Datang, ${userName}!`,
          subtitle: 'Portal Kontrol Eksekutif & Manajemen Platform Kian HQ',
          description:
            'Sebagai Eksekutif/Admin, Anda memiliki akses penuh untuk mengelola platform, memantau performa tim, dan mengatur sistem penugasan.',
          icon: '💎',
          highlights: [
            { icon: '📊', title: 'Dashboard Analytics', desc: 'Pantau grafik statistik, total Sparks, dan pencapaian tim secara real-time.' },
            { icon: '⚡', title: 'Sparks Management', desc: 'Atur multiplier poin kategori (Design/Video), beri apresiasi, atau reset poin.' },
            { icon: '👥', title: 'User & Role Matrix', desc: 'Kelola pendaftaran pengguna, penetapan role, serta fitur simulasi View As Role.' },
          ],
          tip: 'Tip: Gunakan switcher "View As Role" di kanan atas untuk mensimulasikan tampilan pengguna lain.',
        },
        {
          badge: '📊 ANALISTIK & KINERJA TIM',
          title: 'Monitoring Kinerja & Papan Leaderboard',
          subtitle: 'Metrik produktivitas dan evaluasi kualitas secara transparan',
          description:
            'Pantau siapa kreator paling aktif, perolehan Combo Sempurna (tanpa revisi & tepat waktu), dan tren kontribusi seluruh tim.',
          icon: '📈',
          highlights: [
            { icon: '🏆', title: 'Papan Leaderboard', desc: 'Lihat peringkat produktivitas mingguan, bulanan, dan sepanjang masa.' },
            { icon: '📜', title: 'Riwayat Sparks History', desc: 'Cek rincian rumus perhitungan dan penyesuaian poin tiap tugas.' },
            { icon: '💬', title: 'Executive Feedback', desc: 'Kirimkan arahan dan masukan langsung dari jajaran direksi ke tim.' },
          ],
        },
        {
          badge: '📁 WORKSPACE & BRIEF KAMPANYE',
          title: 'Pengawasan Proyek & Brief Kampanye',
          subtitle: 'Transparansi dari brief awal hingga pengolahan hasil karya',
          description:
            'Pantau seluruh workspace proyek aktif, ajukan brief baru, dan tinjau pengajuan yang membutuhkan persetujuan.',
          icon: '🗂️',
          highlights: [
            { icon: '📋', title: 'Review Center', desc: 'Setujui atau berikan catatan revisi pada karya yang telah dikumpulkan.' },
            { icon: '💡', title: 'Campaign Briefs', desc: 'Buat dan setujui brief kampanye yang menjadi acuan utama tugas tim.' },
            { icon: '📚', title: 'Knowledge Base', desc: 'Akses dan kelola pustaka SOP serta pedoman alur kerja standar.' },
          ],
        },
        {
          badge: '🚀 SIAP MEMULAI',
          title: 'Platform Siap Digunakan!',
          subtitle: 'Seluruh kontrol sistem kini berada di tangan Anda',
          description:
            'Anda telah mempelajari seluruh fitur utama platform Kian HQ. Klik tombol di bawah untuk mulai menjelajahi dashboard.',
          icon: '🎉',
          highlights: [
            { icon: '🔔', title: 'Notifikasi Real-time', desc: 'Pantau update pengajuan dan obrolan melalui drawer notifikasi.' },
            { icon: '💬', title: 'Komunitas & Chat', desc: 'Berdiskusi secara fleksibel di ruang obrolan komunitas.' },
          ],
        },
      ];
    }

    if (isCoordinator) {
      return [
        {
          badge: '🎯 KOORDINATOR PROYEK',
          title: `Selamat Datang, Koordinator ${userName}!`,
          subtitle: 'Pusat Komando Pengelolaan Proyek, Tugas & Peserta OJT/Troopers',
          description:
            'Sebagai Koordinator, Anda bertanggung jawab mengarahkan alur kerja workspace, membagi tugas, dan mengevaluasi karya.',
          icon: '⚡',
          highlights: [
            { icon: '📁', title: 'Pengelolaan Workspace', desc: 'Buat workspace kampanye baru dan tentukan tim yang bertugas.' },
            { icon: '➕', title: 'Penugasan & Multiplier', desc: 'Buat tugas, set deadline, dan atur multiplier poin Sparks khusus tugas.' },
            { icon: '📋', title: 'Review & Persetujuan', desc: 'Tinjau karya tim, berikan masukan revisi, atau setujui karya.' },
          ],
          tip: 'Tip: Anda dapat mengubah multiplier Sparks pada tombol ⚡ di setiap kartu tugas.',
        },
        {
          badge: '📋 REVIEW & PENILAIAN',
          title: 'Alur Review Center & Poin Sparks',
          subtitle: 'Penilaian karya secara objektif dengan penghargaan otomatis',
          description:
            'Setiap tugas yang Anda setujui akan mengalkulasi poin Sparks secara otomatis berdasarkan peran, kualitas, dan multiplier.',
          icon: '🔍',
          highlights: [
            { icon: '🎯', title: 'Combo Sempurna (1.21x)', desc: 'Tugas yang disetujui tanpa revisi & tepat waktu mendapat bonus 21%.' },
            { icon: '💬', title: 'Catatan Apresiasi', desc: 'Sampaikan umpan balik membangun yang akan tampil di riwayat peserta.' },
            { icon: '👥', title: 'Direktori OJT & Troopers', desc: 'Pantau keaktifan peserta dan histori perolehan poin mereka.' },
          ],
        },
        {
          badge: '🚀 SIAP MENGELOLA TIM',
          title: 'Siap Mengarahkan Proyek!',
          subtitle: 'Semua alat manajemen telah disiapkan untuk Anda',
          description:
            'Klik tombol di bawah untuk menyelesaikan tur fitur dan mulai mengelola workspace serta tugas tim Anda.',
          icon: '🌟',
          highlights: [
            { icon: '📢', title: 'Pengumuman Tim', desc: 'Publikasikan pengumuman penting yang akan tampil di sidebar anggota.' },
            { icon: '📚', title: 'Knowledge Base', desc: 'Manfaatkan SOP dan panduan alur kerja untuk konsistensi kualitas.' },
          ],
        },
      ];
    }

    if (isMentorRole) {
      return [
        {
          badge: '🎓 MENTOR & ASSESSOR',
          title: `Selamat Datang, Mentor ${userName}!`,
          subtitle: 'Platform Bimbingan & Evaluasi Peserta OJT / Troopers',
          description:
            'Sebagai Mentor, Anda bertugas membimbing peserta, menguji Skill Assessment, dan memberikan masukan konstruktif.',
          icon: '📑',
          highlights: [
            { icon: '📝', title: 'Skill Assessment Test', desc: 'Uji kemampuan peserta melalui workspace assessment khusus.' },
            { icon: '🔍', title: 'Review & Evaluasi Karya', desc: 'Berikan masukan revisi atau persetujuan mentor pada hasil kerja peserta.' },
            { icon: '✨', title: 'Sparks Assessment Poin', desc: 'Dapatkan poin apresiasi mentor atas bimbingan assessment yang Anda lakukan.' },
          ],
          tip: 'Tip: Buka tab Assessment di workspace untuk meninjau tugas evaluasi peserta.',
        },
        {
          badge: '🚀 SIAP MEMBIMBING',
          title: 'Siap Membimbing Troopers!',
          subtitle: 'Bantu peserta mencapai potensi maksimal mereka',
          description:
            'Klik tombol di bawah untuk menyelesaikan tur dan mulai membimbing peserta di Kian HQ.',
          icon: '🎓',
          highlights: [
            { icon: '🏆', title: 'Pantau Leaderboard', desc: 'Lihat posisi dan perkembangan peserta binaan Anda di papan peringkat.' },
            { icon: '📚', title: 'Knowledge Base', desc: 'Bagikan materi panduan melalui pustaka Knowledge Base.' },
          ],
        },
      ];
    }

    // Default for Kreator / Troopers / OJT Regular
    return [
      {
        badge: '🎨 KREATOR & TROOPERS',
        title: `Selamat Datang di Kian HQ, ${userName}!`,
        subtitle: 'Ruang kerja digital untuk berkarya, berkolaborasi, dan berkembang',
        description:
          'Kian HQ adalah tempat kamu menerima penugasan, mengumpulkan hasil kerja, serta mengumpulkan poin Sparks atas setiap pencapaianmu!',
        icon: '🚀',
        highlights: [
          { icon: '📁', title: 'Personal & Workspace Tugas', desc: 'Lihat daftar tugas yang ditugaskan kepadamu lengkap dengan deadline.' },
          { icon: '📤', title: 'Pengumpulan Hasil Kerja', desc: 'Kumpulkan link Google Drive / Figma karya kamu langsung di aplikasi.' },
          { icon: '✨', title: 'Perolehan Poin Sparks', desc: 'Dapatkan poin Sparks setiap kali tugas kamu berhasil disetujui!' },
        ],
        tip: 'Tip: Selalu perhatikan deadline dan kumpulkan karya terbaikmu untuk perolehan poin maksimal!',
      },
      {
        badge: '✨ FORMULA SPARKS & COMBO',
        title: 'Rahasia Poin Sparks Maksimal',
        subtitle: 'Dapatkan multiplier ekstra di setiap penugasan',
        description:
          'Sistem Kian HQ memberikan poin berdasarkan kerumitan peran dan disiplin pengumpulan karyamu.',
        icon: '💎',
        highlights: [
          { icon: '⚡', title: 'Role Multiplier (2x)', desc: 'Peran Designer & Video Editor secara otomatis mendapatkan pengali 2x.' },
          { icon: '🎯', title: 'Combo Sempurna (1.21x)', desc: 'Kumpulkan karya tepat waktu dan tanpa revisi untuk bonus 21% poin ekstra!' },
          { icon: '🏆', title: 'Papan Leaderboard', desc: 'Bersaing secara sehat dan jadilah yang teratas di leaderboard bulanan.' },
        ],
      },
      {
        badge: '📚 KNOWLEDGE & KOMUNITAS',
        title: 'Belajar & Berinteraksi',
        subtitle: 'Akses SOP penting dan berdiskusi dengan sesama anggota tim',
        description:
          'Gunakan fitur penunjang untuk mempermudah pengerjaan tugas dan memperluas relasimu.',
        icon: '💬',
        highlights: [
          { icon: '📖', title: 'Knowledge Base', desc: 'Pelajari SOP, panduan desain, dan tips alur kerja terbaik.' },
          { icon: '💬', title: 'Komunitas & Chat', desc: 'Ruang obrolan santai dan berdiskusi seputar proyek.' },
          { icon: '🔔', title: 'Notifikasi Real-time', desc: 'Dapatkan pemberitahuan langsung begitu tugasmu disetujui atau perlu revisi.' },
        ],
      },
      {
        badge: '🎉 SIAP BERKARYA',
        title: 'Kamu Siap Memulai!',
        subtitle: 'Tunjukkan karya terbaikmu di Kian HQ',
        description:
          'Seluruh fitur telah kamu pelajari. Klik tombol di bawah untuk menyelesaikan tur dan mulai menjelajahi platform!',
        icon: '🌟',
        highlights: [
          { icon: '✅', title: '100% Siap', desc: 'Akunmu sudah terkonfigurasi dan siap menerima penugasan pertama.' },
        ],
      },
    ];
  };

  const steps = getTourSteps();
  const currentStep = steps[currentStepIndex] || steps[0];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      startTransition(async () => {
        await completeFeatureTourAction();
      });
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none">
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Glow Accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-pink-600/30 blur-3xl pointer-events-none rounded-full" />

        {/* Step Progress Bar */}
        <div className="flex items-center justify-between gap-4 relative z-10">
          <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
            {currentStep.badge}
          </span>
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStepIndex
                    ? 'w-6 bg-purple-500 shadow-sm shadow-purple-500/50'
                    : idx < currentStepIndex
                    ? 'w-2 bg-purple-500/40'
                    : 'w-2 bg-zinc-800'
                }`}
              />
            ))}
            <span className="text-[10px] font-mono text-zinc-400 ml-1">
              {currentStepIndex + 1}/{steps.length}
            </span>
          </div>
        </div>

        {/* Header Content */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <span className="text-4xl p-2.5 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 shadow-inner">
              {currentStep.icon}
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight">
                {currentStep.title}
              </h2>
              <p className="text-xs text-purple-400 font-semibold">{currentStep.subtitle}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed pt-1">{currentStep.description}</p>
        </div>

        {/* Highlight Feature Cards */}
        <div className="space-y-2.5 relative z-10 pt-1">
          {currentStep.highlights.map((h, i) => (
            <div
              key={i}
              className="bg-zinc-800/40 border border-zinc-800/80 rounded-2xl p-3.5 flex items-start gap-3 hover:border-purple-500/30 transition-colors"
            >
              <span className="text-xl shrink-0 p-1.5 rounded-xl bg-zinc-800 text-zinc-200">
                {h.icon}
              </span>
              <div className="space-y-0.5 min-w-0">
                <h4 className="text-xs font-bold text-zinc-100">{h.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-snug">{h.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Pro Tip Box (if available) */}
        {currentStep.tip && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] px-3.5 py-2.5 rounded-2xl flex items-center gap-2 font-mono relative z-10">
            <span>💡</span>
            <span>{currentStep.tip}</span>
          </div>
        )}

        {/* Action Controls Footer */}
        <div className="pt-4 border-t border-zinc-800/80 flex items-center justify-between gap-3 relative z-10">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStepIndex === 0 || pending}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              currentStepIndex === 0 || pending
                ? 'opacity-30 cursor-not-allowed text-zinc-600'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-800'
            }`}
          >
            ← Kembali
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={pending}
            className="px-6 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
          >
            {pending ? (
              <span>Memproses…</span>
            ) : isLastStep ? (
              <>
                <span>Mulai Jelajahi Platform</span>
                <span>🚀</span>
              </>
            ) : (
              <>
                <span>Lanjut</span>
                <span>→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
