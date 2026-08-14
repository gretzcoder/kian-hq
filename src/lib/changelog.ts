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

export interface GitCommitLog {
  hash: string;
  date: string;
  author: string;
  message: string;
}

export const SYSTEM_CHANGELOG: ChangelogItem[] = [
  {
    "id": "v1.8.0",
    "version": "v1.8.0",
    "date": "14 Agustus 2026",
    "title": "⚡ Direct Brief Koordinator, Open Submission & Log Update Hub",
    "summary": "Pembaruan alur tugas Direct Brief tanpa perantara role kaku, Tiptap WYSIWYG editor brief, sinkronisasi Catatan Improvement Mentor, dan sistem Log Update terintegrasi.",
    "isLatest": true,
    "type": "MAJOR",
    "changes": [
      {
        "category": "✨ Feature",
        "description": "Open Submission Direct Brief: Seluruh anggota workspace (Trooper/Mentor) berhak submit karya secara mandiri pada tugas Direct Brief Koordinator."
      },
      {
        "category": "✨ Feature",
        "description": "WYSIWYG Rich Text Brief: Integrasi Tiptap Editor pada pembuatan tugas untuk keleluasaan penyusunan instruksi berformat."
      },
      {
        "category": "🎨 UI/UX",
        "description": "Output Type Badge: Penanda visual otomatis (🎨 Design Task / 🎬 Video Task) pada header kartu tugas."
      },
      {
        "category": "🐛 Fix",
        "description": "ACC Mentor & Catatan Improvement Synchronized: Tombol dan form catatan masukan mentor diselaraskan di Workspace & Reviews."
      },
      {
        "category": "📜 Feature",
        "description": "Log Update & Changelog Hub: Pusat riwayat pembaruan dan catatan perkembangan sistem KIAN HQ secara terpadu."
      }
    ]
  },
  {
    "id": "v1.7.0",
    "version": "v1.7.0",
    "date": "14 Agustus 2026",
    "title": "💬 Discord-Style Community Chat & Realtime GMT+7 Timestamps",
    "summary": "Manajemen channel kategori chat ala Discord, pembatas tanggal WhatsApp-style (Today, Yesterday, Wednesday), dan jam 24 jam GMT+7 WIB.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "✨ Feature",
        "description": "Discord-Style Category Management: Admin & Koordinator dapat mengelola channel kategori chat (tambah, edit, hapus, urutkan)."
      },
      {
        "category": "🎨 UI/UX",
        "description": "WhatsApp-Style Day Dividers: Penanda barisan hari dalam room chat agar percakapan lebih rapi."
      },
      {
        "category": "🐛 Fix",
        "description": "GMT+7 Realtime Clock: Zona waktu GMT+7 WIB akurat untuk setiap pesan terkirim."
      },
      {
        "category": "📱 UI/UX",
        "description": "Mobile Chat Overflow Fix: Menghilangkan bug scroll horizontal di room chat seluler."
      }
    ]
  },
  {
    "id": "v1.6.0",
    "version": "v1.6.0",
    "date": "13 Agustus 2026",
    "title": "🏆 QC Control Center & Instagram-Style Nested Replies",
    "summary": "Pusat kendali QC untuk Koordinator/Admin (Mentor Revisi, Expired Tasks, Task Plan), balasan komentar bertingkat ala Instagram, dan reaksi emoji.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "✨ Feature",
        "description": "QC Control Center: Kategori khusus Mentor Revisi, Expired Tasks, dan Task Plan (Dijadwalkan)."
      },
      {
        "category": "💬 UI/UX",
        "description": "Instagram-Style Nested Replies: Balasan komentar feedback dengan struktur pohon bertingkat."
      },
      {
        "category": "✨ Feature",
        "description": "Admin Sparks Management & Reaksi Emoji Discord pada feedback."
      }
    ]
  },
  {
    "id": "v1.5.0",
    "version": "v1.5.0",
    "date": "12 Agustus 2026",
    "title": "📋 Troopers Revision Pipeline & Tiptap Rich Feedback Notes",
    "summary": "Tab Troopers Revisi & Perlu Revisi, Tiptap WYSIWYG note viewer, preview Canva link, dan sinkronisasi Web Push notification.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "✨ Feature",
        "description": "Troopers Revisi & Perlu Revisi Tabs: Pemisahan tegas daftar tugas yang membutuhkan revisi intern."
      },
      {
        "category": "📝 UI/UX",
        "description": "CollapsibleNoteViewer: Penampil catatan revisi & apresiasi berformat kaya yang dapat di-expand/collapse."
      },
      {
        "category": "🔔 System/Perf",
        "description": "Web Push Notification Sync: Sinkronisasi notifikasi push real-time dengan Service Worker & database."
      }
    ]
  },
  {
    "id": "v1.4.0",
    "version": "v1.4.0",
    "date": "5 - 6 Agustus 2026",
    "title": "✨ Sparks System, Leaderboard & Floating Notifications",
    "summary": "Sistem pengumpulan Sparks, papan peringkat Trooper & Mentor, laci notifikasi melayang, dan perbaikan filter role RBAC.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "✨ Feature",
        "description": "Creative Sparks & Leaderboard: Akumulasi poin apresiasi karya 1-10 Sparks dan papan peringkat."
      },
      {
        "category": "🔔 Feature",
        "description": "Floating Notification Drawer & Smart Reminder push notifications."
      }
    ]
  },
  {
    "id": "v1.3.0",
    "version": "v1.3.0",
    "date": "30 - 31 Juli 2026",
    "title": "🎓 Onboarding Flow, Staff Profile & TimeGreeting Hero",
    "summary": "Alur registrasi/onboarding profil baru, penyesuaian bidang staff, komentar bertingkat pengumuman, dan hero TimeGreeting 10 kutipan ramah.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "🎓 Feature",
        "description": "Onboarding Flow: Pengisian data keahlian, bidang, bio, dan nomor WhatsApp."
      },
      {
        "category": "💬 UI/UX",
        "description": "Nested Announcement Comments & TimeGreeting quotes otomatis."
      }
    ]
  },
  {
    "id": "v1.2.0",
    "version": "v1.2.0",
    "date": "27 - 29 Juli 2026",
    "title": "📂 Multi Coordinator Combobox, Task Role Decoupling & UI System",
    "summary": "Dukungan banyak koordinator per project, pemisahan role tugas OJT, tenggat waktu ganda (Task & Step), dan sistem dialog toast terpadu.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "👥 Feature",
        "description": "Searchable Combobox Multi-Koordinator pada pembuatan & pengaturan project."
      },
      {
        "category": "📅 Feature",
        "description": "Dual Deadlines: Tenggat waktu independen untuk setiap langkah pengerjaan tugas."
      },
      {
        "category": "🎨 UI/UX",
        "description": "Unified Toast & Confirmation Modal UI System."
      }
    ]
  },
  {
    "id": "v1.1.0",
    "version": "v1.1.0",
    "date": "24 - 25 Juli 2026",
    "title": "🎓 Sequential OJT Workflow & Three-Party QC Approvals",
    "summary": "Alur penugasan OJT berurutan, ruang kerja khusus mentor (Mentor Workspace), dan alur persetujuan QC 3 tingkat.",
    "type": "FEATURE",
    "changes": [
      {
        "category": "⚡ Feature",
        "description": "Sequential Task Rundown: Penguncian tugas prasyarat sebelum di-ACC evaluator."
      },
      {
        "category": "🔒 Feature",
        "description": "Custom Roles CRUD & Unified State Machine untuk hak akses pengguna (RBAC)."
      }
    ]
  },
  {
    "id": "v1.0.0",
    "version": "v1.0.0",
    "date": "23 Juli 2026",
    "title": "🚀 Peluncuran Perdana KIAN HQ",
    "summary": "Peluncuran rilis awal platform manajemen workspace kolaboratif KIAN HQ di Cloudflare Workers & D1 Database.",
    "type": "MAJOR",
    "changes": [
      {
        "category": "🚀 System/Perf",
        "description": "Core Next.js App Router, SQLite D1 Cloudflare setup, Multi-Role Authentication, dan Dashboard Workspace."
      }
    ]
  }
];

