import { getDB } from '@/db/client';

const ROMAN_MONTHS = [
  '',
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

/**
 * Converts a 1-based month number to a Roman numeral.
 */
export function getRomanMonth(monthNumber: number): string {
  if (monthNumber >= 1 && monthNumber <= 12) {
    return ROMAN_MONTHS[monthNumber];
  }
  return String(monthNumber);
}

/**
 * Atomically generates the next sequence number for a document type / key in a given year.
 */
export async function getNextSequenceNumber(
  typeCode: string,
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1
): Promise<number> {
  const db = await getDB();
  const sequenceKey = `${typeCode}:${year}`;
  const nowSec = Math.floor(Date.now() / 1000);

  try {
    // 1. Try atomic upsert in SQLite
    const result = await db
      .prepare(
        `INSERT INTO document_sequences (sequence_key, year, month, current_number, updated_at)
         VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(sequence_key) DO UPDATE SET
           current_number = document_sequences.current_number + 1,
           updated_at = ?
         RETURNING current_number;`
      )
      .bind(sequenceKey, year, month, nowSec, nowSec)
      .first() as { current_number: number } | null;

    if (result && typeof result.current_number === 'number') {
      return result.current_number;
    }
  } catch (e) {
    console.error('Failed atomic sequence increment on D1:', e);
  }

  // Fallback if RETURNING not supported or edge case:
  const existing = await db
    .prepare('SELECT current_number FROM document_sequences WHERE sequence_key = ?')
    .bind(sequenceKey)
    .first() as { current_number: number } | null;

  const nextNum = (existing?.current_number || 0) + 1;

  if (existing) {
    await db
      .prepare('UPDATE document_sequences SET current_number = ?, updated_at = ? WHERE sequence_key = ?')
      .bind(nextNum, nowSec, sequenceKey)
      .run();
  } else {
    await db
      .prepare('INSERT INTO document_sequences (sequence_key, year, month, current_number, updated_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sequenceKey, year, month, nextNum, nowSec)
      .run();
  }

  return nextNum;
}

/**
 * Resolves a template numbering format string into a final document number string.
 * Example format: "{sequence}/KIAN/TROOPERS/{roman_month}/{year}"
 */
export function formatDocumentNumber(
  formatPattern: string,
  options: {
    sequenceNumber: number;
    date?: Date | string | number;
    typeCode?: string;
    orgCode?: string;
  }
): string {
  const targetDate = options.date ? new Date(options.date) : new Date();
  const year = isNaN(targetDate.getFullYear()) ? new Date().getFullYear() : targetDate.getFullYear();
  const month = isNaN(targetDate.getMonth()) ? new Date().getMonth() + 1 : targetDate.getMonth() + 1;
  const romanMonth = getRomanMonth(month);
  const padMonth = String(month).padStart(2, '0');
  const seq = options.sequenceNumber;

  let formatted = formatPattern || '{sequence}/KIAN/TROOPERS/{roman_month}/{year}';

  // Support {sequence:3} -> "001"
  formatted = formatted.replace(/\{sequence:(\d+)\}/g, (_match, digits) => {
    const padCount = parseInt(digits, 10) || 1;
    return String(seq).padStart(padCount, '0');
  });

  formatted = formatted
    .replace(/\{sequence\}/g, String(seq))
    .replace(/\{year\}/g, String(year))
    .replace(/\{month\}/g, padMonth)
    .replace(/\{roman_month\}/g, romanMonth)
    .replace(/\{type_code\}/g, options.typeCode || 'DOC')
    .replace(/\{org_code\}/g, options.orgCode || 'TROOPERS');

  return formatted;
}
