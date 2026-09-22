-- Migration 0079: User Availabilities Table (Jadwal Kuliah, Appointment, and Semester Management)

CREATE TABLE IF NOT EXISTS user_availabilities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                     -- 'KULIAH' | 'APPOINTMENT'
  title TEXT NOT NULL,                    -- Course name or appointment title
  semester_label TEXT,                    -- e.g. "Semester Ganjil 2026/2027", "Semester 5"
  course_code TEXT,                       -- 1. Kode Matakuliah
  course_name TEXT,                       -- 1. Nama Matakuliah
  class_code TEXT,                        -- 3. Kode Kelas
  campus_name TEXT,                       -- 3. Nama Kampus
  lecturer_code TEXT,                     -- 4. Kode Dosen
  lecturer_name TEXT,                     -- 4. Nama Dosen
  room TEXT,                              -- Ruangan / Gedung
  day_of_week INTEGER,                    -- 2. Waktu Perkuliahan: 1 (Senin) .. 7 (Minggu)
  specific_date TEXT,                     -- 'YYYY-MM-DD' untuk Appointment tertentu
  start_time TEXT NOT NULL,               -- 'HH:mm' e.g. '08:00'
  end_time TEXT NOT NULL,                 -- 'HH:mm' e.g. '10:30'
  is_all_day INTEGER DEFAULT 0,
  location TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_availabilities_user ON user_availabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_availabilities_day ON user_availabilities(day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_availabilities_date ON user_availabilities(specific_date);
CREATE INDEX IF NOT EXISTS idx_user_availabilities_sem ON user_availabilities(semester_label);
