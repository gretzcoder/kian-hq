'use server';

import { getDB } from '@/db/client';

interface LogEventParams {
  entityType: 'brief' | 'project' | 'workspace' | 'task' | 'task_assignment';
  entityId: string;
  fromStatus: string | null;
  toStatus: string;
  triggeredBy: string;
  note?: string;
}

/**
 * Appends a workflow event to the audit log.
 * This is the single source of truth for all state transitions in KIAN HQ.
 * Also powers the Timeline module.
 */
export async function logWorkflowEvent(params: LogEventParams): Promise<void> {
  const { entityType, entityId, fromStatus, toStatus, triggeredBy, note } = params;

  try {
    const db = await getDB();
    const eventId = `evt_${crypto.randomUUID().replace(/-/g, '')}`;

    await db
      .prepare(`
        INSERT INTO workflow_events
          (id, entity_type, entity_id, from_status, to_status, triggered_by, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        eventId,
        entityType,
        entityId,
        fromStatus ?? null,
        toStatus,
        triggeredBy,
        note ?? null,
      )
      .run();
  } catch (err) {
    // Non-fatal: don't throw, just log. Events failing should not break the main action.
    console.error('logWorkflowEvent failed:', err);
  }
}

/**
 * Fetches the full event history for a specific entity.
 * Used by the Timeline module.
 */
export async function getEntityEvents(
  entityType: string,
  entityId: string,
) {
  const db = await getDB();
  const { results } = await db
    .prepare(`
      SELECT
        we.id, we.entity_type, we.entity_id,
        we.from_status, we.to_status, we.note, we.created_at,
        u.name AS triggered_by_name
      FROM workflow_events we
      LEFT JOIN users u ON we.triggered_by = u.id
      WHERE we.entity_type = ? AND we.entity_id = ?
      ORDER BY we.created_at ASC
    `)
    .bind(entityType, entityId)
    .all();

  return results;
}
