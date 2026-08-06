-- Migration 0040: Add SPARKS_MANAGE permission and sparks_adjustments table

INSERT OR IGNORE INTO permissions (id, name, description) VALUES
('perm_sparks_manage', 'SPARKS_MANAGE', 'Kelola Sparks, reset Sparks pengguna, dan berikan/kembalikan Sparks apresiasi');

-- Grant SPARKS_MANAGE to EXECUTIVE and COORDINATOR roles by default
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role_executive', 'perm_sparks_manage'),
('role_coordinator', 'perm_sparks_manage');

-- Create sparks_adjustments table for resets, restorations, and personal appreciations
CREATE TABLE IF NOT EXISTS sparks_adjustments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'APPRECIATION' | 'RESET' | 'RESTORE'
  sparks INTEGER NOT NULL,
  category TEXT, -- 'ALL' | 'TASKS' | 'ASSESSMENT' | 'APPRECIATION'
  note TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sparks_adjustments_user ON sparks_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_sparks_adjustments_created ON sparks_adjustments(created_at);
