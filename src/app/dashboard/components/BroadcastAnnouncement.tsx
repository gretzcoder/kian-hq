interface BroadcastAnnouncementProps {
  onPostAnnouncement: (formData: FormData) => Promise<void>;
}

export default function BroadcastAnnouncement({ onPostAnnouncement }: BroadcastAnnouncementProps) {
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#09090b]/40 rounded-3xl p-6 shadow-sm">
      <h3 className="text-lg font-bold mb-1 text-zinc-900 dark:text-zinc-100">Broadcast Update</h3>
      <p className="text-zinc-500 dark:text-zinc-500 text-xs mb-6">
        Send an announcement to all team members.
      </p>
      <form action={onPostAnnouncement} className="space-y-4">
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Title
          </label>
          <input
            type="text"
            name="title"
            required
            placeholder="e.g. Design Guidelines Update"
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all duration-200"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-2">
            Message
          </label>
          <textarea
            name="content"
            rows={4}
            required
            placeholder="Type details or links..."
            className="w-full bg-zinc-100/50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 focus:border-purple-500 dark:focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 text-zinc-900 dark:text-zinc-100 text-sm rounded-xl px-4 py-3 focus:outline-none transition-all resize-none duration-200"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(147,51,234,0.15)] hover:shadow-[0_4px_20px_rgba(147,51,234,0.25)] active:scale-[0.98] mt-2"
        >
          Broadcast Announcement
        </button>
      </form>
    </div>
  );
}
