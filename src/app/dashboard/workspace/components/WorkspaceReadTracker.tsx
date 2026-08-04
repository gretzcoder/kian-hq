'use client';

import { useEffect } from 'react';
import { markWorkspaceAsRead } from '@/modules/workspaces/workspaceReadState';

interface Props {
  wsId: string;
}

/**
 * Rendered at the top of a workspace detail page.
 * Marks only THIS workspace as read — preserves badges on all other workspaces.
 */
export default function WorkspaceReadTracker({ wsId }: Props) {
  useEffect(() => {
    markWorkspaceAsRead(wsId);
  }, [wsId]);

  return null;
}
