import { v4 as uuidv4 } from 'uuid';
import { teamsRepository, TeamRow } from '../repositories/teamsRepository.js';
import { membershipsRepository, MembershipRow } from '../repositories/membershipsRepository.js';
import { subscriptionsRepository } from '../repositories/subscriptionsRepository.js';
import { teamDirectoryRepository } from '../repositories/teamDirectoryRepository.js';
import { invitesRepository, InviteRow } from '../repositories/invitesRepository.js';
import { hashShard, shardFor, dbForTeam } from '../db/shards.js';
import { Role } from '../config/permissions.js';
import { AppError } from '../lib/errors.js';
import { generateRandomToken, hashTokenWithPepper } from '../lib/crypto.js';

export const teamsService = {
  /**
   * Creates a team on the designated shard, assigns owner, creates Starter subscription,
   * and records directory entry on Database 0.
   */
  async createTeam(userId: string, name: string): Promise<{ team: TeamRow; role: Role }> {
    const teamId = uuidv4();
    const shard = hashShard(teamId);

    const team = await teamsRepository.createTeam(teamId, name, userId);
    await membershipsRepository.create(teamId, userId, 'owner');
    await subscriptionsRepository.createStarter(teamId);
    await teamDirectoryRepository.addEntry(userId, teamId, 'owner', shard);

    return { team, role: 'owner' };
  },

  /**
   * Lists teams for a user via team_directory on Database 0 without scatter-gather.
   */
  async listUserTeams(userId: string): Promise<Array<{ team: TeamRow; role: Role }>> {
    const entries = await teamDirectoryRepository.listForUser(userId);
    const results: Array<{ team: TeamRow; role: Role }> = [];

    for (const entry of entries) {
      const team = await teamsRepository.findById(entry.team_id);
      if (team) {
        results.push({ team, role: entry.role });
      }
    }

    return results;
  },

  /**
   * Invites a new member. Enforces role boundaries and seat caps with row locks (Proof Test T8).
   */
  async inviteMember(
    teamId: string,
    inviterRole: Role,
    email: string,
    role: Role
  ): Promise<{ invite: { id: string; email: string; role: Role; expiresAt: Date }; inviteToken: string }> {
    // Managers can only invite staff
    if (inviterRole === 'manager' && role !== 'staff') {
      throw new AppError('FORBIDDEN', 403, 'Managers can only invite staff members');
    }

    const pool = await dbForTeam(teamId);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Lock the subscription row to serialize seat checks against concurrent invites
      const subscription = await subscriptionsRepository.lockForUpdate(teamId, client);
      const seatCap = subscription ? subscription.seats : 5; // Starter default is 5

      // 2. Count active members + pending invites
      const activeMembers = await membershipsRepository.countActiveMembers(teamId, client);
      const pendingInvites = await invitesRepository.countPending(teamId, client);
      const totalOccupiedSeats = activeMembers + pendingInvites;

      if (totalOccupiedSeats >= seatCap) {
        await client.query('ROLLBACK');
        throw new AppError('SEAT_LIMIT_REACHED', 409, `Team seat limit reached (${seatCap} seats)`);
      }

      // 3. Issue single-use invite token (expires in 7 days)
      const rawInviteToken = generateRandomToken(32);
      const tokenHash = hashTokenWithPepper(rawInviteToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await invitesRepository.createInvite(
        {
          teamId,
          email,
          role,
          tokenHash,
          expiresAt,
        },
        client
      );

      await client.query('COMMIT');

      return {
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expires_at,
        },
        inviteToken: rawInviteToken,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Accepts an invite link token. Atomically updates seat count, membership, and team directory.
   */
  async acceptInvite(userId: string, rawToken: string): Promise<{ teamId: string; role: Role }> {
    const tokenHash = hashTokenWithPepper(rawToken);
    const invite = await invitesRepository.findPendingByTokenHash(tokenHash);

    if (!invite) {
      throw new AppError('NOT_FOUND', 404, 'Invalid, expired, or already-used invite link');
    }

    const pool = await dbForTeam(invite.team_id);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const subscription = await subscriptionsRepository.lockForUpdate(invite.team_id, client);
      const seatCap = subscription ? subscription.seats : 5;
      const activeMembers = await membershipsRepository.countActiveMembers(invite.team_id, client);

      if (activeMembers >= seatCap) {
        await client.query('ROLLBACK');
        throw new AppError('SEAT_LIMIT_REACHED', 409, 'Team has reached its maximum seat limit');
      }

      await membershipsRepository.create(invite.team_id, userId, invite.role, 'active', client);
      await invitesRepository.markAccepted(invite.team_id, invite.id, client);

      const shard = await shardFor(invite.team_id);
      await teamDirectoryRepository.addEntry(userId, invite.team_id, invite.role, shard);

      await client.query('COMMIT');

      return { teamId: invite.team_id, role: invite.role };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
};
