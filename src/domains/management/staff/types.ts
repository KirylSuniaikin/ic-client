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
