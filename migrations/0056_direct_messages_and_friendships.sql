-- Migration 0056: User read notifications, friendships, and direct messages
CREATE TABLE IF NOT EXISTS user_read_notifications (
  user_id TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  friend_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS direct_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  reply_to_id TEXT,
  reactions TEXT,
  status TEXT NOT NULL DEFAULT 'SENT',
  is_request INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id, friend_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_convo ON direct_messages(sender_id, receiver_id);
