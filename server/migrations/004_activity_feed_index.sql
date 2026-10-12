-- Migration 004: Activity Feed Composite Index for Keyset Cursor Pagination
-- Matches query: WHERE team_id = $1 AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC

CREATE INDEX IF NOT EXISTS activity_team_created_id_idx
  ON activity_events (team_id, created_at DESC, id DESC);
