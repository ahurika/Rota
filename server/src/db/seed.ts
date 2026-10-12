import { v4 as uuidv4 } from 'uuid';
import { primaryPool0, primaryPool1, hashShard, dbForTeam } from './shards.js';
import { hashPassword } from '../lib/crypto.js';

export async function runSeed() {
  console.log('--- Starting Rota Database Seeder ---');

  const defaultPasswordHash = await hashPassword('Password123!Secure');

  // 1. Create seed users in Database 0 (users is global table)
  console.log('Seeding global users...');
  const users = [
    { id: uuidv4(), email: 'seed_owner_1@example.com', role: 'owner' },
    { id: uuidv4(), email: 'seed_manager_1@example.com', role: 'manager' },
    { id: uuidv4(), email: 'seed_staff_1@example.com', role: 'staff' },
    { id: uuidv4(), email: 'seed_owner_2@example.com', role: 'owner' },
    { id: uuidv4(), email: 'seed_staff_2@example.com', role: 'staff' },
  ];

  for (const u of users) {
    await primaryPool0.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      [u.id, u.email, defaultPasswordHash]
    );
  }

  // 2. Create teams across both shards
  console.log('Seeding teams across shards...');
  let teamShard0Id = '';
  let teamShard1Id = '';

  // Find IDs that map to shard 0 and shard 1
  while (!teamShard0Id || !teamShard1Id) {
    const candidateId = uuidv4();
    const shard = hashShard(candidateId);
    if (shard === 0 && !teamShard0Id) teamShard0Id = candidateId;
    if (shard === 1 && !teamShard1Id) teamShard1Id = candidateId;
  }

  const teams = [
    { id: teamShard0Id, name: 'Shard 0 Cafe (Load Test Team)', ownerId: users[0].id, shard: 0 },
    { id: teamShard1Id, name: 'Shard 1 Clinic', ownerId: users[3].id, shard: 1 },
  ];

  for (const t of teams) {
    const pool = t.shard === 0 ? primaryPool0 : primaryPool1;

    // Team row
    await pool.query(
      `INSERT INTO teams (id, name, owner_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.name, t.ownerId]
    );

    // Owner membership
    await pool.query(
      `INSERT INTO memberships (team_id, user_id, role, status) VALUES ($1, $2, 'owner', 'active') ON CONFLICT (team_id, user_id) DO NOTHING`,
      [t.id, t.ownerId]
    );

    // Starter subscription
    await pool.query(
      `INSERT INTO subscriptions (team_id, plan, seats, period_start, period_days, status)
       VALUES ($1, 'starter', 5, now(), 30, 'active')
       ON CONFLICT (team_id) DO NOTHING`,
      [t.id]
    );

    // Team directory in DB 0
    await primaryPool0.query(
      `INSERT INTO team_directory (user_id, team_id, role, shard) VALUES ($1, $2, 'owner', $3)
       ON CONFLICT (user_id, team_id) DO UPDATE SET role = EXCLUDED.role, shard = EXCLUDED.shard`,
      [t.ownerId, t.id, t.shard]
    );
  }

  // Add staff and manager to teamShard0
  await primaryPool0.query(
    `INSERT INTO memberships (team_id, user_id, role, status) VALUES ($1, $2, 'manager', 'active') ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamShard0Id, users[1].id]
  );
  await primaryPool0.query(
    `INSERT INTO memberships (team_id, user_id, role, status) VALUES ($1, $2, 'staff', 'active') ON CONFLICT (team_id, user_id) DO NOTHING`,
    [teamShard0Id, users[2].id]
  );

  // 3. Seed shifts for teamShard0
  console.log('Seeding shifts...');
  for (let s = 0; s < 10; s++) {
    const startsAt = new Date(Date.now() + (s + 1) * 86400000);
    const endsAt = new Date(startsAt.getTime() + 8 * 3600000);
    await primaryPool0.query(
      `INSERT INTO shifts (team_id, assignee_id, starts_at, ends_at, label, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        teamShard0Id,
        s % 2 === 0 ? users[2].id : null,
        startsAt,
        endsAt,
        `Shift #${s + 1}`,
        'Seeded shift',
      ]
    );
  }

  // 4. Seed at least 10,000 activity events on teamShard0 (with deliberate timestamp ties)
  console.log('Seeding 10,000+ activity events for load-test team (teamShard0)...');
  const totalEvents = 10050;
  const batchSize = 1000;
  const baseTime = new Date('2026-09-01T00:00:00.000Z').getTime();

  for (let batchStart = 0; batchStart < totalEvents; batchStart += batchSize) {
    const currentBatchSize = Math.min(batchSize, totalEvents - batchStart);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (let i = 0; i < currentBatchSize; i++) {
      const eventNum = batchStart + i;
      // Group events by 5 to create intentional exact millisecond ties
      const timestampOffset = Math.floor(eventNum / 5) * 60000;
      const eventTime = new Date(baseTime + timestampOffset);

      valuePlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
      params.push(
        teamShard0Id,
        eventNum % 2 === 0 ? 'shift_created' : 'shift_updated',
        users[0].id,
        JSON.stringify({ eventNum, batch: Math.floor(batchStart / batchSize) }),
        eventTime
      );
    }

    const query = `
      INSERT INTO activity_events (team_id, type, actor_id, payload, created_at)
      VALUES ${valuePlaceholders.join(', ')}
    `;
    await primaryPool0.query(query, params);
  }

  // Run ANALYZE to update PostgreSQL optimizer statistics
  await primaryPool0.query('ANALYZE activity_events;');
  await primaryPool1.query('ANALYZE activity_events;');

  const countRes = await primaryPool0.query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_events WHERE team_id = $1`,
    [teamShard0Id]
  );

  console.log('--- Database Seeding Complete ---');
  console.log(`Teams created: ${teams.length} (Shard 0: ${teamShard0Id}, Shard 1: ${teamShard1Id})`);
  console.log(`Users created: ${users.length}`);
  console.log(`Activity events on team ${teamShard0Id}: ${countRes.rows[0].count}`);

  return {
    loadTestTeamId: teamShard0Id,
    eventCount: parseInt(countRes.rows[0].count, 10),
  };
}

// Execute CLI seed
runSeed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
