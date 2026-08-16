import { getDB } from '@/db/client';

export interface UserSparksSummary {
  userId: string;
  totalSparks: number;
  taskSparks: number;
  assessmentSparks: number;
  appreciationSparks: number;
  resetSparks: number;
  restoredSparks: number;
  tasksCompleted: number;
  assessmentsCount: number;
  appreciationCount: number;
  roleSparksMap: Record<string, number>;
}

/**
 * Calculates realtime Sparks summary for a specific user using standardized rules:
 * - Task Assignments: Base * Role Multiplier (2x for Designer/Editor) * Quality Multiplier (1.21x / 1.10x)
 * - Mentor Assessments: COALESCE(sparks, 0)
 * - Adjustments: APPRECIATION (+), RESET (-), RESTORE (+)
 * - Total Sparks: Math.max(0, net sum)
 */
export async function getUserSparksSummary(targetUserId: string): Promise<UserSparksSummary> {
  const db = await getDB();

  // 0. Fetch category multipliers
  const { results: settingsRows } = await db
    .prepare("SELECT key, value FROM system_settings WHERE key IN ('category_multiplier_design', 'category_multiplier_video')")
    .all();

  let designMultiplier = 1.0;
  let videoMultiplier = 1.0;
  for (const row of (settingsRows || []) as any[]) {
    if (row.key === 'category_multiplier_design') designMultiplier = Number(row.value) || 1.0;
    if (row.key === 'category_multiplier_video') videoMultiplier = Number(row.value) || 1.0;
  }

  // 1. Task Assignments
  const { results: taRows } = await db
    .prepare(`
      SELECT ta.id, ta.sparks, ta.assignment_role AS role,
             t.task_type, t.title AS taskTitle, COALESCE(t.sparks_multiplier, 1.0) AS customTaskMultiplier,
             CASE WHEN (ta.revision_note IS NULL OR ta.revision_note = '') THEN 1 ELSE 0 END AS isZeroRev,
             CASE WHEN (ta.deadline IS NULL OR ta.reviewed_at <= ta.deadline) THEN 1 ELSE 0 END AS isOnTime
      FROM task_assignments ta
      JOIN tasks t ON ta.task_id = t.id
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      WHERE ta.user_id = ? AND ta.status = 'APPROVED' AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
    `)
    .bind(targetUserId)
    .all();

  // 2. Mentor Assessment Briefs
  const { results: tRows } = await db
    .prepare(`
      SELECT t.id, COALESCE(t.sparks, 0) AS sparks
      FROM tasks t
      LEFT JOIN workspaces ws ON t.workspace_id = ws.id
      WHERE t.created_by = ? AND t.task_type = 'ASSESSMENT' AND t.status = 'APPROVED' AND t.sparks IS NOT NULL AND t.status != 'DELETED' AND (ws.id IS NULL OR ws.deleted_at IS NULL)
    `)
    .bind(targetUserId)
    .all();

  // 3. Adjustments (APPRECIATION, RESET, RESTORE)
  const { results: saRows } = await db
    .prepare(`
      SELECT sa.type, sa.sparks
      FROM sparks_adjustments sa
      WHERE sa.user_id = ?
    `)
    .bind(targetUserId)
    .all();

  let taskSparks = 0;
  let tasksCompleted = 0;
  let assessmentSparks = 0;
  let assessmentsCount = 0;
  let appreciationSparks = 0;
  let appreciationCount = 0;
  let resetSparks = 0;
  let restoredSparks = 0;

  const roleSparksMap: Record<string, number> = {
    RESEARCHER: 0,
    PLANNER: 0,
    DESIGNER: 0,
    VIDEO_EDITOR: 0,
    CREATOR: 0,
    MENTOR: 0,
  };

  for (const r of taRows as any[]) {
    tasksCompleted += 1;
    const raw = Number(r.sparks) || 8;
    const customTaskMult = Number(r.customTaskMultiplier) || 1.0;
    const isDesign = r.role === 'DESIGNER' || r.task_type === 'DESIGN' || (r.taskTitle && r.taskTitle.toUpperCase().includes('DESIGN'));
    const isVideo = r.role === 'VIDEO_EDITOR' || r.task_type === 'VIDEO' || (r.taskTitle && r.taskTitle.toUpperCase().includes('VIDEO'));

    const catMult = isDesign ? designMultiplier : isVideo ? videoMultiplier : 1.0;
    const effectiveTaskMult = customTaskMult !== 1.0 ? customTaskMult : catMult;

    const roleMult = ['DESIGNER', 'VIDEO_EDITOR'].includes(r.role) ? 2 : 1;
    let qualMult = 1.0;
    if (r.isZeroRev && r.isOnTime) qualMult = 1.21;
    else if (r.isZeroRev || r.isOnTime) qualMult = 1.10;

    const baseFormulaSparks = Math.round(raw * roleMult * qualMult);
    const weighted = Math.round(baseFormulaSparks * effectiveTaskMult);
    taskSparks += weighted;
    const roleKey = r.role || 'CREATOR';
    roleSparksMap[roleKey] = (roleSparksMap[roleKey] || 0) + weighted;
  }

  for (const r of tRows as any[]) {
    assessmentsCount += 1;
    const val = Number(r.sparks) || 0;
    assessmentSparks += val;
    roleSparksMap['MENTOR'] = (roleSparksMap['MENTOR'] || 0) + val;
  }

  let netAdjustments = 0;
  for (const r of saRows as any[]) {
    const val = Number(r.sparks) || 0;
    netAdjustments += val;

    if (r.type === 'APPRECIATION') {
      appreciationCount += 1;
      appreciationSparks += val;
    } else if (r.type === 'RESET') {
      resetSparks += Math.abs(val);
    } else if (r.type === 'RESTORE') {
      restoredSparks += val;
    }
  }

  const rawTotal = taskSparks + assessmentSparks + netAdjustments;
  const totalSparks = Math.max(0, rawTotal);

  return {
    userId: targetUserId,
    totalSparks,
    taskSparks,
    assessmentSparks,
    appreciationSparks,
    resetSparks,
    restoredSparks,
    tasksCompleted,
    assessmentsCount,
    appreciationCount,
    roleSparksMap,
  };
}
