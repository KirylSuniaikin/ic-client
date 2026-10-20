// Single home for the customer-chosen-branch localStorage literal, mirroring
// domains/kiosk/utils/kioskBranch.ts's KIOSK_BRANCH_KEY convention.
export const CHOSEN_BRANCH_KEY = "chosen_branch_data";

/**
 * There is one branch for now (owner, 20 Oct 2026), so asking a first-time customer to choose it
 * is a step with no choice in it. While this is false they go straight to the menu of the default
 * branch, and nothing is stored for them. The header chip and the payment page still open the
 * picker. Set it to true when a second branch opens.
 */
export const BRANCH_ENTRY_GATE_ENABLED = false;
