interface AnnouncementRow {
  id: string;
  title: string;
  content: string;
  author_name: string | null;
  created_at: number;
}

interface DashboardAnnouncementsProps {
  announcements: AnnouncementRow[];
  canAnnounce: boolean;
  onPostAnnouncement?: (formData: FormData) => Promise<void>;
}

export default function DashboardAnnouncements({
  announcements,
  canAnnounce,
  onPostAnnouncement,
}: DashboardAnnouncementsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Announcements
      </h2>
      {announcements.length === 0 ? (
        <div className="border border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-transparent rounded-2xl p-12 text-center text-zinc-500 text-sm">
          No announcements yet. Coordinators will broadcast updates here.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className="border border-zinc-200/80 dark:border-zinc-800/60 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm border-l-4 border-l-purple-500 dark:border-l-purple-500"
            >
              <div className="flex justify-between items-center gap-4 mb-3 pb-3 border-b border-zinc-100 dark:border-zinc-900">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-200">
                  {ann.author_name || 'System Operator'}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {new Date(ann.created_at * 1000).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 mb-2">
                {ann.title}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {ann.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
