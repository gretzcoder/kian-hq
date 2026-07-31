import Link from 'next/link';

interface MiniLeaderboardUser {
  rank: number;
  userId: string;
  userName: string;
  totalSparks: number;
  primaryRole: string;
}

interface DashboardMiniLeaderboardProps {
  topUsers: MiniLeaderboardUser[];
  currentUserId: string;
}

export default function DashboardMiniLeaderboard({
  topUsers,
  currentUserId,
}: DashboardMiniLeaderboardProps) {
  const myData = topUsers.find((u) => u.userId === currentUserId);

  return (
    <div className="border border-purple-500/20 dark:border-purple-500/20 bg-gradient-to-br from-purple-500/[0.04] to-indigo-500/[0.04] rounded-3xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🏆</span>
          <h3 className="text-xs font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
            Top Champions
          </h3>
        </div>
        <Link
          href="/dashboard/leaderboard"
          className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
        >
          Lihat Semua ↗
        </Link>
      </div>

      {topUsers.length === 0 ? (
        <p className="text-xs text-zinc-500 text-center py-2">Belum ada data leaderboard.</p>
      ) : (
        <div className="space-y-2.5">
          {topUsers.slice(0, 3).map((user) => {
            const isMe = user.userId === currentUserId;
            const medals = ['🥇', '🥈', '🥉'];
            const medal = medals[user.rank - 1] || `#${user.rank}`;

            return (
              <div
                key={user.userId}
                className={`p-3 rounded-2xl border flex items-center justify-between transition-all ${
                  isMe
                    ? 'bg-purple-500/15 border-purple-500/30'
                    : 'bg-white/60 dark:bg-zinc-900/60 border-zinc-200/60 dark:border-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg shrink-0">{medal}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                      <span>{user.userName}</span>
                      {isMe && (
                        <span className="text-[8px] bg-purple-600 text-white font-black px-1.5 py-0.2 rounded-full shrink-0">
                          Kamu
                        </span>
                      )}
                    </p>
                    <p className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono uppercase">
                      {user.primaryRole || 'Member'}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-500 font-mono shrink-0 ml-2">
                  {user.totalSparks} ✨
                </span>
              </div>
            );
          })}
        </div>
      )}

      {myData && myData.rank > 3 && (
        <div className="pt-2 border-t border-purple-500/15 flex items-center justify-between text-xs">
          <span className="text-zinc-500 dark:text-zinc-400 font-medium">Peringkat Kamu:</span>
          <span className="font-black text-purple-600 dark:text-purple-400 font-mono">
            #{myData.rank} ({myData.totalSparks} ✨)
          </span>
        </div>
      )}
    </div>
  );
}
