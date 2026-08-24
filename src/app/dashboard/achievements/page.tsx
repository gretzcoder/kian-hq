import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getAchievementHistoryAction } from '@/modules/achievements/actions';
import { AchievementHistoryView } from './components/AchievementHistoryView';

export const metadata = {
  title: 'Achievement History | KIAN HQ',
  description: 'Riwayat pencapaian gelar juara & gelar keahlian utama seluruh anggota dari Leaderboard.',
};

export default async function AchievementHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; userId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/');

  const params = await searchParams;
  const initialCategory = params.category || 'ALL';
  const userIdFilter = params.userId || '';

  const initialData = await getAchievementHistoryAction(initialCategory, userIdFilter);

  return <AchievementHistoryView initialData={initialData} initialCategory={initialCategory} />;
}
