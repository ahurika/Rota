-- Append-only trigger for ledger_entries
-- Enforces Rule 02 and Proof Test T11: prevents UPDATE and DELETE on ledger_entries

CREATE OR REPLACE FUNCTION block_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Ledger entries are strictly append-only: % operations are prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_block_ledger_mutation ON ledger_entries;

CREATE TRIGGER trigger_block_ledger_mutation
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION block_ledger_mutation();
