-- Migration 0077: Organization Structure, Hierarchy, and Authority Overlay System

-- 1. Organization Nodes (Directorates, Divisions, Departments, Positions)
CREATE TABLE IF NOT EXISTS organization_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES organization_nodes(id) ON DELETE SET NULL,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'DIVISION', -- DIRECTORATE | DIVISION | DEPARTMENT | TEAM | POSITION
  description TEXT,
  color TEXT DEFAULT 'purple',           -- purple | blue | indigo | emerald | amber | rose | cyan
  icon TEXT DEFAULT '🏢',
  order_index INTEGER DEFAULT 0,
  authorities TEXT NOT NULL DEFAULT '{}', -- JSON configuration for delegated functional permissions
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Organization Members (User assignments to organization nodes)
CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES organization_nodes(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_title TEXT DEFAULT 'Member',      -- e.g. 'Kepala Divisi / Lead', 'Senior Designer', 'Staff'
  is_lead INTEGER DEFAULT 0,             -- 1 = Leader of this node/unit
  assigned_at INTEGER NOT NULL,
  UNIQUE(node_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_nodes_parent ON organization_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_node ON organization_members(node_id);
