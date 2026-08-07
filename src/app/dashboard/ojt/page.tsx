import { getSession } from '@/modules/auth/session';
import { getDB } from '@/db/client';
import { getSessionContext } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import UserAvatar from '@/components/ui/UserAvatar';

interface OJTUserRow {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: number;
  university: string | null;
  student_id_number: string | null;
  study_program: string | null;
  semester: string | null;
  whatsapp_number: string | null;
  avatar_url: string | null;
  main_roles: string | null;
  custom_role: string | null;
  tools: string | null;
  portfolio_url: string | null;
  role_name: string | null;
  completed_tasks: number;
  in_progress_tasks: number;
  total_sparks: number;
  sparks_score: number | null;
}

export default async function OJTDirectoryPage() {
  const session = await getSession();
  if (!session) redirect('/');

  // 1. Strict Security Gate: Require VIEW_OJT_DATA or ADMIN_SYSTEM
  const ctx = await getSessionContext(session.userId);
  if (!ctx.can('VIEW_OJT_DATA') && !ctx.can('ADMIN_SYSTEM')) {
    redirect('/dashboard');
  }

  const db = await getDB();

  // 2. Fetch all OJT users with their full profile metadata & task statistics
  const { results: rawOJTUsers } = await db
    .prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.status, 
        u.created_at,
        u.university,
        u.student_id_number, 
        u.study_program, 
        u.semester, 
        u.whatsapp_number, 
        u.avatar_url, 
        u.main_roles, 
        u.custom_role, 
        u.tools, 
        u.portfolio_url,
        r.name as role_name,
        (SELECT COUNT(*) FROM task_assignments ta WHERE ta.user_id = u.id AND ta.status = 'APPROVED') as completed_tasks,
        (SELECT COUNT(*) FROM task_assignments ta WHERE ta.user_id = u.id AND ta.status IN ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'REVISION')) as in_progress_tasks,
        (SELECT COALESCE(SUM(COALESCE(ta.sparks, 8)), 0) FROM task_assignments ta WHERE ta.user_id = u.id AND ta.status = 'APPROVED') as total_sparks,
        (SELECT COALESCE(SUM(COALESCE(ta.sparks, 8)), 0) FROM task_assignments ta WHERE ta.user_id = u.id AND ta.status = 'APPROVED') as sparks_score
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.user_type = 'OJT'
      ORDER BY u.created_at DESC
    `)
    .all();

  const ojtUsers = rawOJTUsers as unknown as OJTUserRow[];

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              OJT Directory
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent mt-1">
            Data Peserta OJT (On-the-Job Training)
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
            Direktori lengkap profil, latar belakang akademik, keahlian role, dan statistik kerja seluruh anggota OJT.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-2xl shadow-sm">
            Total <strong className="text-purple-600 dark:text-purple-400 font-black">{ojtUsers.length}</strong> Peserta OJT
          </span>
        </div>
      </div>

      {ojtUsers.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-3xl p-16 text-center">
          <p className="text-4xl mb-4">🎓</p>
          <p className="text-zinc-500 dark:text-zinc-400 font-bold">Belum ada data peserta OJT.</p>
          <p className="text-zinc-400 text-xs mt-1">Pengguna dengan klasifikasi OJT akan tampil secara otomatis di sini.</p>
        </div>
      ) : (
        /* Directory Table (Desktop) / Cards List (Mobile) */
        <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 rounded-2xl overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/40 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Peserta OJT</th>
                  <th className="px-6 py-4">Institusi & Studi</th>
                  <th className="px-6 py-4">Spesialisasi & Tools</th>
                  <th className="px-6 py-4">Kontak & Portofolio</th>
                  <th className="px-6 py-4 text-center">Sparks Poin</th>
                  <th className="px-6 py-4 text-center">Statistik Task</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/50 text-sm">
                {ojtUsers.map((user) => {
                  let rolesList: string[] = [];
                  if (user.main_roles) {
                    try {
                      rolesList = JSON.parse(user.main_roles);
                    } catch {
                      rolesList = user.main_roles.split(',').map((r) => r.trim());
                    }
                  }

                  let toolsList: string[] = [];
                  if (user.tools) {
                    try {
                      toolsList = JSON.parse(user.tools);
                    } catch {
                      toolsList = user.tools.split(',').map((t) => t.trim());
                    }
                  }

                  return (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/20 transition-colors">
                      {/* Name & Avatar */}
                      <td className="px-6 py-4">
                        <Link href={`/dashboard/profile?userId=${user.id}`} className="flex items-center gap-3 group w-fit">
                          <UserAvatar src={user.avatar_url} name={user.name} size="md" />
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline">
                              {user.name}
                            </p>
                            <p className="text-xs text-zinc-400 font-medium">{user.email}</p>
                          </div>
                        </Link>
                      </td>

                      {/* University & Program */}
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                          {user.university || '-'}
                        </p>
                        {user.student_id_number && (
                          <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                            NIM: {user.student_id_number}
                          </p>
                        )}
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {user.study_program ? `${user.study_program} ${user.semester ? `(Sem ${user.semester})` : ''}` : '-'}
                        </p>
                      </td>

                      {/* Main Roles & Tools */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 max-w-[200px]">
                          {rolesList.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {rolesList.map((r, i) => (
                                <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15">
                                  {r}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400">{user.custom_role || '-'}</span>
                          )}

                          {toolsList.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {toolsList.map((t, i) => (
                                <span key={i} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Contact & Portfolio */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-xs">
                          {user.whatsapp_number && (
                            <a
                              href={`https://wa.me/${user.whatsapp_number.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                            >
                              📱 {user.whatsapp_number}
                            </a>
                          )}
                          {user.portfolio_url && (
                            <div>
                              <a
                                href={user.portfolio_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 font-bold hover:underline"
                              >
                                🔗 Portofolio &rarr;
                              </a>
                            </div>
                          )}
                          {!user.whatsapp_number && !user.portfolio_url && (
                            <span className="text-zinc-400 text-xs">-</span>
                          )}
                        </div>
                      </td>

                      {/* Sparks Poin */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-2xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 shadow-sm">
                          ✨ {user.total_sparks || 0} Poin
                        </span>
                      </td>

                      {/* Task Stats */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-2xl text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="Tasks Approved">
                            ✓ {user.completed_tasks}
                          </span>
                          <span className="text-zinc-300 dark:text-zinc-700">|</span>
                          <span className="text-blue-600 dark:text-blue-400 font-bold" title="Tasks In Progress">
                            ⚡ {user.in_progress_tasks}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                          user.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                        }`}>
                          {user.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Responsive Cards View */}
          <div className="block md:hidden divide-y divide-zinc-200 dark:divide-zinc-800">
            {ojtUsers.map((user) => {
              let rolesList: string[] = [];
              if (user.main_roles) {
                try {
                  rolesList = JSON.parse(user.main_roles);
                } catch {
                  rolesList = user.main_roles.split(',').map((r) => r.trim());
                }
              }

              let toolsList: string[] = [];
              if (user.tools) {
                try {
                  toolsList = JSON.parse(user.tools);
                } catch {
                  toolsList = user.tools.split(',').map((t) => t.trim());
                }
              }

              return (
                <div key={user.id} className="p-4 space-y-3 bg-white dark:bg-zinc-900/40">
                  {/* Top: Avatar, Name & Sparks */}
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/dashboard/profile?userId=${user.id}`} className="flex items-center gap-3 min-w-0 flex-1 group">
                      <UserAvatar src={user.avatar_url} name={user.name} size="md" square />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 group-hover:underline">
                          {user.name}
                        </p>
                        <p className="text-xs text-zinc-400 truncate">{user.email}</p>
                      </div>
                    </Link>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/20 shrink-0">
                      ⚡ {(user.sparks_score || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Campus Info */}
                  {(user.university || user.study_program) && (
                    <div className="bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 text-xs space-y-0.5">
                      <p className="font-bold text-zinc-800 dark:text-zinc-200">
                        🎓 {user.university || 'Universitas Belum Diisi'}
                      </p>
                      <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                        {user.study_program ? `${user.study_program} ${user.semester ? `(Sem ${user.semester})` : ''}` : ''}
                        {user.student_id_number && <span className="font-mono text-purple-600 dark:text-purple-400 font-bold ml-1.5">• NIM: {user.student_id_number}</span>}
                      </p>
                    </div>
                  )}

                  {/* Roles & Tools */}
                  {(rolesList.length > 0 || toolsList.length > 0 || user.custom_role) && (
                    <div className="space-y-1.5 pt-1">
                      {rolesList.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rolesList.map((r, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/15">
                              {r}
                            </span>
                          ))}
                        </div>
                      ) : user.custom_role ? (
                        <span className="text-xs text-zinc-500 font-medium">{user.custom_role}</span>
                      ) : null}

                      {toolsList.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {toolsList.map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-2">
                      {user.whatsapp_number && (
                        <a
                          href={`https://wa.me/${user.whatsapp_number.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all flex items-center gap-1"
                        >
                          📱 WhatsApp
                        </a>
                      )}
                      {user.portfolio_url && (
                        <a
                          href={user.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1"
                        >
                          🔗 Portofolio
                        </a>
                      )}
                    </div>
                    <Link
                      href={`/dashboard/profile?userId=${user.id}`}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-purple-600 hover:text-white transition-all ml-auto"
                    >
                      Lihat Profil &rarr;
                    </Link>
                  </div>
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
