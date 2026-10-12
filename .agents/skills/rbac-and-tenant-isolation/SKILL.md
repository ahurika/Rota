---
name: rbac-and-tenant-isolation
description: Use when adding or changing any endpoint that reads or writes team data, checking roles (Owner, Manager, Staff), or proving that one team cannot see another team's data in Rota. Covers middleware, the permission matrix, repository rules, and the proof tests T1, T2, T8.
---

# Roles and tenant isolation

## The two questions every request must answer

1. **Who is this user in this team?** (membership and role)
2. **Is this resource inside this team?** (team id on every query)

## Permission matrix as code

Keep one table in `server/src/config/permissions.ts`. Routes name an action, not a role.

```ts
export const PERMISSIONS = {
  'team.invite':        ['owner', 'manager'],
  'member.remove':      ['owner', 'manager'],   // manager: staff only (extra check)
  'member.changeRole':  ['owner'],
  'billing.view':       ['owner'],
  'billing.change':     ['owner'],
  'shift.write':        ['owner', 'manager'],
  'shift.read':         ['owner', 'manager', 'staff'],
  'swap.request':       ['owner', 'manager', 'staff'],
  'swap.decide':        ['owner', 'manager'],
  'activity.read':      ['owner', 'manager', 'staff'],
} as const;
```

## Middleware shape

```ts
// 1. auth sets c.var.user
// 2. loadMembership: reads memberships for (teamId, user.id) from the team's shard
//    no membership -> 404 NOT_FOUND (do not reveal that the team exists)
// 3. requirePermission('shift.write'): role not in list -> 403 FORBIDDEN
```

Never cache the membership role result. A removed manager must lose access at once.

Extra checks live in services, not middleware:

- Manager removing a member: target must be `staff`.
- Swap decision: `decided_by !== requester_id`.
- Nobody can demote or remove the last owner.
- Billing restricted mode (`PRD` A7): block `shift.write`, `team.invite`, `swap.decide` when `subscriptions.status = 'restricted'`, returning 402 `BILLING_RESTRICTED`.

## Tenant isolation rules

1. Team id comes from the **path** and the **membership lookup**, never from the request body.
2. Every repository function takes `teamId` and uses it in `WHERE`. Example: `findShift(teamId, shiftId)` runs `WHERE id = $1 AND team_id = $2`. If the shift belongs to another team, it returns nothing, and the route returns 404.
3. Never write `findShiftById(id)` without a team argument.
4. Joins carry `team_id` on both sides.
5. Shard routing uses the team id. A wrong team id cannot reach the right shard's data.
6. Optional hardening: PostgreSQL row-level security with `SET LOCAL app.team_id = ...` per transaction. If you add it, write an ADR and keep the application filters too.

## Status codes

| Situation | Code |
|---|---|
| No or bad token | 401 |
| Not a member of that team, or resource in another team | 404 |
| Member but role not allowed | 403 |
| Seat limit reached | 409 `SEAT_LIMIT_REACHED` |
| Billing restricted | 402 `BILLING_RESTRICTED` |

## Proof tests

**T1 Staff cannot delete a shift**
1. Create team, owner, staff, and a shift as owner.
2. Call `DELETE /v1/teams/:teamId/shifts/:shiftId` with the staff token (call the HTTP route directly, like Postman).
3. Expect 403 and `FORBIDDEN`.
4. Query the database and assert the shift still exists.

**T2 Team isolation**
1. Create team A and team B with different owners, each with a shift.
2. Call `GET /v1/teams/B/shifts` with team A's owner token. Expect 404.
3. Call `GET /v1/teams/A/shifts/<B's shift id>` with team A's owner token. Expect 404.
4. Try `PATCH` and `DELETE` on B's shift with A's token. Expect 404 and no change.
5. Check that no response body contains B's data.

**T8 Seat limit**
1. Create a Starter team with 5 seats filled (members plus pending invites).
2. Owner invites a sixth person. Expect 409 `SEAT_LIMIT_REACHED`.
3. Also test: accepting an old invite when seats are full fails, and two simultaneous invites at 4 of 5 seats let only one through (use a `SELECT ... FOR UPDATE` on the subscription row inside the invite transaction).

Save the output of these tests in `docs/test-results/`.

## Review checklist

- [ ] Route names a permission from the table
- [ ] Membership loaded from the database each request
- [ ] Repository calls pass `teamId`
- [ ] Not-found and forbidden codes used correctly
- [ ] Forbidden-path test added

## Explain-back questions for the human

1. Why return 404 instead of 403 for another team's shift?
2. Why must the role never come from the request body?
3. What stops two simultaneous invites from breaking the seat limit?
