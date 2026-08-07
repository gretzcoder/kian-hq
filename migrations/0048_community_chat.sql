-- Create table for community chat channels
CREATE TABLE IF NOT EXISTS community_channels (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'GENERAL', -- 'WORK' or 'GENERAL'
  icon TEXT NOT NULL DEFAULT '💬',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default channels
INSERT OR IGNORE INTO community_channels (id, slug, name, description, category, icon, sort_order) VALUES
  ('chan_designer', 'designer-lounge', 'Designer Lounge', 'Ruang khusus ide visual, feedback UI/UX, poster & desain grafis', 'WORK', '🎨', 1),
  ('chan_video', 'video-editor-lounge', 'Video Editor Lounge', 'Diskusi editing, motion graphics, video Reels/TikTok & audio', 'WORK', '🎬', 2),
  ('chan_planner', 'content-planner-lounge', 'Content Planner Lounge', 'Brainstorming ide konten, copywriting, brief & strategi publikasi', 'WORK', '📝', 3),
  ('chan_general', 'general-chit-chat', 'General Chit-Chat', 'Ruang santai bebas untuk ngobrol, berkenalan, dan cit-cat harian', 'GENERAL', '💬', 4),
  ('chan_sparks', 'sparks-and-achievements', 'Sparks & Achievements', 'Berbagi apresiasi, pencapaian tim, dan selebrasi bersama', 'GENERAL', '✨', 5),
  ('chan_help', 'help-and-qna', 'Help & QnA', 'Pusat bantuan teknis, tanya jawab seputar tugas dan alur OJT', 'GENERAL', '💡', 6);

-- Create table for community chat messages
CREATE TABLE IF NOT EXISTS community_messages (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  parent_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (channel_id) REFERENCES community_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_community_messages_chan ON community_messages(channel_id, created_at);

-- Create table for community message reactions
CREATE TABLE IF NOT EXISTS community_message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(message_id, user_id, emoji),
  FOREIGN KEY (message_id) REFERENCES community_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create table for community channel read receipts
CREATE TABLE IF NOT EXISTS community_channel_reads (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id, user_id),
  FOREIGN KEY (channel_id) REFERENCES community_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
