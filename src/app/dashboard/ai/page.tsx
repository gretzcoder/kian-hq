import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import AIChat from '@/modules/ai-assistant/components/AIChat';

export default async function AIAssistantPage() {
  const session = await getSession();
  if (!session) redirect('/');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-600 dark:from-white dark:to-zinc-400 bg-clip-text text-transparent">
          AI Operating Assistant
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Query system metadata, analyze deadlines, retrieve guidelines, and context-audit your creative workflows.
        </p>
      </div>

      {/* Interactive Chat Console */}
      <AIChat />
    </div>
  );
}

export const dynamic = 'force-dynamic';
