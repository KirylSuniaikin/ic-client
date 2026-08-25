import { StaffRoles } from '../../auth/types';

// API contract for POST /api/staff (Task 2a/2b, backend, other repo — see task-spec.md Task 2c).
export type HireStaffRequest = {
    username: string;
    password: string;
    fullName: string;
    role: StaffRoles;
    pricePerHour: number;
    branchId: string;
};

// Response never echoes the password.
export type HiredStaffTO = {
    id: number;
    username: string;
    fullName: string;
    role: StaffRoles;
    pricePerHour: number;
    branchId: string;
};

// GET /api/staff list item — pricePerHour is redacted (null) server-side for non-OWNER callers.
export type StaffAdminTO = {
    id: number;
    username: string;
    fullName: string | null;
    role: StaffRoles;
    branchId: string;
    pricePerHour: number | null;
    // Never redacted, unlike pricePerHour: the roster cannot render a deactivated row, hide it
    // behind the filter, or offer reactivation without it.
    enabled: boolean;
};

// Frontend-only presentation filter mirroring the backend's hiring hierarchy (task-spec.md Task
// 2c) — the backend is the actual enforcement boundary, this only narrows the role picker.
export const HIRING_HIERARCHY: Record<StaffRoles, StaffRoles[]> = {
    [StaffRoles.MANAGER]: [StaffRoles.COOK, StaffRoles.SUPERVISOR, StaffRoles.REVIEWER],
    [StaffRoles.SUPER_MANAGER]: [
        StaffRoles.COOK,
        StaffRoles.SUPERVISOR,
        StaffRoles.REVIEWER,
        StaffRoles.MANAGER,
    ],
    [StaffRoles.OWNER]: [
        StaffRoles.COOK,
        StaffRoles.SUPERVISOR,
        StaffRoles.REVIEWER,
        StaffRoles.MANAGER,
        StaffRoles.SUPER_MANAGER,
        StaffRoles.OWNER,
    ],
    [StaffRoles.COOK]: [],
    [StaffRoles.SUPERVISOR]: [],
    [StaffRoles.REVIEWER]: [],
};

export function getHireableRoles(role: StaffRoles | null): StaffRoles[] {
    if (role === null) return [];
    return HIRING_HIERARCHY[role] ?? [];
}

// PUT /api/staff/{id}/password. The plaintext is generated here and travels once, to be hashed;
// the endpoint answers 204, so nothing comes back.
export type ResetStaffPasswordRequest = {
    password: string;
};

// PATCH /api/staff/{id}/enabled. One request shape for both directions -- see the endpoint's
// comment for why deactivate and reactivate are not separate calls.
export type SetStaffEnabledRequest = {
    enabled: boolean;
};

// Presentation-only mirror of StaffService.resolveAdministrableTarget, exactly as
// HIRING_HIERARCHY mirrors the backend's hiring rules -- the backend stays the enforcement
// boundary and this only decides whether to render an action at all.
//
// The branch rule is deliberately absent: the roster this renders is already branch-scoped
// server-side, so every visible row is in scope by construction.
export function canAdministerStaff(
    callerRole: StaffRoles | null,
    callerId: number | null,
    target: StaffAdminTO,
): boolean {
    if (callerId !== null && target.id === callerId) return false;
    return getHireableRoles(callerRole).includes(target.role);
}

// PATCH /api/staff/{id}/branch. Required, never null: every staff member belongs to a branch.
export type SetStaffBranchRequest = {
    branchId: string;
};

// GET /api/staff/me -- the caller's own identity, read from the database rather than decoded
// from their JWT, whose branchId claim is frozen at the moment they logged in.
export type CurrentStaffTO = {
    id: number;
    username: string;
    fullName: string | null;
    role: StaffRoles;
    branchId: string | null;
};
