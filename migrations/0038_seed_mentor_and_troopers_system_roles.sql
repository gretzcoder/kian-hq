-- Seed MENTOR TROOPERS and TROOPERS system roles if not present
INSERT OR IGNORE INTO roles (id, name, description) VALUES
('role_mentor_troopers', 'MENTOR TROOPERS', 'Mentor yang membimbing dan mengelola workspace Troopers/OJT'),
('role_troopers', 'TROOPERS', 'Peserta OJT / Troopers yang melaksanakan penugasan dan assessment');
