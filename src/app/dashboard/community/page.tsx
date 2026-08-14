import { getSession } from '@/modules/auth/session';
import { redirect } from 'next/navigation';
import { getCommunityChannels, getCommunityMembers } from '@/modules/community/communityActions';
import CommunityChatView from '@/modules/community/components/CommunityChatView';

export const metadata = {
  title: 'Community Chat | KIAN HQ',
  description: 'Ruang obrolan komunitas untuk kategori kerjaan dan umum',
};

interface PageProps {
  searchParams: Promise<{ channelId?: string }>;
}

export default async function CommunityPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.userId) {
    redirect('/login');
  }

  const resolvedParams = await searchParams;
  const { workChannels, generalChannels, categories, defaultChannelId, canManage } = await getCommunityChannels();
  const { onlineRoleGroups, offlineMembers, totalOnline, totalOffline } = await getCommunityMembers();

  const selectedChannelId = resolvedParams.channelId || defaultChannelId || undefined;

  return (
    <div className="sm:space-y-4 max-w-7xl mx-auto pb-0 sm:pb-6 w-full min-w-0 max-w-full overflow-x-hidden">
      <CommunityChatView
        initialWorkChannels={workChannels}
        initialGeneralChannels={generalChannels}
        initialCategories={categories}
        initialDefaultChannelId={defaultChannelId}
        initialChannelId={selectedChannelId}
        canManageCommunity={canManage}
        initialOnlineRoleGroups={onlineRoleGroups}
        initialOfflineMembers={offlineMembers}
        initialTotalOnline={totalOnline}
        initialTotalOffline={totalOffline}
        currentUserId={session.userId}
      />
    </div>
  );
}

export const dynamic = 'force-dynamic';
