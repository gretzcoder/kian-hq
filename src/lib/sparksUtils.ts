/**
 * Sparks calculation and multiplier utility functions
 */

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
