-- Migration 006: Devices and push enhancements (Database 0 only)
-- Enforces FR-N1 and FR-N6

ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_id VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS devices_expo_push_token_idx ON devices(expo_push_token);
