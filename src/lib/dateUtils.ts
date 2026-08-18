/**
 * Helper to parse HTML datetime-local or date input string into Unix timestamp (ms).
 * If dateStr has no explicit timezone offset, it is parsed as Indonesia WIB (Asia/Jakarta, UTC+7).
 */
export function parseIndonesiaDate(dateStr: string | null | undefined): number | null {
  if (!dateStr || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  // Check if string already has a timezone indicator (Z, +HH:MM, or -HH:MM after time component)
  const timePart = trimmed.includes('T') ? trimmed.split('T')[1] : trimmed;
  const hasTimezone = timePart.includes('Z') || timePart.includes('+') || (timePart.includes('-') && timePart.indexOf('-') > 0);
  const isoStr = hasTimezone ? trimmed : `${trimmed}:00+07:00`;
  const ts = new Date(isoStr).getTime();
  return isNaN(ts) ? null : ts;
}

/**
 * Formats a Unix timestamp into a `YYYY-MM-DDTHH:mm` string for HTML <input type="datetime-local">.
 * Formats in Indonesia WIB (UTC+7) timezone so form inputs show the exact local date & time.
 */
export function formatDatetimeLocalInput(ts: number | null | undefined): string {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';

  // Use Intl.DateTimeFormat to reliably extract year, month, day, hour, minute in Asia/Jakarta timezone
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const yyyy = getPart('year');
  const mm = getPart('month');
  const dd = getPart('day');
  const hh = getPart('hour') === '24' ? '00' : getPart('hour');
  const min = getPart('minute');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
