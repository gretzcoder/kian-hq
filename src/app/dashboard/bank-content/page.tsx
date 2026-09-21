import { getSession } from '@/modules/auth/session';
import { canManageBankContent, getBankContentFeed } from '@/modules/bankContent/bankContentActions';
import BankContentFeedClient from './components/BankContentFeedClient';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Bank Content | KIAN HQ',
  description: 'Galeri dan Repository Seluruh Konten Design dan Video Submit User',
};

export default async function BankContentPage() {
  const session = await getSession();
  if (!session) {
    redirect('/auth/login');
  }

  const canManage = await canManageBankContent(session.userId);
  const initialFeed = await getBankContentFeed({
    generalCategory: 'ALL',
    innerFilter: 'ALL',
    sortByDate: 'desc',
  });

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <BankContentFeedClient
        sessionUserId={session.userId}
        canManage={canManage}
        initialFeed={initialFeed}
      />
    </div>
  );
}
