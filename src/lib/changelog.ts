export interface ChangelogItem {
  id: string;
  version: string;
  date: string;
  title: string;
  summary: string;
  isLatest?: boolean;
  type: 'MAJOR' | 'FEATURE' | 'FIX' | 'UI_UX' | 'PERF';
  changes: {
    category: string;
    description: string;
  }[];
}

export const SYSTEM_CHANGELOG: ChangelogItem[] = [
  {
    id: 'v1.5.1',
    version: 'v1.5.1',
    date: '14 Agustus 2026',
    title: '⚡ Open Submission Direct Brief & WYSIWYG Editor Sync',
    summary: 'Pembaruan tugas Direct Brief Koordinator dengan fitur Open Submission untuk semua peserta & mentor, WYSIWYG rich text editor, serta sinkronisasi Catatan Improvement Mentor.',
    isLatest: true,
    type: 'FEATURE',
    changes: [
      {
        category: '✨ Feature',
        description: 'Open Submission Direct Brief: Seluruh peserta dan Mentor workspace berhak mengirimkan hasil karya tanpa batas role kaku.',
      },
      {
        category: '✨ Feature',
        description: 'WYSIWYG Rich Text Brief: Integrasi Tiptap Editor pada pembuatan tugas untuk keleluasaan Koordinator menyusun instruksi brief berformat.',
      },
      {
        category: '🎨 UI/UX',
        description: 'Output Type Badge: Penanda visual otomatis (🎨 Design Task / 🎬 Video Task) pada header kartu tugas.',
      },
      {
        category: '🐛 Fix',
        description: 'Penyelarasan ACC Mentor & Catatan Improvement: Sinkronisasi tombol dan form catatan masukan mentor di halaman Workspace dan Reviews.',
      },
      {
        category: '🐛 Fix',
        description: 'Pembersihan Teks Preview: Menghapus tag mentah HTML & [DIRECT_BRIEF] dari preview deskripsi saat kartu di-collapse.',
      },
      {
        category: '✨ Feature',
        description: 'Log Update System: Pusat riwayat pembaruan sistem otomatis & changelog lengkap di KIAN HQ.',
      },
    ],
  },
  {
    id: 'v1.5.0',
    version: 'v1.5.0',
    date: '13 Agustus 2026',
    title: '💬 Discord-Style Community Chat & Realtime GMT+7 Timestamps',
    summary: 'Peningkatan besar pada Community Chat dengan fitur reorder/edit channel kategori ala Discord, pembatas hari Whatsapp-style, dan waktu live GMT+7.',
    type: 'MAJOR',
    changes: [
      {
        category: '✨ Feature',
        description: 'Discord-Style Category Management: Admin & Koordinator dapat menambah, mengedit, menghapus, dan mengatur urutan channel kategori chat.',
      },
      {
        category: '✨ Feature',
        description: 'Default Chat Room: Otomatis mengarahkan user ke room chat utama saat membuka menu Community Chat.',
      },
      {
        category: '🎨 UI/UX',
        description: 'Whatsapp-Style Day Dividers: Penanda barisan hari (Today, Yesterday, Wednesday, dll) agar percakapan lebih rapi dibaca.',
      },
      {
        category: '🐛 Fix',
        description: 'GMT+7 Realtime Clock: Perbaikan waktu pengiriman pesan yang konsisten dan akurat sesuai zona waktu GMT+7 WIB.',
      },
      {
        category: '📱 UI/UX',
        description: 'Mobile Scroll Fix: Perbaikan bug horizontal scroll pada room chat di perangkat seluler.',
      },
    ],
  },
  {
    id: 'v1.4.2',
    version: 'v1.4.2',
    date: '10 Agustus 2026',
    title: '🏆 Sparks System & Leaderboard Optimization',
    summary: 'Sistem akumulasi poin Sparks untuk mengapresiasi kinerja trooper dan mentor beserta papan peringkat (Leaderboard).',
    type: 'FEATURE',
    changes: [
      {
        category: '✨ Feature',
        description: 'Pemberian Sparks Langsung saat ACC QC oleh Koordinator & Mentor.',
      },
      {
        category: '🏆 Feature',
        description: 'Leaderboard Troopers & Mentors real-time berdasarkan total poin Sparks.',
      },
      {
        category: '⚡ System/Perf',
        description: 'Optimasi query agregasi poin Sparks pada SQLite D1 Cloudflare.',
      },
    ],
  },
  {
    id: 'v1.4.0',
    version: 'v1.4.0',
    date: '5 Agustus 2026',
    title: '📄 Content Briefs & Sequential Prerequisites Lock',
    summary: 'Fitur alur dokumen Content Brief dan sistem penguncian tugas berurutan (Prasyarat Tugas).',
    type: 'FEATURE',
    changes: [
      {
        category: '✨ Feature',
        description: 'Content Briefs Builder untuk pengajuan instruksi konten kreatif.',
      },
      {
        category: '🔒 Feature',
        description: 'Sequential Task Lock: Tugas selanjutnya otomatis terkunci sebelum tugas prasyarat di-ACC.',
      },
      {
        category: '🎓 Feature',
        description: 'OJT Directory & Hak Akses Manajemen Peran (RBAC).',
      },
    ],
  },
  {
    id: 'v1.3.0',
    version: 'v1.3.0',
    date: '25 Juli 2026',
    title: '🤖 KIAN AI Assistant & Knowledge Base',
    summary: 'Integrasi AI Assistant untuk ideasi konten dan pusat dokumentasi tim di Knowledge Base.',
    type: 'FEATURE',
    changes: [
      {
        category: '✨ Feature',
        description: 'KIAN AI Assistant: Asisten kecerdasan buatan untuk membantu pembuatan brief & riset konten.',
      },
      {
        category: '📚 Feature',
        description: 'Knowledge Base: Dokumentasi standar operasional & panduan karya tim.',
      },
    ],
  },
  {
    id: 'v1.0.0',
    version: 'v1.0.0',
    date: '1 Juli 2026',
    title: '🚀 Peluncuran Perdana KIAN HQ',
    summary: 'Peluncuran perdana platform kolaborasi dan manajemen workspace KIAN HQ.',
    type: 'MAJOR',
    changes: [
      {
        category: '🚀 System/Perf',
        description: 'Core Workspace Management, Multi-Role Authentication, & Interactive Dashboard.',
      },
    ],
  },
];

/**
 * Returns the current latest version string of KIAN HQ (e.g. "v1.5.1")
 */
export function getLatestSystemVersion(): string {
  const latest = SYSTEM_CHANGELOG.find((item) => item.isLatest) || SYSTEM_CHANGELOG[0];
  return latest ? latest.version : 'v1.5.1';
}
