'use server';

import { getSession } from '@/modules/auth/session';
import { checkPermission } from '@/modules/roles/rbac';
import { getDB } from '@/db/client';
import { revalidatePath } from 'next/cache';

/**
 * Server Action to create or update a project's creative Content Brief.
 * Protected by 'CREATE' / 'UPDATE' permissions.
 */
export async function saveContentBrief(projectId: string, formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: No active session');
  }

  // 1. Enforce RBAC permission check (requires UPDATE permission to modify briefs)
  await checkPermission(session.userId, 'UPDATE');

  const audience = formData.get('audience') as string;
  const objectives = formData.get('objectives') as string;
  const keyMessages = formData.get('keyMessages') as string;
  const visualStyle = formData.get('visualStyle') as string;

  const db = await getDB();

  try {
    // 2. Check if a brief already exists for this project
    const existing = await db
      .prepare('SELECT id FROM content_briefs WHERE project_id = ?')
      .bind(projectId)
      .first() as { id: string } | null;

    if (existing) {
      // Update existing brief
      await db
        .prepare(
          'UPDATE content_briefs SET audience = ?, objectives = ?, key_messages = ?, visual_style = ? WHERE project_id = ?'
        )
        .bind(audience || null, objectives || null, keyMessages || null, visualStyle || null, projectId)
        .run();
    } else {
      // Insert a new brief
      const briefId = `brief_${crypto.randomUUID().replace(/-/g, '')}`;
      await db
        .prepare(
          'INSERT INTO content_briefs (id, project_id, audience, objectives, key_messages, visual_style, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          briefId,
          projectId,
          audience || null,
          objectives || null,
          keyMessages || null,
          visualStyle || null,
          session.userId
        )
        .run();
    }

    revalidatePath(`/dashboard/projects/${projectId}`);

    return { success: true };
  } catch (error: any) {
    console.error('saveContentBrief Server Action failed:', error);
    return { success: false, error: error.message || 'Failed to save content brief.' };
  }
}
