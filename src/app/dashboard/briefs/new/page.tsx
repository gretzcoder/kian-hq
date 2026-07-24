import { getSession } from '@/modules/auth/session';
import { getSessionContext } from '@/modules/roles/rbac';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CreateBriefForm from '../components/CreateBriefForm';

export default async function NewBriefPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const ctx = await getSessionContext(session.userId);
  if (!ctx.can('CREATE_BRIEF')) redirect('/dashboard');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
        <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Dashboard
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">›</span>
        <Link href="/dashboard/briefs" className="hover:text-zinc-900 dark:hover:text-white transition-colors">
          Briefs
        </Link>
        <span className="text-zinc-300 dark:text-zinc-700">›</span>
        <span className="text-zinc-900 dark:text-white">New Content Brief</span>
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          Create Content Brief
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Draft a new campaign concept. It will start as a DRAFT and can be edited until you submit it.
        </p>
      </div>

      <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 md:p-8 shadow-sm">
        <CreateBriefForm />
      </div>
    </div>
  );
}
