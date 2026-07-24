'use client';

interface WorkflowEvent {
  id:           string;
  entity_type:  'brief' | 'project' | 'workspace' | 'task' | 'task_assignment';
  entity_id:    string;
  from_status:  string | null;
  to_status:    string;
  note:         string | null;
  created_at:   number; // Unix timestamp in seconds
  user_name:    string | null;
}

const entityConfig: Record<string, { label: string; icon: string; bg: string; text: string; border: string }> = {
  brief: {
    label: 'Content Brief',
    icon: '📝',
    bg: 'bg-yellow-500/5',
    text: 'text-yellow-700 dark:text-yellow-400',
    border: 'border-yellow-500/20',
  },
  project: {
    label: 'Project',
    icon: '📁',
    bg: 'bg-blue-500/5',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
  },
  workspace: {
    label: 'Workspace',
    icon: '🏠',
    bg: 'bg-purple-500/5',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-500/20',
  },
  task: {
    label: 'Task',
    icon: '✅',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-500/20',
  },
  task_assignment: {
    label: 'Assignment',
    icon: '👤',
    bg: 'bg-pink-500/5',
    text: 'text-pink-700 dark:text-pink-400',
    border: 'border-pink-500/20',
  },
};

export default function ProjectTimeline({ events }: { events: WorkflowEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 text-sm bg-white dark:bg-transparent">
        No workflow events recorded yet. Perform actions across workspaces and tasks to build this campaign log dynamically.
      </div>
    );
  }

  // Format status names cleanly
  const formatStatus = (s: string) => {
    return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Build clean descriptive sentence per event
  const getEventTitle = (we: WorkflowEvent) => {
    const actor = we.user_name || 'System';
    const typeLabel = entityConfig[we.entity_type]?.label || 'Entity';

    if (!we.from_status) {
      if (we.to_status === 'DRAFT' && we.entity_type === 'brief') {
        return `${actor} initialized a new Content Brief`;
      }
      return `${actor} created a new ${typeLabel.toLowerCase()}`;
    }

    return `${actor} updated ${typeLabel.toLowerCase()} status from "${formatStatus(we.from_status)}" to "${formatStatus(we.to_status)}"`;
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800 mb-8">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-black">
          Dynamic Campaign Timeline
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
          Chronological workflow log of all decisions, tasks, and status handoffs in this project.
        </p>
      </div>

      <div className="relative pl-8 border-l border-zinc-200 dark:border-zinc-800 space-y-8 ml-3 py-1">
        {events.map((we) => {
          const cfg = entityConfig[we.entity_type] || {
            label: 'Activity',
            icon: '⚡',
            bg: 'bg-zinc-100 dark:bg-zinc-800',
            text: 'text-zinc-500 dark:text-zinc-400',
            border: 'border-zinc-200 dark:border-zinc-700',
          };

          return (
            <div key={we.id} className="relative">
              {/* Vertical timeline node circle */}
              <div className={`absolute left-[-42px] top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-black bg-zinc-50 dark:bg-[#030303] z-10 transition-colors duration-300 ${cfg.text} ${cfg.border}`}>
                {cfg.icon}
              </div>

              {/* Card container */}
              <div className="border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#09090b]/40 rounded-3xl p-5 hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all duration-300 hover:shadow-md">
                <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                  <span className={`text-[9px] px-2.5 py-0.5 rounded-full border font-black uppercase tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono font-medium">
                    {new Date(we.created_at * 1000).toLocaleString()}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-snug mt-1.5">
                  {getEventTitle(we)}
                </h4>

                {we.note && (
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-900 rounded-xl p-3 mt-3 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-medium">
                    &quot;{we.note}&quot;
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
