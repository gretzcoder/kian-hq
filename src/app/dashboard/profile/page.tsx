import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { redirect } from 'next/navigation';
import EditProfileButton from '@/modules/profile/components/EditProfileButton';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  status: string;
  user_type: string | null;
  created_at: number;
  role_name: string | null;
  university: string | null;
  study_program: string | null;
  semester: string | null;
  whatsapp_number: string | null;
  avatar_url: string | null;
  main_roles: string | null;
  custom_role: string | null;
  tools: string | null;
  portfolio_url: string | null;
}

interface AssignmentStat { status: string; count: number; }
interface RoleStat      { assignment_role: string; count: number; }
interface RecentActivity {
  assignment_id: string;
  task_title: string;
  assignment_role: string;
  status: string;
  workspace_name: string | null;
  project_name: string | null;
  created_at: number;
  deadline: number | null;
}

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/');

  const db = await getDB();

  const [
    profileRaw,
    assignmentStatsRaw,
    roleStatsRaw,
    recentActivityRaw,
    workspaceCountRaw,
    projectCountRaw,
    earnedBadgesRaw,
  ] = await Promise.all([
    db.prepare(`
      SELECT
        u.id, u.email, u.name, u.status, u.user_type, u.created_at, r.name as role_name,
        u.university, u.study_program, u.semester, u.whatsapp_number, u.avatar_url,
        u.main_roles, u.custom_role, u.tools, u.portfolio_url
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ?
    `).bind(session.userId).first(),

    db.prepare(`
      SELECT status, COUNT(*) as count
      FROM task_assignments
      WHERE user_id = ?
      GROUP BY status
    `).bind(session.userId).all(),

    db.prepare(`
      SELECT assignment_role, COUNT(*) as count
      FROM task_assignments
      WHERE user_id = ?
      GROUP BY assignment_role
      ORDER BY count DESC
    `).bind(session.userId).all(),

    db.prepare(`
      SELECT
        ta.id as assignment_id,
        t.title as task_title,
        ta.assignment_role,
        ta.status,
        ta.created_at,
        ta.deadline,
        ws.name as workspace_name,
        p.name as project_name
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE ta.user_id = ?
      ORDER BY ta.created_at DESC
      LIMIT 8
    `).bind(session.userId).all(),

    db.prepare(`
      SELECT COUNT(DISTINCT t.workspace_id) as count
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = ?
    `).bind(session.userId).first(),

    db.prepare(`
      SELECT COUNT(DISTINCT t.project_id) as count
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = ?
    `).bind(session.userId).first(),

    db.prepare(`
      SELECT we.note, ta.assignment_role
      FROM workflow_events we
      JOIN task_assignments ta ON we.entity_id = ta.id
      WHERE ta.user_id = ? AND (we.note LIKE '%[Sparks:%' OR we.note LIKE '%[Badge:%')
    `).bind(session.userId).all(),
  ]);

  const profile          = profileRaw as unknown as UserProfile | null;
  const assignmentStats  = assignmentStatsRaw.results as unknown as AssignmentStat[];
  const roleStats        = roleStatsRaw.results as unknown as RoleStat[];
  const recentActivity   = recentActivityRaw.results as unknown as RecentActivity[];
  const workspaceCount   = (workspaceCountRaw as unknown as { count: number } | null)?.count ?? 0;
  const projectCount     = (projectCountRaw  as unknown as { count: number } | null)?.count ?? 0;

  // Calculate Creative Sparks & Role Breakdown
  let totalSparks = 0;
  const roleSparksMap: Record<string, number> = {
    RESEARCHER: 0,
    PLANNER: 0,
    DESIGNER: 0,
    VIDEO_EDITOR: 0,
    CREATOR: 0,
  };

  (earnedBadgesRaw.results as any[]).forEach((row) => {
    const sparkMatch = row.note?.match(/\[Sparks:\s*(\d+)\]/);
    if (sparkMatch && sparkMatch[1]) {
      const val = parseInt(sparkMatch[1], 10);
      totalSparks += val;
      const r = row.assignment_role || 'CREATOR';
      roleSparksMap[r] = (roleSparksMap[r] || 0) + val;
    }
  });

  // Determine Dynamic Title Badges (Standardized Order: Researcher -> Planner -> Designer -> Video Editor)
  const titleBadges: { title: string; emoji: string; desc: string; color: string }[] = [];
  if (roleSparksMap.RESEARCHER >= 15) {
    titleBadges.push({ title: 'ELITE RESEARCHER', emoji: '🔍', desc: `${roleSparksMap.RESEARCHER} Sparks`, color: 'from-blue-500/15 to-cyan-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300' });
  }
  if (roleSparksMap.PLANNER >= 15) {
    titleBadges.push({ title: 'TOP PLANNER', emoji: '🧠', desc: `${roleSparksMap.PLANNER} Sparks`, color: 'from-amber-500/15 to-orange-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300' });
  }
  if (roleSparksMap.DESIGNER >= 15) {
    titleBadges.push({ title: 'TOP DESIGNER', emoji: '🎨', desc: `${roleSparksMap.DESIGNER} Sparks`, color: 'from-purple-500/15 to-pink-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300' });
  }
  if (roleSparksMap.VIDEO_EDITOR >= 15) {
    titleBadges.push({ title: 'TOP VIDEO EDITOR', emoji: '🎬', desc: `${roleSparksMap.VIDEO_EDITOR} Sparks`, color: 'from-pink-500/15 to-rose-500/15 border-pink-500/30 text-pink-700 dark:text-pink-300' });
  }

  const getCount = (statuses: string[]) =>
    assignmentStats.filter((s) => statuses.includes(s.status)).reduce((a, s) => a + Number(s.count), 0);

  const totalAssignments = assignmentStats.reduce((a, s) => a + Number(s.count), 0);
  const totalApproved    = getCount(['APPROVED', 'LOCKED', 'PUBLISHED']);
  const totalInProgress  = getCount(['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'WAITING_REVIEW', 'RESUBMITTED']);
  const totalRevision    = getCount(['REVISION_REQUESTED']);
  const approvalRate     = totalAssignments > 0 ? Math.round((totalApproved / totalAssignments) * 100) : 0;

  const initials = (session.name || 'KH')
    .split(' ').map((w: string) => w[0]).join('').substring(0, 2).toUpperCase();

  const avatarSrc = profile?.avatar_url || session.avatar;

  const parsedMainRoles: string[] = profile?.main_roles
    ? JSON.parse(profile.main_roles)
    : [];

  const memberSince = profile?.created_at
    ? new Date(profile.created_at * 1000).toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '—';

  const roleColors: Record<string, string> = {
    RESEARCHER: 'text-blue-700   dark:text-blue-400   bg-blue-500/10   border-blue-500/20',
    PLANNER:    'text-amber-700  dark:text-amber-400  bg-amber-500/10  border-amber-500/20',
    DESIGNER:   'text-purple-700 dark:text-purple-400 bg-purple-500/10 border-purple-500/20',
    VIDEO_EDITOR: 'text-pink-700  dark:text-pink-400   bg-pink-500/10   border-pink-500/20',
    CREATOR:    'text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  };

  const statusMeta: Record<string, { label: string; color: string; bar: string }> = {
    ASSIGNED:           { label: 'Ditugaskan',        color: 'text-blue-600 dark:text-blue-400',       bar: 'bg-blue-500' },
    IN_PROGRESS:        { label: 'Sedang Dikerjakan', color: 'text-indigo-600 dark:text-indigo-400',   bar: 'bg-indigo-500' },
    SUBMITTED:          { label: 'Sudah Dikumpulkan', color: 'text-orange-600 dark:text-orange-400',   bar: 'bg-orange-500' },
    WAITING_REVIEW:     { label: 'Menunggu Review',   color: 'text-yellow-600 dark:text-yellow-400',   bar: 'bg-yellow-500' },
    REVISION_REQUESTED: { label: 'Perlu Revisi',      color: 'text-red-600 dark:text-red-400',         bar: 'bg-red-500' },
    RESUBMITTED:        { label: 'Dikumpulkan Ulang', color: 'text-indigo-500 dark:text-indigo-400',   bar: 'bg-indigo-400' },
    APPROVED:           { label: 'Disetujui',         color: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
    LOCKED:             { label: 'Terkunci / Final',  color: 'text-zinc-600 dark:text-zinc-400',       bar: 'bg-zinc-400' },
    PUBLISHED:          { label: 'Dipublikasikan',    color: 'text-purple-600 dark:text-purple-400',   bar: 'bg-purple-500' },
  };

  const BREAKDOWN_STATUSES = [
    'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'WAITING_REVIEW',
    'REVISION_REQUESTED', 'RESUBMITTED', 'APPROVED', 'LOCKED', 'PUBLISHED',
  ];

  const getDeadlineBadge = (deadline: number | null) => {
    if (!deadline) return null;
    const now = Date.now();
    const diffDays = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
    const dateStr = new Date(deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    if (diffDays < 0)  return <span className="text-[9px] font-bold text-red-500">⚠️ Terlambat</span>;
    if (diffDays === 0) return <span className="text-[9px] font-bold text-amber-500">⏳ Hari Ini</span>;
    if (diffDays <= 3) return <span className="text-[9px] font-bold text-yellow-500">⏱ H-{diffDays}</span>;
    return <span className="text-[9px] font-bold text-zinc-400">📅 {dateStr}</span>;
  };

  const card = 'bg-white dark:bg-[#09090b]/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
            My Profile
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Informasi akun dan ringkasan kontribusimu.</p>
        </div>
        <EditProfileButton
          initialData={{
            name: session.name,
            university: profile?.university || undefined,
            study_program: profile?.study_program || undefined,
            semester: profile?.semester || undefined,
            whatsapp_number: profile?.whatsapp_number || undefined,
            avatar_url: profile?.avatar_url || session.avatar,
            main_roles: parsedMainRoles,
            custom_role: profile?.custom_role || undefined,
            tools: profile?.tools || undefined,
            portfolio_url: profile?.portfolio_url || undefined,
          }}
        />
      </div>

      {/* ── TOP SECTION: Identity Card Full Width ── */}
      <div className={`${card} p-6`}>
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarSrc} alt={session.name}
              className="w-24 h-24 rounded-2xl border-2 border-zinc-200 dark:border-zinc-800 shadow object-cover shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-3xl font-black shadow shrink-0 uppercase select-none">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{session.name}</h2>
              {profile?.role_name && (
                <span className="text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15 px-2.5 py-0.5 rounded-full">
                  {profile.role_name}
                </span>
              )}
              {profile?.user_type && (
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                  profile.user_type === 'OJT'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/15'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                }`}>
                  {profile.user_type}
                </span>
              )}
            </div>

            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-2 flex-wrap">
              <span>{session.email}</span>
              {profile?.whatsapp_number && (
                <a
                  href={`https://wa.me/${profile.whatsapp_number.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-500/10 px-2 py-0.5 rounded-md"
                >
                  <span>💬 WA: {profile.whatsapp_number}</span>
                </a>
              )}
            </p>

            {/* Academic & University Details */}
            {(profile?.university || profile?.study_program || profile?.semester) && (
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mt-2 flex items-center gap-1.5 flex-wrap">
                <span>🎓</span>
                {[profile?.university, profile?.study_program, profile?.semester].filter(Boolean).join(' • ')}
              </p>
            )}

            {/* Main Roles Badges (Standard Order) */}
            {(parsedMainRoles.length > 0 || profile?.custom_role) && (
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {parsedMainRoles.map((r) => (
                  <span key={r} className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                    {r === 'RESEARCHER' ? '🔍 Researcher' : r === 'PLANNER' ? '🧠 Planner' : r === 'DESIGNER' ? '🎨 Designer' : r === 'VIDEO_EDITOR' ? '🎬 Video Editor' : r}
                  </span>
                ))}
                {profile?.custom_role && (
                  <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-lg border bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300">
                    ✨ {profile.custom_role}
                  </span>
                )}
              </div>
            )}

            {/* Tools & Portfolio */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
              {profile?.tools && (
                <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                  🧰 <strong className="text-zinc-700 dark:text-zinc-300">Tools:</strong> {profile.tools}
                </span>
              )}
              {profile?.portfolio_url && (
                <a
                  href={profile.portfolio_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 dark:text-purple-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  🔗 Portofolio / Drive ↗
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Steps', value: totalAssignments, color: 'text-zinc-700 dark:text-zinc-200' },
            { label: 'Disetujui',   value: totalApproved,    color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Berlangsung', value: totalInProgress,  color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Approval',    value: `${approvalRate}%`, color: 'text-purple-600 dark:text-purple-400' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CREATIVE SPARKS & TITLE BADGES ── */}
      <div className={`${card} p-6 border-purple-500/20 bg-gradient-to-br from-purple-500/[0.03] to-indigo-500/[0.03]`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h3 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest flex items-center gap-2">
              <span>✨ Creative Sparks & Title Badges</span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Akumulasi poin apresiasi kualitas karya dari mentor & koordinator.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-2xl shrink-0">
            <span className="text-xl">✨</span>
            <div>
              <p className="text-lg font-black text-purple-700 dark:text-purple-300 leading-none">{totalSparks} Sparks</p>
              <p className="text-[9px] text-purple-600/80 dark:text-purple-400/80 font-bold uppercase tracking-wider">Total Terkumpul</p>
            </div>
          </div>
        </div>

        {/* Dynamic Titles Row */}
        {titleBadges.length > 0 && (
          <div className="pt-4">
            <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-2.5">
              Gelar Keahlian Utama:
            </p>
            <div className="flex gap-3 flex-wrap">
              {titleBadges.map((tb) => (
                <div
                  key={tb.title}
                  className={`px-4 py-2 rounded-2xl border bg-gradient-to-r ${tb.color} flex items-center gap-2.5 shadow-sm`}
                >
                  <span className="text-xl">{tb.emoji}</span>
                  <div>
                    <p className="text-xs font-black tracking-wider leading-none">{tb.title}</p>
                    <p className="text-[9px] opacity-80 font-bold mt-0.5">{tb.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Sparks Breakdown (Standardized Order: Researcher -> Planner -> Designer -> Video Editor) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          {[
            { role: 'RESEARCHER', label: 'Researcher Sparks', emoji: '🔍', val: roleSparksMap.RESEARCHER, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/5 border-blue-500/15' },
            { role: 'PLANNER', label: 'Planner Sparks', emoji: '🧠', val: roleSparksMap.PLANNER, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/5 border-amber-500/15' },
            { role: 'DESIGNER', label: 'Designer Sparks', emoji: '🎨', val: roleSparksMap.DESIGNER, color: 'text-purple-600 dark:text-purple-400 bg-purple-500/5 border-purple-500/15' },
            { role: 'VIDEO_EDITOR', label: 'Video Editor Sparks', emoji: '🎬', val: roleSparksMap.VIDEO_EDITOR, color: 'text-pink-600 dark:text-pink-400 bg-pink-500/5 border-pink-500/15' },
          ].map((item) => (
            <div key={item.role} className={`p-3.5 rounded-2xl border ${item.color} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{item.emoji}</span>
                <span className="text-xs font-bold">{item.label}</span>
              </div>
              <span className="text-sm font-black font-mono">{item.val} ✨</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── METRICS ROW ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Perlu Revisi',    value: totalRevision,  icon: '🔄', colorVal: 'text-red-600 dark:text-red-400',       border: 'border-red-200 dark:border-red-900/40',     bg: 'bg-red-500/5' },
          { label: 'Workspace',       value: workspaceCount, icon: '🗂',  colorVal: 'text-blue-600 dark:text-blue-400',      border: 'border-blue-200 dark:border-blue-900/40',   bg: 'bg-blue-500/5' },
          { label: 'Proyek Terlibat', value: projectCount,   icon: '📁', colorVal: 'text-amber-600 dark:text-amber-400',    border: 'border-amber-200 dark:border-amber-900/40', bg: 'bg-amber-500/5' },
          { label: 'Total Disetujui', value: totalApproved,  icon: '✅', colorVal: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-900/40', bg: 'bg-emerald-500/5' },
        ].map((c) => (
          <div key={c.label} className={`${card} ${c.bg} ${c.border} p-5 flex flex-col gap-1.5`}>
            <span className="text-2xl">{c.icon}</span>
            <p className={`text-3xl font-black ${c.colorVal}`}>{c.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{c.label}</p>
          </div>
        ))}
      </div>

      {/* ── BREAKDOWN GRID ── */}
      {(roleStats.length > 0 || totalAssignments > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Role Breakdown */}
          {roleStats.length > 0 && (
            <div className={`${card} p-5`}>
              <h3 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Role yang Pernah Dikerjakan
              </h3>
              <div className="space-y-3">
                {roleStats.map((r) => {
                  const pct = totalAssignments > 0 ? Math.round((Number(r.count) / totalAssignments) * 100) : 0;
                  const colorCls = roleColors[r.assignment_role] ?? 'text-zinc-600 bg-zinc-100 border-zinc-200';
                  return (
                    <div key={r.assignment_role} className="flex items-center gap-3">
                      <span className={`text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-lg border shrink-0 ${colorCls}`}>
                        {r.assignment_role}
                      </span>
                      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-black text-zinc-500 w-5 text-right shrink-0">{r.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status Breakdown */}
          {totalAssignments > 0 && (
            <div className={`${card} p-5`}>
              <h3 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Status Assignment
              </h3>
              <div className="space-y-3">
                {BREAKDOWN_STATUSES.map((status) => {
                  const count = getCount([status]);
                  if (count === 0) return null;
                  const pct  = Math.round((count / totalAssignments) * 100);
                  const meta = statusMeta[status];
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className={`text-[9px] font-bold w-[128px] shrink-0 truncate ${meta?.color ?? 'text-zinc-500'}`}>
                        {meta?.label ?? status}
                      </span>
                      <div className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full transition-all duration-700 ${meta?.bar ?? 'bg-zinc-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-black text-zinc-500 w-5 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECENT ACTIVITY ── */}
      {recentActivity.length > 0 && (
        <div className={`${card} p-5`}>
          <h3 className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
            Aktivitas Terbaru
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentActivity.map((a) => {
              const meta      = statusMeta[a.status];
              const roleCls   = roleColors[a.assignment_role] ?? 'text-zinc-500 bg-zinc-100 border-zinc-200';
              const dateStr   = new Date(a.created_at * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
              return (
                <div
                  key={a.assignment_id}
                  className="flex items-start justify-between gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/60 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{a.task_title}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                      {[a.project_name, a.workspace_name].filter(Boolean).join(' › ')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${roleCls}`}>
                        {a.assignment_role}
                      </span>
                      {meta && (
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${meta.color} border-current/10`}>
                          {meta.label}
                        </span>
                      )}
                      {getDeadlineBadge(a.deadline)}
                    </div>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono shrink-0">{dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
