-- Billing enhancements: payment_attempts, webhook_events, and truncate trigger on ledger_entries
-- Enforces Rule 02, T5, T6, T7, T11, T12

ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS requested_plan VARCHAR(32);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS requested_seats INTEGER;

ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS payment_attempts_provider_ref_idx ON payment_attempts(provider_ref);
CREATE INDEX IF NOT EXISTS payment_attempts_team_id_idx ON payment_attempts(team_id);

CREATE OR REPLACE FUNCTION block_ledger_truncate()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are strictly append-only: TRUNCATE operations are prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_ledger_truncate ON ledger_entries;

CREATE TRIGGER trigger_block_ledger_truncate
BEFORE TRUNCATE ON ledger_entries
FOR EACH STATEMENT
EXECUTE FUNCTION block_ledger_truncate();