export const GIT_COMMIT_LOGS: GitCommitLog[] = [
  {
    "hash": "f1c2d9c",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: add Log Update & Changelog menu and automatic versioning tag (v1.5.1)"
  },
  {
    "hash": "6ade95a",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: align ACC Mentor & Catatan Improvement button label, note form input & note viewer across workspace and review views"
  },
  {
    "hash": "5f7ef98",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: hide submit form for koordinator/admin and clarify mentor workspace submit UI"
  },
  {
    "hash": "a550bde",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: allow mentor & any member open submission for direct brief, hide assign team panel, show task output type badge & clean preview"
  },
  {
    "hash": "9d56455",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: implement WYSIWYG editor for direct brief creation & single submission per submitter filter"
  },
  {
    "hash": "2f95e7d",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: implement open submission direct brief tasks with automatic submit detection & ACC sparks awarding"
  },
  {
    "hash": "fa99aa4",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: implement direct coordinator brief task workflow with brief link & auto assignment"
  },
  {
    "hash": "ea171b8",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "style: optimize dashboard UI layout for mobile views"
  },
  {
    "hash": "e8cef46",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: parse UTC timestamp correctly to GMT+7 and format as 24-hour HH:mm without WIB text"
  },
  {
    "hash": "bd53e5a",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: add WhatsApp/Discord style date dividers and GMT+7 WIB timestamps in room chat"
  },
  {
    "hash": "5e24bcc",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: resolve horizontal scroll overflow on mobile room chat"
  },
  {
    "hash": "d6bbe59",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "feat: add Discord-style category & channel management, default chat room setting, and GMT+7 realtime clock"
  },
  {
    "hash": "9c0f3a1",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: contextualize smart reminder button label and targeted push notification recipient per tab category to prevent spam"
  },
  {
    "hash": "a13d137",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: total rincian step count button label match active tab and collapse step submission details by default"
  },
  {
    "hash": "69c5c5c",
    "date": "2026-08-14",
    "author": "becreatiby",
    "message": "fix: hide step filter buttons on explicit category tabs and update header step count label"
  },
  {
    "hash": "fa367f4",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: contextually filter step submissions list per tab category"
  },
  {
    "hash": "2ac56d8",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: clarify 2-step review badges (Review Mentor vs Review Koordinator) and optimize default tab filter"
  },
  {
    "hash": "6c34b96",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat: allow mentor to add improvement/appreciation note when approving submissions"
  },
  {
    "hash": "35b988e",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat: replace top header/sidebar logo with kian.ico and configure mobile PWA homescreen icons"
  },
  {
    "hash": "7283a10",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: ensure full realtime workflow steps status across all task filter tabs"
  },
  {
    "hash": "6616072",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: render rich HTML notes via CollapsibleNoteViewer and hide redundant step filter pills when unsubmitted"
  },
  {
    "hash": "b6dfbf9",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: group troopers task and mentor task strictly by workspace_type"
  },
  {
    "hash": "a85f087",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat: add comment deletion for admin/coordinator with push notification and Instagram nested comment hierarchy"
  },
  {
    "hash": "f5fe875",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: remove duplicate expand toggle button and add anti-spam pagination for feedback replies"
  },
  {
    "hash": "841099c",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: resolve missing task title and deduplication key in DashboardPersonalWorkspace"
  },
  {
    "hash": "9492a70",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "style: redesign feedback replies to Instagram comment thread style"
  },
  {
    "hash": "e12c88c",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "style: redesign task list to be minimal, clean, and space-efficient"
  },
  {
    "hash": "179fef0",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: resolve stale Server Action ID error with safeExecuteAction and API fallback route"
  },
  {
    "hash": "775657d",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat: implement social media style nested replies and Discord emoji reactions"
  },
  {
    "hash": "a699e04",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix: resolve EditProfileModal layout and stacking context bleeding on mobile screens"
  },
  {
    "hash": "94f7d58",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat: add feedback replies, collapsible threads, and admin sparks management"
  },
  {
    "hash": "778dfe3",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "fix(types): add user_type and start_at optional fields to PersonalTaskRow interface"
  },
  {
    "hash": "df49538",
    "date": "2026-08-13",
    "author": "becreatiby",
    "message": "feat(qc-dashboard): add Mentor Revisi, Task Plan (Dijadwalkan), and Expired Task categories to QC Control Center for Coordinator/Admin"
  },
  {
    "hash": "9aed3fa",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(ui): refine task card status headers and breakdown summaries for All Active Tasks and Selesai & ACC tabs"
  },
  {
    "hash": "8eb17ac",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(ui): eliminate repetitive ASSIGNED pills, add step status sub-filters, refine Smart Reminder push targeting, and enforce default collapsed view"
  },
  {
    "hash": "ccf66de",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(assessment): render CollapsibleNoteViewer for reviewer view and block mentor actions while status is REVISION_REQUESTED pending intern resubmission"
  },
  {
    "hash": "cbe709b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat(ui): ensure CollapsibleNoteViewer is applied across all task detail display locations"
  },
  {
    "hash": "23cbb7c",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat(ui): add CollapsibleNoteViewer for long revision & feedback notes (default collapsed with expand toggle)"
  },
  {
    "hash": "659d17d",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(ui): parse and render WYSIWYG HTML in revision note card using dangerouslySetInnerHTML"
  },
  {
    "hash": "268772b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(notifications): resolve stuck notification bug by refining pending review stage filter, adding manual dismiss on cards, and auto-refreshing on review actions"
  },
  {
    "hash": "00a02f7",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(dashboard): allow coordinator QC actions on mentor workspace tasks in main dashboard QC reviews"
  },
  {
    "hash": "a84760a",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat(notifications): synchronize Web Push notifications with Notification Center via ServiceWorker message broadcast and cross-device DB read status sync"
  },
  {
    "hash": "efe700f",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(notes): fetch appreciation_note and revision_note in workspace query and display rich feedback notes under task/assessment status badges"
  },
  {
    "hash": "7e34c61",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat(review): upgrade review, revision, and decline input notes to Tiptap WYSIWYG rich text editor with full formatting support"
  },
  {
    "hash": "2b0d293",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(assessment): prevent OJT submissions from resetting assessment brief status to WAITING_REVIEW and auto-repair corrupted brief statuses"
  },
  {
    "hash": "fbbea4a",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(tasks): allow coordinator QC actions on mentor workspace tasks"
  },
  {
    "hash": "d8b14d3",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: restrict coordinator final review approval until stage 1 mentor approval is complete"
  },
  {
    "hash": "ae3235a",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: refactor dashboard role check logic to strictly rely on user ROLE column instead of classification"
  },
  {
    "hash": "c428450",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: resolve empty troopers task and troopers revision lists by fixing SQL query parameters and user_id fields"
  },
  {
    "hash": "a00c2c9",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: strictly separate account classification (userType) from step assignee (user_id) for revision task categorization"
  },
  {
    "hash": "387d2a0",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: ensure OJT troopers always see Perlu Revisi tab for their requested revisions and live tracking"
  },
  {
    "hash": "a4324e8",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: strictly scope Perlu Revisi vs Troopers Revisi tabs by assigned user_id and fix evaluator name subquery"
  },
  {
    "hash": "ac8cfd3",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: ensure exact evaluator account name on revision note and fix Troopers Revisi tab visibility for mentors"
  },
  {
    "hash": "e8ba0d8",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: add evaluator info to revision note, improve callout design, and scope Perlu Revisi vs Troopers Revisi tabs"
  },
  {
    "hash": "6218e66",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: fetch revision_note with workflow_events fallback for all dashboard task queries"
  },
  {
    "hash": "eb075eb",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: add Troopers Revisi & Perlu Revisi tabs with inline revision resubmit form"
  },
  {
    "hash": "2166b9b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: enable review actions for mentors and prevent self-reminder buttons for task creators/mentors"
  },
  {
    "hash": "85f5900",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: hide coordinator review action buttons during stage 1 mentor review"
  },
  {
    "hash": "2170e90",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: add clear chat per category in community chat and enhance workspace chat bubbles with link previews"
  },
  {
    "hash": "d103cd0",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: scope revision request strictly to participant task_assignments without corrupting parent task brief status and auto-heal existing brief statuses"
  },
  {
    "hash": "d5078f1",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: handle Canva shortlinks gracefully without broken iframe error and provide clear guidance banner"
  },
  {
    "hash": "d5f6e6b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: enhance SubmittedLinkPreviewer to support HTML/multiline text documents with live preview and clean title snippets"
  },
  {
    "hash": "db1795e",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: correct SQL column name from t.type to t.task_type in reviewTasks query"
  },
  {
    "hash": "d4fce12",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: add inline ReviewActions (Approve/Revision/Decline) to QC & Live Task Control Center Perlu Di-Review tab"
  },
  {
    "hash": "95696e8",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: add SubmittedLinkPreviewer (live preview) to QC & Live Task Control Center task detail steps"
  },
  {
    "hash": "4e26190",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: apply review-stage-aware reminder button to all 3 ReviewActions locations (Dashboard QC, Workspace TaskActions, Review Queue)"
  },
  {
    "hash": "6b1089b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: hide coordinator reminder button when already at coordinator review stage, add mentor-to-coordinator reminder flow"
  },
  {
    "hash": "4512a09",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: strictly filter Troopers Task tab to only include tasks from TROOPERS workspaces"
  },
  {
    "hash": "058aa37",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: include Mentor Workspace/Project tasks under Mentor Task tab and display real-time step breakdown statistics"
  },
  {
    "hash": "b5d31ff",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: populate in-app Pusat Notifikasi modal feed with reminder workflow events"
  },
  {
    "hash": "0d6962b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: display only submitted task results by default with compact unsubmitted toggle, add batch 1-click TaskSmartReminderButton at task card level"
  },
  {
    "hash": "f941e60",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: make task cards collapsible by default, refine mentor task filter, single smart reminder button, submitted items sorted top with content display, add Perlu Di-Review tab"
  },
  {
    "hash": "eb84a0c",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: group dashboard tasks per parent task card to eliminate spam and display role sub-tasks with progress"
  },
  {
    "hash": "2d2394f",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: remove invalid p.deleted_at column from dashboard SQL queries"
  },
  {
    "hash": "d9360a8",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: implement role-tailored task categories (All Active Tasks, Troopers Task, Mentor Task, Selesai) with smart reminders and soft-delete filtering"
  },
  {
    "hash": "020777d",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: replace non-existent action column with to_status in workflow_events subqueries"
  },
  {
    "hash": "faa07c7",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: resolve erroneous display of submitted HTML content in evaluator note box for active tasks"
  },
  {
    "hash": "abccd06",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: resolve missing submission preview for Canva shortlinks and default expand preview frame in mentor workspace"
  },
  {
    "hash": "eae3421",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: handle iOS Chrome restrictions and provide interactive Safari guide modal for PWA and push notifications"
  },
  {
    "hash": "56591bb",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix: resolve duplicate list duplication bug when toggling active vs completed tabs in DashboardPersonalWorkspace"
  },
  {
    "hash": "7149e6b",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: add workflow_events note fallback, role-specific dashboard views, and Send Reminder to Mentor feature"
  },
  {
    "hash": "cd373f9",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "feat: store and display approval appreciation notes, add completed tasks tracker tab on dashboard"
  },
  {
    "hash": "08cc643",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(auth): add REST API fallback for Next.js Server Action build hash mismatches on iOS/Safari"
  },
  {
    "hash": "a7761c8",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(ui): fix mobile profile floating dropdown clipping and positioning via React Portal"
  },
  {
    "hash": "d3e6426",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(tasks): fix revision loop bug, clear revision note on resubmission, and enable single approval transition for OJT roles"
  },
  {
    "hash": "57d1d10",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "fix(push-notif): fix iOS notification permission request, date-fns RangeError, and web favicon icon"
  },
  {
    "hash": "5ebbc64",
    "date": "2026-08-12",
    "author": "becreatiby",
    "message": "Room Chat fix"
  },
  {
    "hash": "fd20bd0",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(push-notifications): generate valid VAPID keys, auto-register Web Push in dashboard layout, expand chat mentions & task events dispatch"
  },
  {
    "hash": "c77d0e5",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(leaderboard): strictly filter role-specific categories (designers, video editors, planners, researchers) to users with approved tasks in that role"
  },
  {
    "hash": "48020f9",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(db): remove non-existent columns (is_pinned, updated_at, category, priority) from announcements query in dashboard/page.tsx"
  },
  {
    "hash": "f969305",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(analytics,sparks): enforce zero caching revalidate=0 and filter deleted tasks/workspaces across all analytics and sparks data tracking"
  },
  {
    "hash": "fcd2902",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(tracking): filter deleted tasks and soft-deleted workspaces from user tracking stats, profile page, and dashboard analytics"
  },
  {
    "hash": "2f45d4c",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(tasks): make submitted results collapsible by default to eliminate UI clutter, and enable edit after submit for mentors and troopers"
  },
  {
    "hash": "3b1232e",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(workspace): auto expand task and step containing submission and add Edit After Submit feature for Mentors and Troopers"
  },
  {
    "hash": "ede26f2",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(editor): make Tiptap text editor toolbar sticky (Google Docs style) and constrain paper canvas height with smooth vertical scrolling"
  },
  {
    "hash": "9e7fbe1",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(tasks): restrict QC approval and scoring in MENTOR workspace strictly to Coordinators with 1-step approval flow"
  },
  {
    "hash": "e208fab",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(workflow): add ASSIGNED and IN_PROGRESS states to task_assignment workflow engine transition map"
  },
  {
    "hash": "80afe89",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(rbac): restrict task creation/editing/deletion in MENTOR workspace strictly to Coordinators and Admins, allowing mentors to edit only their own submission results"
  },
  {
    "hash": "e97fd3b",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(rbac): allow mentor accounts to update/edit task details in MENTOR workspaces"
  },
  {
    "hash": "fd73104",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(assessment): ensure mentor accounts are recognized as managers in Assessment workspaces to display assessment task cards"
  },
  {
    "hash": "34fd03d",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(review): enable revision requests for Assessment tasks across both Mentor step 1 and Coordinator step 2"
  },
  {
    "hash": "9c7878d",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(workspace): fix mentor add bug in assessment and split member list into Troopers/Mentor categories"
  },
  {
    "hash": "961c737",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(rbac): restrict workspace viewing to members, workspace edit to coordinators/admins, and task edit to designated mentors"
  },
  {
    "hash": "35a3107",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(tasks): default all workspace tasks to collapsed and sort by closest deadline first"
  },
  {
    "hash": "63b141c",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(leaderboard): filter Top Workspaces to display only Troopers category workspaces"
  },
  {
    "hash": "244a183",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(rbac): restrict task creation and workspace management in MENTOR workspaces exclusively to Coordinators"
  },
  {
    "hash": "33e8f5d",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(tasks): ensure step 1 & step 2 use rich text editor and step 3 uses Google Drive/Canva link, with auto-opening submit form on start work"
  },
  {
    "hash": "30fb695",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "feat(workspace): add new Mentor workspace category with multi-mentor task auto-assignment and step 1-2 private / step 3 shared visibility"
  },
  {
    "hash": "bd5792e",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(qc): implement 2-step assessment QC review flow"
  },
  {
    "hash": "e9237c6",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "feat(workspace): allow admin and coordinators to change workspace type in EditWorkspaceModal"
  },
  {
    "hash": "d630db5",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(leaderboard): update livetime account role resolution and clean up task completed display"
  },
  {
    "hash": "bfcc322",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(leaderboard): exclude mentors from non-mentor categories and remove Direct Pass label"
  },
  {
    "hash": "06ef489",
    "date": "2026-08-11",
    "author": "becreatiby",
    "message": "fix(ui): close assessment panel by default on OJT troopers account"
  },
  {
    "hash": "0db2e96",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "fix: resolve phantom QC review spam for unsubmitted assessment tasks"
  },
  {
    "hash": "acf5fcd",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "feat: add manual participant management for assessment tasks"
  },
  {
    "hash": "a76def3",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "fix(analytics): exclude deleted tasks and implement realtime status normalization & metrics"
  },
  {
    "hash": "b616246",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "fix(assessment): fix auto-expand, edit/delete modal & timezone (WIB) handling"
  },
  {
    "hash": "5371889",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "fix(assessment): fix assessment brief submission status bug and mobile chat UI"
  },
  {
    "hash": "4b741a2",
    "date": "2026-08-10",
    "author": "becreatiby",
    "message": "Update Community Chat"
  },
  {
    "hash": "c5d939b",
    "date": "2026-08-08",
    "author": "becreatiby",
    "message": "fix: sendPushNotificationToUser payload signature in communityActions"
  },
  {
    "hash": "ed5090f",
    "date": "2026-08-08",
    "author": "becreatiby",
    "message": "fix: resolve View as Role simulation badge in community chat and add image preview thumbnail cards for URL attachments"
  },
  {
    "hash": "52dc5dc",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "feat: parse @mentions in chat messages into interactive clickable badge buttons that open user profile popover modal"
  },
  {
    "hash": "45205ac",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "feat: add interactive @mention autocomplete popover menu with keyboard navigation and push notifications"
  },
  {
    "hash": "ccf9d83",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "style: redesign Community Chat member sidebar with premium glassmorphism, vibrant gradient headers, and role badge pills"
  },
  {
    "hash": "7b4bb71",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: upgrade Create & Edit Assessment modal layout to spacious max-w-4xl with sticky header and footer"
  },
  {
    "hash": "ab764bd",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: resolve sidebar scrolling lock, mobile user management card layout, and sparks metrics balance"
  },
  {
    "hash": "5ca6eef",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: use React Portal for FloatingNotificationDrawer to escape header backdrop-blur containing block clipping"
  },
  {
    "hash": "5bbe1c1",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "feat: enhance mobile UI responsiveness across OJT Directory, Users Management, Permission Matrix, and Sparks Management"
  },
  {
    "hash": "2a6f527",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: pass userId in workspace team member profile links and display UserAvatar"
  },
  {
    "hash": "a00b759",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "feat: implement Web Push Notifications with Service Worker background alerts, direct navigation, and user preference settings"
  },
  {
    "hash": "d0294e6",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: unify UserAvatar component fallback & fix deleted assessment workspace task counting"
  },
  {
    "hash": "dcdd710",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "fix: make live chat fail-safe and realtime for production web deployments"
  },
  {
    "hash": "939c894",
    "date": "2026-08-07",
    "author": "becreatiby",
    "message": "feat: modernize workspace chat with emojis, stickers, smart links, clear chat, edit limits, and fix sparks calculation"
  },
  {
    "hash": "dd1bc0e",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "fix: add migration 0045 for tasks.assigned_to and update queries to join task_assignments"
  },
  {
    "hash": "96aeade",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "fix: select core columns in migration 0044 to prevent assigned_by error"
  },
  {
    "hash": "7331ee9",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "fix: ensure ta.deadline column in migration 0044"
  },
  {
    "hash": "d932784",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "bismillah"
  },
  {
    "hash": "48a4f6e",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "rollback bismillah"
  },
  {
    "hash": "b743aed",
    "date": "2026-08-06",
    "author": "becreatiby",
    "message": "feat: add Sparks management, floating notifications, modern live chat, and workspace listing fixes"
  },
  {
    "hash": "93fd7bf",
    "date": "2026-08-05",
    "author": "gretzcoder",
    "message": "Add GitHub Actions workflow for Cloudflare deployment"
  },
  {
    "hash": "343c5a5",
    "date": "2026-08-05",
    "author": "Mohamad Abi",
    "message": "update workspace"
  },
  {
    "hash": "94912d5",
    "date": "2026-08-05",
    "author": "Gretz Coder",
    "message": "update user, workspace, text editor, project"
  },
  {
    "hash": "8825bab",
    "date": "2026-08-05",
    "author": "GretzCoder",
    "message": "ci: update Node.js version to v22 in GitHub Actions"
  },
  {
    "hash": "0a4a91c",
    "date": "2026-08-05",
    "author": "GretzCoder",
    "message": "ci: add GitHub Actions workflow for automatic Cloudflare deployment"
  },
  {
    "hash": "c383985",
    "date": "2026-08-05",
    "author": "GretzCoder",
    "message": "fix: update workspace and project actions with permission checks"
  },
  {
    "hash": "9031d95",
    "date": "2026-08-04",
    "author": "GretzCoder",
    "message": "fix: remove unused WorkspaceReadTracker from workspace list page"
  },
  {
    "hash": "f916910",
    "date": "2026-08-04",
    "author": "GretzCoder",
    "message": "fix: import getSparkMeta in AssessmentPanel"
  },
  {
    "hash": "c6213cb",
    "date": "2026-08-04",
    "author": "GretzCoder",
    "message": "feat: updates, workspace assessments, announcements read tracker, and RBAC permission fixes"
  },
  {
    "hash": "351ea09",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: add MENTOR TROOPERS system role and limit workspace mentor dropdown selection"
  },
  {
    "hash": "4dd73f3",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: allow full multi-line text wrapping for mobile quotes in TimeGreeting"
  },
  {
    "hash": "05b6285",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: remove icon from Workspaces tab and rename Activity Timeline to Activities"
  },
  {
    "hash": "8ed2a85",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: clean up project details page UI, remove content brief tab, update coordinator gear icon"
  },
  {
    "hash": "719c32c",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: render TimeGreeting quotes as mobile & desktop dashboard hero subheader"
  },
  {
    "hash": "1d4068f",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: add single mentor selection for workspace creation in project"
  },
  {
    "hash": "4558bfa",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: handle optional coordinator correctly in createProject to avoid D1 foreign key error"
  },
  {
    "hash": "ec486cc",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: add TimeGreeting component with 10 random friendly quotes per time category"
  },
  {
    "hash": "f789623",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: add dedicated feedbacks page at /dashboard/feedbacks and sidebar menu item"
  },
  {
    "hash": "862e12e",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: change feedback notification text to friendly non-formal wording"
  },
  {
    "hash": "c8dbbdd",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: add Mini Leaderboard widget to dashboard right panel"
  },
  {
    "hash": "39f0a17",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: make dashboard announcements clickable and remove system specs widget"
  },
  {
    "hash": "0a8a251",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: rename leaderboard Top Coordinators tab to Top Mentors and clean profile UI"
  },
  {
    "hash": "c281512",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: ultra compact mobile profile layout with inline WhatsApp link and glassmorphism edit button"
  },
  {
    "hash": "bf95df4",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: remove profile page header and rename sidebar Updates menu to Announcements"
  },
  {
    "hash": "e60c3b7",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: await normalizeWhatsappNumber in updateOjtProfile to resolve onboarding step 2 serialization error"
  },
  {
    "hash": "da0d45d",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: auto-focus comment input on reply button click"
  },
  {
    "hash": "6cef77a",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: suppress body hydration warning and auto alter announcement_comments parent_id column"
  },
  {
    "hash": "c3d8c20",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: true parent-child nested comment threading for announcements"
  },
  {
    "hash": "742b91b",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: indented thread layout for comment replies and auto D1 announcement tables init"
  },
  {
    "hash": "2b4b215",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: premium profile card restyle with hero cover banner and clean intro bio"
  },
  {
    "hash": "a33f8cf",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: dev cloudflare context fallback and specific user profile navigation"
  },
  {
    "hash": "62d223d",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: user avatar rendering, profile redirect links, comment reply feature, and clean announcement header"
  },
  {
    "hash": "f5f3453",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: whatsapp normalization, mobile sidebar auto-close, profile picture rendering and mobile badge layout"
  },
  {
    "hash": "604cd94",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "style: refine PendingApprovalsList header title, badge and subtext for mobile"
  },
  {
    "hash": "34a8980",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "fix: improve PendingApprovalsList mobile layout and responsive controls"
  },
  {
    "hash": "f69bcfe",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: customize profile & onboarding modal for Staff users and retain skills/tools"
  },
  {
    "hash": "261e392",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: dynamic staff profile fields (department/title), bio for staff & OJT, and updated placeholder text"
  },
  {
    "hash": "e795fa0",
    "date": "2026-07-31",
    "author": "GretzCoder",
    "message": "feat: task step collapse/expand, auto-expand active step, total sparks display, and interactive EditSparksModal"
  },
  {
    "hash": "0c1f9e8",
    "date": "2026-07-30",
    "author": "GretzCoder",
    "message": "feat: onboarding flow, ojt profile enhancements, leaderboard mobile optimization, and modal edit profile"
  },
  {
    "hash": "7acc089",
    "date": "2026-07-29",
    "author": "GretzCoder",
    "message": "feat: implement ProjectCoordinatorsManager, 1-10 Creative Sparks, Designer/Video Editor task separation, fast login, and UI polish"
  },
  {
    "hash": "3c4725b",
    "date": "2026-07-29",
    "author": "GretzCoder",
    "message": "refactor(ux): streamline project detail & review queue UI with tabbed progressive disclosure"
  },
  {
    "hash": "e5a1083",
    "date": "2026-07-29",
    "author": "GretzCoder",
    "message": "refactor(ux): simplify workspace detail layout with tabbed navigation & clean consolidated QC badges"
  },
  {
    "hash": "98d1bc1",
    "date": "2026-07-29",
    "author": "GretzCoder",
    "message": "feat(ui): implement unified UI System with custom toast notifications and confirmation dialogs"
  },
  {
    "hash": "d0b85da",
    "date": "2026-07-29",
    "author": "GretzCoder",
    "message": "refactor(dashboard): break down monolithic dashboard page into modular components"
  },
  {
    "hash": "d9ae9f0",
    "date": "2026-07-28",
    "author": "GretzCoder",
    "message": "feat: dual deadline per task/step, WYSIWYG editor fix, Drive preview UX, profile page rewrite with edit, batch assignment validation"
  },
  {
    "hash": "f7064de",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "fix: resolve search input focus issue in project coordinators combobox"
  },
  {
    "hash": "9af8975",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "feat: implement dynamic searchable combobox list for multiple project coordinators"
  },
  {
    "hash": "f654f6b",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "fix: rename next.config.ts to next.config.mjs as recommended by opennextjs-cloudflare"
  },
  {
    "hash": "26b573f",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "fix: call initOpenNextCloudflareForDev unconditionally to support turbopack dev server"
  },
  {
    "hash": "10a1fc7",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "perf: add foreign key indexes and convert junction tables to WITHOUT ROWID"
  },
  {
    "hash": "05dcbcb",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "feat: remove project deadline, rename mentor to coordinator, and allow multiple project coordinators"
  },
  {
    "hash": "bd6ae20",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "feat: decouple task OJT roles from workspace roles to allow task-level role flexibility"
  },
  {
    "hash": "d98c28e",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "feat: align OJT workflow where coordinator assigns project mentor, mentor creates workspace, and roles are split-delegated"
  },
  {
    "hash": "b37f2d4",
    "date": "2026-07-27",
    "author": "GretzCoder",
    "message": "refactor: simplify workspace detail routing to flat hierarchy /dashboard/workspace/[wsId]"
  },
  {
    "hash": "a0fc85b",
    "date": "2026-07-25",
    "author": "GretzCoder",
    "message": "ci: remove GitHub Actions deploy workflow"
  },
  {
    "hash": "1e0105f",
    "date": "2026-07-25",
    "author": "GretzCoder",
    "message": "ci: add GitHub Actions CI/CD workflow for Cloudflare Workers deployment"
  },
  {
    "hash": "615fa08",
    "date": "2026-07-25",
    "author": "GretzCoder",
    "message": "feat: restrict OJT project access, query OJT mentors, and list all active workspaces for OJT members"
  },
  {
    "hash": "0e3807c",
    "date": "2026-07-25",
    "author": "GretzCoder",
    "message": "feat: implement sequential OJT workflow rundown and three-party QC approvals"
  },
  {
    "hash": "de16cdd",
    "date": "2026-07-24",
    "author": "GretzCoder",
    "message": "ui: simplify navigation and dashboard console for On the Job Training users"
  },
  {
    "hash": "bbf90a7",
    "date": "2026-07-24",
    "author": "GretzCoder",
    "message": "feat: implementation of unified state machine, custom roles CRUD, mentor workspaces, and administrative actions"
  },
  {
    "hash": "693c925",
    "date": "2026-07-24",
    "author": "GretzCoder",
    "message": "Solve Bug Permission ui"
  },
  {
    "hash": "572e0a9",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "feat: implement workflow status transition and UPDATE_BRIEF permission check"
  },
  {
    "hash": "444a6df",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "feat: add migrations for workflow permissions"
  },
  {
    "hash": "99cf09e",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "chore: rename worker and self-reference service to 'hq'"
  },
  {
    "hash": "f7878db",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "chore: remove unused oauth types and static text"
  },
  {
    "hash": "b3c1a29",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "fix: clean up wrangler.jsonc - remove Google OAuth vars, update APP_URL to correct workers.dev URL"
  },
  {
    "hash": "8076206",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "fix: remove proxy.ts for Cloudflare Workers edge compatibility, update wrangler.jsonc with real D1/KV IDs"
  },
  {
    "hash": "19e57b2",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "feat: add dashboard, API routes, DB schema, Cloudflare Workers config, and project architecture"
  },
  {
    "hash": "da7962c",
    "date": "2026-07-23",
    "author": "GretzCoder",
    "message": "Initial commit from Create Next App"
  }
];

/**
 * Returns the current latest version string of KIAN HQ (e.g. "v1.8.0")
 */
export function getLatestSystemVersion(): string {
  const latest = SYSTEM_CHANGELOG.find((item) => item.isLatest) || SYSTEM_CHANGELOG[0];
  return latest ? latest.version : 'v1.8.0';
}
