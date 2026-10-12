-- Global schema (Database 0 only)
-- Tables: users, refresh_tokens, magic_links, password_resets, devices, user_settings, team_directory, team_shard_overrides, idempotency_keys

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    device_id VARCHAR(255),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_family_id_idx ON refresh_tokens(family_id);

CREATE TABLE IF NOT EXISTS magic_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expo_push_token VARCHAR(255) UNIQUE NOT NULL,
    platform VARCHAR(32) NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS devices_user_id_idx ON devices(user_id);

CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    quiet_start VARCHAR(5) NOT NULL DEFAULT '22:00',
    quiet_end VARCHAR(5) NOT NULL DEFAULT '06:00',
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    notif_types JSONB NOT NULL DEFAULT '{"shift_changes":true,"swaps":true,"billing":true}'::jsonb,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    theme VARCHAR(16) NOT NULL DEFAULT 'system',
    updated_at_quiet_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_quiet_end TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_timezone TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_notif_types TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_language TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at_theme TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_directory (
    user_id UUID NOT NULL,
    team_id UUID NOT NULL,
    role VARCHAR(32) NOT NULL,
    shard INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, team_id)
);

CREATE INDEX IF NOT EXISTS team_directory_user_id_idx ON team_directory(user_id);

CREATE TABLE IF NOT EXISTS team_shard_overrides (
    team_id UUID PRIMARY KEY,
    shard INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
    user_id UUID NOT NULL,
    key VARCHAR(255) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, key)
);
