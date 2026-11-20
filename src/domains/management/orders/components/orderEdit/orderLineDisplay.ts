import type { CartItem, ComboItem } from "../../../../menu/types";
import { buildTicketLines, resolveKitchenNote } from "../../../../menu/utils/orderLines";

/** How a line reads to staff: the same kitchen wording the order card and the ticket use. */
export interface OrderLineDescription {
    title: string;
    details: string[];
}

function withSize(name: string, size: string | undefined): string {
    const trimmed = (size ?? "").trim();
    return trimmed ? `${name} (${trimmed})` : name;
}

function optionLines(source: CartItem | ComboItem): string[] {
    const note = resolveKitchenNote(source);
    return [...buildTicketLines(source), ...(note ? [`+ ${note}`] : [])];
}

export function describeOrderLine(item: CartItem): OrderLineDescription {
    const children = item.comboItems ?? [];
    const details = children.length > 0
        ? children.flatMap(child => [withSize(child.name, child.size), ...optionLines(child)])
        : optionLines(item);
    return { title: withSize(item.name, item.size), details };
}

/** One line of text, for the summary: "Pepperoni (L) · + Thin Dough · - NO Oregano". */
export function orderLineLabel(item: CartItem): string {
    const { title, details } = describeOrderLine(item);
    return [title, ...details].join(" · ");
}

/** Bahraini dinar amounts carry three decimals (fils). */
export function formatBd(amount: number): string {
    return amount.toFixed(3);
}

/** What one line costs, discount included — the per-line share of computeAmountPaid. */
export function lineTotal(item: CartItem): number {
    return item.amount * (1 - (item.discountAmount ?? 0) / 100) * item.quantity;
}
