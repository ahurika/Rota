import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { primaryPool0, primaryPool1 } from './shards.js';
import { logger } from '../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, '../../migrations');

async function ensureMigrationTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function applyMigration(pool: pg.Pool, migrationName: string, dbLabel: string): Promise<void> {
  const check = await pool.query('SELECT name FROM _migrations WHERE name = $1', [migrationName]);
  if (check.rows.length > 0) {
    logger.info(`[${dbLabel}] Migration ${migrationName} already applied.`);
    return;
  }

  const filePath = path.join(migrationsDir, migrationName);
  const sql = await fs.readFile(filePath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _migrations (name) VALUES ($1)', [migrationName]);
    await client.query('COMMIT');
    logger.info(`[${dbLabel}] Successfully applied ${migrationName}`);
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ err, migrationName, dbLabel }, `Failed to apply migration`);
    throw err;
  } finally {
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  logger.info('Starting database migrations across shards...');

  // Database 0: Global tables + Shard 0 tables
  logger.info('--- Migrating Database 0 (Global + Shard 0) ---');
  await ensureMigrationTable(primaryPool0);
  await applyMigration(primaryPool0, '001_global_schema.sql', 'Database 0');
  await applyMigration(primaryPool0, '002_shard_schema.sql', 'Database 0');
  await applyMigration(primaryPool0, '003_ledger_trigger.sql', 'Database 0');
  await applyMigration(primaryPool0, '004_activity_feed_index.sql', 'Database 0');
  await applyMigration(primaryPool0, '005_billing_enhancements.sql', 'Database 0');
  await applyMigration(primaryPool0, '006_devices_and_push.sql', 'Database 0');

  // Database 1: Shard 1 tables only
  logger.info('--- Migrating Database 1 (Shard 1) ---');
  await ensureMigrationTable(primaryPool1);
  await applyMigration(primaryPool1, '002_shard_schema.sql', 'Database 1');
  await applyMigration(primaryPool1, '003_ledger_trigger.sql', 'Database 1');
  await applyMigration(primaryPool1, '004_activity_feed_index.sql', 'Database 1');
  await applyMigration(primaryPool1, '005_billing_enhancements.sql', 'Database 1');

  logger.info('Database migrations completed successfully on all shards.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
