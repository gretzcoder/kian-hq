/**
 * Utility to extract clean, human-readable appreciation/feedback notes
 * from task_assignments or legacy workflow_events.
 */
export function cleanAppreciationNote(rawNote?: string | null): string | null {
  if (!rawNote || !rawNote.trim()) return null;
  let note = rawNote.trim();

  // Look for "Note: " or "Catatan: " pattern inside workflow notes
  const match = note.match(/(?:Note|Catatan):\s*([^\]\)\n\r]+)/i);
  if (match && match[1] && match[1].trim()) {
    note = match[1].trim();
  } else if (note.startsWith('Approved by:') || note.startsWith('Koordinator menyetujui')) {
    // If it's a generic system message without a custom note, return null
    return null;
  }

  // Trim quotation marks if present
  const cleaned = note.replace(/^["'“]|["'”]$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}
