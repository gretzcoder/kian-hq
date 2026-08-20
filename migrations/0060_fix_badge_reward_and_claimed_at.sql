-- Migration 0060: Fix Badge Reward and badge_id in sparks_adjustments
ALTER TABLE sparks_adjustments ADD COLUMN badge_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_badges_claimed ON user_badges(claimed_at);
CREATE INDEX IF NOT EXISTS idx_sparks_adjustments_badge ON sparks_adjustments(badge_id);

-- Backfill badge_id in sparks_adjustments for existing claims
UPDATE sparks_adjustments
SET badge_id = (
  SELECT b.id
  FROM badges b
  WHERE sparks_adjustments.note LIKE '%' || b.name || '%'
  LIMIT 1
)
WHERE category = 'BADGE_REWARD' AND (badge_id IS NULL OR badge_id = '');

-- Backfill claimed_at in user_badges for existing claims
UPDATE user_badges
SET claimed_at = (
  SELECT COALESCE(sa.created_at * 1000, strftime('%s', 'now') * 1000)
  FROM sparks_adjustments sa
  JOIN badges b ON user_badges.badge_id = b.id
  WHERE sa.user_id = user_badges.user_id
    AND sa.category = 'BADGE_REWARD'
    AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || b.name || '%')
  LIMIT 1
)
WHERE user_badges.claimed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM sparks_adjustments sa
    JOIN badges b ON user_badges.badge_id = b.id
    WHERE sa.user_id = user_badges.user_id
      AND sa.category = 'BADGE_REWARD'
      AND (sa.badge_id = user_badges.badge_id OR sa.note LIKE '%' || b.name || '%')
  );
