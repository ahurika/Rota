/**
 * Permission matrix for Rota (Role-Based Access Control).
 * Enforced strictly on the server per Rule 01 and rbac-and-tenant-isolation skill.
 * Roles: 'owner' | 'manager' | 'staff'
 */

export type Role = 'owner' | 'manager' | 'staff';

export const PERMISSIONS = {
  'team.invite': ['owner', 'manager'],
  'member.remove': ['owner', 'manager'], // extra check in service: managers can only remove staff
  'member.changeRole': ['owner'],
  'billing.view': ['owner'],
  'billing.change': ['owner'],
  'shift.write': ['owner', 'manager'],
  'shift.read': ['owner', 'manager', 'staff'],
  'swap.request': ['owner', 'manager', 'staff'],
  'swap.decide': ['owner', 'manager'], // extra check in service: requester cannot decide own swap
  'activity.read': ['owner', 'manager', 'staff'],
} as const;

export type Permission = keyof typeof PERMISSIONS;
