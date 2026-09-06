// Shared across the admin UI wherever a staff member's name is rendered: the roster (Account
// Manager), the task board (owner sidebar and header), the shift summary table and salary slip
// popup, and the staff-action drawers/dialogs (change branch, edit payroll, reset password,
// deactivate). Dedupes what was previously 12+ copies of `fullName ?? username`.
export function staffDisplayName(staff: { fullName: string | null; username: string }): string {
    return staff.fullName ?? staff.username;
}

// Employee full names can run to five or six words (e.g. South Asian naming conventions with
// full patronymic chains), which blows out headers, sentences and table cells alike. The
// decision is to keep just the first two whitespace-separated words everywhere in the admin UI.
// Splitting on whitespace is script-agnostic, so this needs no special-casing for Arabic names.
export function shortStaffName(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(" ");
}
