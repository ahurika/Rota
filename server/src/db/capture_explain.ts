import fs from 'node:fs';
import path from 'node:path';
import { primaryPool0 } from './shards.js';

async function main() {
  const mode = process.argv[2] || 'before'; // 'before' or 'after'
  console.log(`Running EXPLAIN ANALYZE mode: ${mode}`);

  // Find the team with the 10,000+ rows
  const teamRes = await primaryPool0.query<{ team_id: string }>(
    `SELECT team_id FROM activity_events GROUP BY team_id ORDER BY count(*) DESC LIMIT 1`
  );
  if (!teamRes.rows.length) {
    throw new Error('No activity events found. Run npm run db:seed first.');
  }
  const teamId = teamRes.rows[0].team_id;

  // Find a mid-feed cursor (~5,000 items in)
  const midRes = await primaryPool0.query<{ id: string; created_at: Date }>(
    `SELECT id, created_at FROM activity_events WHERE team_id = $1 ORDER BY created_at DESC, id DESC OFFSET 5000 LIMIT 1`,
    [teamId]
  );
  const mid = midRes.rows[0];
  console.log(`Using mid-feed cursor: id=${mid.id}, timestamp=${mid.created_at.toISOString()}`);

  const explainQuery = `
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, type, actor_id, entity_id, payload, created_at
    FROM activity_events
    WHERE team_id = $1
      AND (created_at, id) < ($2::timestamptz, $3::bigint)
    ORDER BY created_at DESC, id DESC
    LIMIT 21;
  `;

  const explainRes = await primaryPool0.query<{ 'QUERY PLAN': string }>(explainQuery, [
    teamId,
    mid.created_at.toISOString(),
    mid.id,
  ]);

  const planText = explainRes.rows.map((r) => r['QUERY PLAN']).join('\n');
  console.log('\n--- EXPLAIN (ANALYZE, BUFFERS) ---');
  console.log(planText);
  console.log('----------------------------------\n');

  const outDir = path.resolve(process.cwd(), '../docs/performance');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, `feed-explain-${mode}.txt`);
  fs.writeFileSync(outFile, planText + '\n', 'utf8');
  console.log(`Saved to ${outFile}`);

  await primaryPool0.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
