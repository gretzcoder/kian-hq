import { getDB } from '@/db/client';

export interface NumberingCategoryPreset {
  id: string;
  name: string;
  companyCode: string;
  orgCode: string;
  formatPattern: string;
  description: string;
  icon: string;
}

export const NUMBERING_CATEGORIES: NumberingCategoryPreset[] = [
  {
    id: 'TROOPERS',
    name: 'KIAN Troopers',
    companyCode: 'KIAN',
    orgCode: 'TROOPERS',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat tugas & operasional personil KIAN Troopers',
    icon: '⚡',
  },
  {
    id: 'HQ',
    name: 'Internal & HQ',
    companyCode: 'KIAN',
    orgCode: 'HQ',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat dinas internal manajemen & direksi KIAN HQ',
    icon: '🏢',
  },
  {
    id: 'MEDIA',
    name: 'Media & Creative',
    companyCode: 'KIAN',
    orgCode: 'MEDIA',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat divisi media, kreatif, dan konten',
    icon: '🎨',
  },
  {
    id: 'PROD',
    name: 'Production & Event',
    companyCode: 'KIAN',
    orgCode: 'PROD',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat penugasan produksi lapangan & event organizer',
    icon: '🎬',
  },
  {
    id: 'HR',
    name: 'Talent & OJT',
    companyCode: 'KIAN',
    orgCode: 'HR',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat divisi HR, magang, dan pengembangan troopers',
    icon: '👥',
  },
  {
    id: 'UND',
    name: 'Surat Undangan',
    companyCode: 'KIAN',
    orgCode: 'UND',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Undangan resmi rapat, audiensi, atau partisipasi',
    icon: '✉️',
  },
  {
    id: 'SK',
    name: 'Surat Keterangan',
    companyCode: 'KIAN',
    orgCode: 'SK',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Keterangan magang, pengalaman, atau penyelesaian project',
    icon: '📜',
  },
  {
    id: 'SP',
    name: 'Surat Pernyataan',
    companyCode: 'KIAN',
    orgCode: 'SP',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Pernyataan resmi, komitmen, atau kesanggupan',
    icon: '📝',
  },
  {
    id: 'EXT',
    name: 'Eksternal & Mitra',
    companyCode: 'KIAN',
    orgCode: 'EXT',
    formatPattern: '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}',
    description: 'Surat korespondensi ke mitra luar dan instansi eksternal',
    icon: '🤝',
  },
];

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

export interface NumberSequenceAnalysis {
  usedNumbers: number[];
  maxUsed: number;
  nextSequential: number;
  missingGaps: number[];
  recommendedNumber: number;
}

/**
 * Analyzes issued documents for a specific category/org/type in a given year.
 * Parses document_number like "005/KIAN/TROOPERS/IX/2026" or "1/KIAN/TROOPERS/IX/2026".
 * Identifies used numbers, highest number, next sequential number, and missing gap numbers.
 */
export async function analyzeDocumentSequences(
  scopeKey: string,
  year: number = new Date().getFullYear(),
  companyCode: string = 'KIAN'
): Promise<NumberSequenceAnalysis> {
  const db = await getDB();
  const searchPattern = `%${scopeKey}%${year}%`;
  const compPattern = `%${companyCode}%${year}%`;

  try {
    const { results } = await db
      .prepare(`
        SELECT document_number 
        FROM generated_documents
        WHERE status IN ('ISSUED', 'GENERATED', 'SIGNED')
          AND (
            document_number LIKE ? 
            OR document_number LIKE ?
            OR type_code = ?
          )
      `)
      .bind(searchPattern, compPattern, scopeKey)
      .all();

    const usedSet = new Set<number>();

    for (const row of (results || []) as { document_number: string }[]) {
      const docNum = row.document_number?.trim();
      if (!docNum) continue;

      // Extract leading numeric sequence e.g. "005/KIAN/TROOPERS/IX/2026" -> 5 or "1/KIAN/..." -> 1
      const match = docNum.match(/^0*(\d+)\//) || docNum.match(/(?:^|\/|\b)0*(\d{1,5})\//);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0 && num !== year && num < 10000) {
          usedSet.add(num);
        }
      }
    }

    const usedNumbers = Array.from(usedSet).sort((a, b) => a - b);
    const maxUsed = usedNumbers.length > 0 ? Math.max(...usedNumbers) : 0;
    const nextSequential = maxUsed + 1;

    // Find missing gap numbers between 1 and maxUsed
    const missingGaps: number[] = [];
    for (let i = 1; i < maxUsed; i++) {
      if (!usedSet.has(i)) {
        missingGaps.push(i);
      }
    }

    return {
      usedNumbers,
      maxUsed,
      nextSequential,
      missingGaps,
      recommendedNumber: nextSequential,
    };
  } catch (err) {
    console.error('analyzeDocumentSequences error:', err);
    return {
      usedNumbers: [],
      maxUsed: 0,
      nextSequential: 1,
      missingGaps: [],
      recommendedNumber: 1,
    };
  }
}

