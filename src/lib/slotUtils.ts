/**
 * Utilities for Direct Brief slots and category parsing
 */

export interface DirectBriefOutputSlot {
  id: string;
  name: string;
  assignedUserId?: string | null;
  assignedUserName?: string | null;
  deadline?: string | null;
  specificBrief?: string | null;
  sparksMultiplier?: number | null;
}

export function parseDirectBriefSlots(description: string | null | undefined): DirectBriefOutputSlot[] {
  if (!description) return [];
  const match = description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\]/);
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => {
          if (typeof item === 'string') {
            return {
              id: `slot_${idx + 1}`,
              name: item.trim(),
            };
          }
          return {
            id: item.id || `slot_${idx + 1}`,
            name: (item.name || '').trim(),
            assignedUserId: item.assignedUserId || null,
            assignedUserName: item.assignedUserName || null,
            deadline: item.deadline || null,
            specificBrief: item.specificBrief || null,
            sparksMultiplier:
              item.sparksMultiplier !== undefined && item.sparksMultiplier !== null
                ? Number(item.sparksMultiplier)
                : item.multiplier !== undefined && item.multiplier !== null
                ? Number(item.multiplier)
                : null,
          };
        }).filter((s) => s.name.length > 0);
      }
    } catch {}
  }
  return [];
}

export const parseSlotsFromDescription = parseDirectBriefSlots;

export function getDirectBriefCategories(description: string | null | undefined): string[] {
  return parseDirectBriefSlots(description).map((s) => s.name);
}
