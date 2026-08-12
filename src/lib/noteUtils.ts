/**
 * Utility to extract clean, human-readable appreciation/feedback notes
 * from task_assignments or legacy workflow_events.
 */
export function cleanAppreciationNote(rawNote?: string | null): string | null {
  if (!rawNote || !rawNote.trim()) return null;
  let note = rawNote.trim();

  // Filter out automated system log text & submitted work results
  if (
    note.startsWith('Result submitted') ||
    note.includes('Result submitted:') ||
    note.includes('<h3>') ||
    note.includes('<p>') ||
    note.includes('<ul>') ||
    note.startsWith('Approved by:') ||
    note.startsWith('Koordinator menyetujui')
  ) {
    return null;
  }

  // Look for "Note: " or "Catatan: " pattern inside workflow notes
  const match = note.match(/(?:Note|Catatan):\s*([^\]\)\n\r]+)/i);
  if (match && match[1] && match[1].trim()) {
    note = match[1].trim();
  }

  // Trim quotation marks if present
  const cleaned = note.replace(/^["'“]|["'”]$/g, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}
