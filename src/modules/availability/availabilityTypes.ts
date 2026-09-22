export type AvailabilityType = 'KULIAH' | 'APPOINTMENT';

export type DayOfWeekNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DAY_OF_WEEK_NAMES: Record<number, { id: string; name: string; short: string }> = {
  1: { id: 'SENIN', name: 'Senin', short: 'Sen' },
  2: { id: 'SELASA', name: 'Selasa', short: 'Sel' },
  3: { id: 'RABU', name: 'Rabu', short: 'Rab' },
  4: { id: 'KAMIS', name: 'Kamis', short: 'Kam' },
  5: { id: 'JUMAT', name: "Jum'at", short: 'Jum' },
  6: { id: 'SABTU', name: 'Sabtu', short: 'Sab' },
  7: { id: 'MINGGU', name: 'Minggu', short: 'Min' },
};

export interface UserAvailabilityItem {
  id: string;
  userId: string;
  type: AvailabilityType;
  title: string;
  semesterLabel?: string | null;
  // 1. Kode & Nama Matakuliah
  courseCode?: string | null;
  courseName?: string | null;
  // 3. Kode Kelas & Nama Kampus
  classCode?: string | null;
  campusName?: string | null;
  // 4. Kode & Nama Dosen
  lecturerCode?: string | null;
  lecturerName?: string | null;
  room?: string | null;
  // 2. Waktu Perkuliahan
  dayOfWeek?: DayOfWeekNumber | null;
  specificDate?: string | null; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  isAllDay: boolean;
  location?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SuratTugasAssigneeInfo {
  no?: number;
  nip?: string;
  name: string;
  role?: string;
  userId?: string;
}

export interface SuratTugasDutyItem {
  documentId: string;
  documentNumber: string;
  title: string;
  eventName: string;
  eventDays: string;
  eventTime: string;
  eventLocation: string;
  dutyRole: string;
  userNip?: string;
  dateMatched: string; // YYYY-MM-DD
}

export interface UserProfileSnapshot {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  university: string | null;
  studyProgram: string | null;
  semester: string | null;
  studentIdNumber: string | null;
  userType: string | null;
  roleName: string | null;
  whatsappNumber: string | null;
}

export type AvailabilityStatusCategory = 'AVAIL' | 'BERKEGIATAN' | 'BERTUGAS';

export interface UserDateAvailabilityDetail {
  user: UserProfileSnapshot;
  status: AvailabilityStatusCategory;
  kuliahList: UserAvailabilityItem[];
  appointmentList: UserAvailabilityItem[];
  suratTugasList: SuratTugasDutyItem[];
}

export interface DayAvailabilitySummary {
  dateStr: string; // YYYY-MM-DD
  dayOfWeek: number;
  dayName: string;
  availCount: number;
  berkegiatanCount: number;
  bertugasCount: number;
  totalUsers: number;
}

export interface CreateAvailabilityPayload {
  type: AvailabilityType;
  title?: string;
  semesterLabel?: string;
  // Kuliah fields:
  courseCode?: string;
  courseName?: string;
  classCode?: string;
  campusName?: string;
  lecturerCode?: string;
  lecturerName?: string;
  room?: string;
  dayOfWeek?: number;
  // Appointment fields:
  specificDate?: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  location?: string;
  notes?: string;
}

export interface UpdateAvailabilityPayload extends Partial<CreateAvailabilityPayload> {
  isActive?: boolean;
}
