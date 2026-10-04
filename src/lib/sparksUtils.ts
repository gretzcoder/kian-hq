/**
 * Determines if a task or assignment belongs to Design output
 */
export function isDesignTaskOrRole(params: {
  role?: string | null;
  taskType?: string | null;
  requiredOutputs?: string | null;
  taskTitle?: string | null;
  taskDesc?: string | null;
}): boolean {
  const { role, taskType, requiredOutputs, taskTitle, taskDesc } = params;
  const r = (role || '').toUpperCase();
  const tt = (taskType || '').toUpperCase();
  const ro = (requiredOutputs || '').toUpperCase();
  const title = (taskTitle || '').toUpperCase();
  const desc = (taskDesc || '').toUpperCase();

  // If explicitly video or other
  if (r === 'VIDEO_EDITOR' || tt === 'VIDEO' || ro === 'VIDEO') return false;
  if (tt === 'OTHER' || ro === 'OTHER') return false;
  if (['RESEARCHER', 'PLANNER', 'MENTOR'].includes(r)) return false;

  return (
    r === 'DESIGNER' ||
    tt === 'DESIGN' ||
    ro === 'DESIGN' ||
    tt === 'DIRECT_BRIEF' ||
    title.includes('DESIGN') ||
    r.includes('DESIGN') ||
    desc.includes('[DESIGN]') ||
    (!['VIDEO', 'OTHER', 'ASSESSMENT'].includes(tt) && !['RESEARCHER', 'PLANNER', 'MENTOR'].includes(r))
  );
}

/**
 * Determines if a task or assignment belongs to Video output
 */
export function isVideoTaskOrRole(params: {
  role?: string | null;
  taskType?: string | null;
  requiredOutputs?: string | null;
  taskTitle?: string | null;
  taskDesc?: string | null;
}): boolean {
  const { role, taskType, requiredOutputs, taskTitle, taskDesc } = params;
  const r = (role || '').toUpperCase();
  const tt = (taskType || '').toUpperCase();
  const ro = (requiredOutputs || '').toUpperCase();
  const title = (taskTitle || '').toUpperCase();
  const desc = (taskDesc || '').toUpperCase();

  if (['RESEARCHER', 'PLANNER', 'MENTOR'].includes(r)) return false;

  return (
    r === 'VIDEO_EDITOR' ||
    tt === 'VIDEO' ||
    ro === 'VIDEO' ||
    title.includes('VIDEO') ||
    r.includes('VIDEO') ||
    desc.includes('[VIDEO]')
  );
}

/**
 * Gets role multiplier (2x for Designer/Video Editor/Creative custom outputs, 1x for others)
 */
export function getSparksRoleMultiplier(params: {
  role?: string | null;
  taskType?: string | null;
  requiredOutputs?: string | null;
  taskTitle?: string | null;
  taskDesc?: string | null;
}): number {
  const isVid = isVideoTaskOrRole(params);
  const isDes = isDesignTaskOrRole(params);
  return (isDes || isVid) ? 2 : 1;
}

/**
 * Calculates the fair combined multiplier when general task multiplier and slot-specific multiplier exist
 * Formula: M_effective = M_task + (M_slot - 1.0)
 */
export function calculateEffectiveSparksMultiplier(
  customTaskMult: number = 1.0,
  slotMult: number = 1.0,
  categoryMult: number = 1.0
): number {
  const baseTask = customTaskMult !== 1.0 ? customTaskMult : categoryMult;
  if (slotMult > 1.0) {
    if (baseTask > 1.0) {
      // Fair Additive Boost: Base Task Multiplier + (Slot Bonus)
      return Math.round((baseTask + (slotMult - 1.0)) * 100) / 100;
    }
    return slotMult;
  }
  return baseTask;
}