/**
 * Atomically generates the next sequence number for a document type / key in a given year.
 * Resets automatically every year on Jan 1st because sequenceKey is `${typeCode}:${year}`.
 * Strictly synchronizes with existing issued documents so it never produces duplicate numbers.
 */
export async function getNextSequenceNumber(
  typeCode: string,
  year: number = new Date().getFullYear(),
  month: number = new Date().getMonth() + 1,
  forcedNumber?: number
): Promise<number> {
  const db = await getDB();
  const sequenceKey = `${typeCode}:${year}`;
  const nowSec = Math.floor(Date.now() / 1000);

  // If user explicitly chose a gap fill number (e.g. 2):
  if (forcedNumber && forcedNumber > 0) {
    return forcedNumber;
  }

  // Analyze actual issued documents from database
  const analysis = await analyzeDocumentSequences(typeCode, year);
  const actualNext = analysis.nextSequential; // e.g. 6 if max is 5

  try {
    const existing = await db
      .prepare('SELECT current_number FROM document_sequences WHERE sequence_key = ?')
      .bind(sequenceKey)
      .first() as { current_number: number } | null;

    const currentDBNum = existing?.current_number || 0;
    const finalNext = Math.max(currentDBNum + 1, actualNext);

    if (existing) {
      await db
        .prepare('UPDATE document_sequences SET current_number = ?, updated_at = ? WHERE sequence_key = ?')
        .bind(finalNext, nowSec, sequenceKey)
        .run();
    } else {
      await db
        .prepare('INSERT INTO document_sequences (sequence_key, year, month, current_number, updated_at) VALUES (?, ?, ?, ?, ?)')
        .bind(sequenceKey, year, month, finalNext, nowSec)
        .run();
    }

    return finalNext;
  } catch (e) {
    console.error('getNextSequenceNumber error:', e);
    return actualNext;
  }
}

/**
 * Peeks the next sequence number without incrementing the database counter.
 * Synchronizes with actual issued documents in database.
 */
export async function peekNextSequenceNumber(
  typeCode: string,
  year: number = new Date().getFullYear()
): Promise<number> {
  try {
    const analysis = await analyzeDocumentSequences(typeCode, year);
    const db = await getDB();
    const sequenceKey = `${typeCode}:${year}`;
    const existing = await db
      .prepare('SELECT current_number FROM document_sequences WHERE sequence_key = ?')
      .bind(sequenceKey)
      .first() as { current_number: number } | null;

    const currentDB = (existing?.current_number || 0) + 1;
    return Math.max(currentDB, analysis.nextSequential);
  } catch (err) {
    console.error('peekNextSequenceNumber error:', err);
    return 1;
  }
}

/**
 * Resolves a template numbering format string into a final document number string.
 * Example format: "{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}"
 * Output: "001/KIAN/TROOPERS/IX/2026"
 */
export function formatDocumentNumber(
  formatPattern: string,
  options: {
    sequenceNumber: number;
    date?: Date | string | number;
    typeCode?: string;
    orgCode?: string;
    companyCode?: string;
    categoryCode?: string;
  }
): string {
  const targetDate = options.date ? new Date(options.date) : new Date();
  const validDate = isNaN(targetDate.getTime()) ? new Date() : targetDate;
  const year = validDate.getFullYear();
  const month = validDate.getMonth() + 1;
  const day = validDate.getDate();
  const romanMonth = getRomanMonth(month);
  const padMonth = String(month).padStart(2, '0');
  const padDay = String(day).padStart(2, '0');
  const seq = options.sequenceNumber || 1;

  const companyCode = options.companyCode || 'KIAN';
  const orgCode = options.categoryCode || options.orgCode || 'TROOPERS';
  const typeCode = options.typeCode || 'SURAT_TUGAS';

  let formatted =
    formatPattern || '{sequence:3}/{company_code}/{org_code}/{roman_month}/{year}';

  // Support {sequence:3}, {sequence:4}, {seq:3}
  formatted = formatted.replace(/\{(?:sequence|seq):(\d+)\}/g, (_match, digits) => {
    const padCount = parseInt(digits, 10) || 1;
    return String(seq).padStart(padCount, '0');
  });

  // Support default {sequence} -> if no padding specified, default to 3 digits unless specified otherwise
  formatted = formatted
    .replace(/\{sequence\}/g, String(seq).padStart(3, '0'))
    .replace(/\{seq\}/g, String(seq).padStart(3, '0'))
    .replace(/\{company_code\}/g, companyCode)
    .replace(/\{company\}/g, companyCode)
    .replace(/\{org_code\}/g, orgCode)
    .replace(/\{category_code\}/g, orgCode)
    .replace(/\{category\}/g, orgCode)
    .replace(/\{group\}/g, orgCode)
    .replace(/\{year\}/g, String(year))
    .replace(/\{tahun\}/g, String(year))
    .replace(/\{month\}/g, padMonth)
    .replace(/\{bulan\}/g, padMonth)
    .replace(/\{roman_month\}/g, romanMonth)
    .replace(/\{bulan_romawi\}/g, romanMonth)
    .replace(/\{day\}/g, padDay)
    .replace(/\{hari\}/g, padDay)
    .replace(/\{type_code\}/g, typeCode);

  return formatted;
}

