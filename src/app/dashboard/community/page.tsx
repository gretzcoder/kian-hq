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
  const { workChannels, generalChannels } = await getCommunityChannels();
  const { onlineRoleGroups, offlineMembers, totalOnline, totalOffline } = await getCommunityMembers();

  return (
    <div className="sm:space-y-4 max-w-7xl mx-auto pb-0 sm:pb-6 w-full min-w-0">
      <CommunityChatView
        initialWorkChannels={workChannels}
        initialGeneralChannels={generalChannels}
        initialChannelId={resolvedParams.channelId}
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
