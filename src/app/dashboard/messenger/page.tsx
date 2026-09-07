import React, { Suspense } from 'react';
import { MessengerWorkspaceView } from './MessengerWorkspaceView';

export const dynamic = 'force-dynamic';

export default function MessengerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-zinc-400 font-bold animate-pulse">Memuat Messenger...</div>}>
      <MessengerWorkspaceView />
    </Suspense>
  );
}
