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
  if (!description || !description.includes('[DIRECT_BRIEF_CATEGORIES:')) return [];
  const match = description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*([\s\S]*?)\]\]/i) || description.match(/\[DIRECT_BRIEF_CATEGORIES:\s*(\[[\s\S]*?\])\]/i);
  if (match && match[1]) {
    try {
      const raw = (match[1].startsWith('[') ? match[1] : `[${match[1]}]`)
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/<[^>]*>/g, '');
      const parsed = JSON.parse(raw);
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

export function parseAssignedTrooperIds(description: string | null | undefined): string[] {
  if (!description || !description.includes('[ASSIGNED_TROOPERS:')) return [];
  const match = description.match(/\[ASSIGNED_TROOPERS:\s*([\s\S]*?)\]/i);
  if (!match || !match[1]) return [];

  const raw = match[1]
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/<[^>]*>/g, ' ');

  try {
    const arrayMatch = raw.match(/\[[\s\S]*?\]/);
    if (arrayMatch) {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.map((x) => String(x).trim()).filter(Boolean);
        if (cleaned.length > 0) return cleaned;
      }
    }
  } catch {}

  // Fallback: match any usr_ tokens (e.g. usr_a1ee332af8a54bf8aee3a4123f1dc2da)
  const ids = raw.match(/usr_[a-zA-Z0-9_-]+/g) || [];
  if (ids.length > 0) {
    return Array.from(new Set(ids));
  }

  return [];
}

export function stripMetadataTags(description: string | null | undefined): string {
  if (!description) return '';
  return description
    .replace(/<p>\s*\[ASSIGNED_TROOPERS:[\s\S]*?\]\s*<\/p>/gi, '')
    .replace(/\[ASSIGNED_TROOPERS:[\s\S]*?\]/gi, '')
    .replace(/<p>\s*\[DIRECT_BRIEF_CATEGORIES:[\s\S]*?\]\s*<\/p>/gi, '')
    .replace(/\[DIRECT_BRIEF_CATEGORIES:[\s\S]*?\]/gi, '')
    .replace(/<p>\s*\[DIRECT_BRIEF\]\s*<\/p>/gi, '')
    .replace(/\[DIRECT_BRIEF\]/gi, '')
    .trim();
}

export function getDirectBriefCategories(description: string | null | undefined): string[] {
  return parseDirectBriefSlots(description).map((s) => s.name);
}
