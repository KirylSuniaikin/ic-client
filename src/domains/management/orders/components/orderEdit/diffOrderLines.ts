import type { CartItem, ComboItem, Customization } from "../../../../menu/types";

/** One side of a change: the line it concerns and how many units moved. */
export interface OrderLineChange {
    item: CartItem;
    quantity: number;
}

export interface OrderLineDiff {
    added: OrderLineChange[];
    removed: OrderLineChange[];
}

function customizationKey(customizations: Customization[] | undefined): string {
    return (customizations ?? [])
        .map(c => [c.action, c.toppingId ?? "", c.extraIngrId ?? "", c.componentId ?? "", c.quantity ?? 1].join(":"))
        .sort()
        .join(",");
}

/**
 * The options that change what the kitchen makes. Structural customizations are compared when
 * the line has them; a legacy line without them only has its generated description to go on.
 */
function optionsKey(source: {
    size?: string;
    isThinDough?: boolean;
    isGarlicCrust?: boolean;
    note?: string;
    description?: string;
    customizations?: Customization[];
}): unknown[] {
    const customizations = customizationKey(source.customizations);
    return [
        (source.size ?? "").trim(),
        !!source.isThinDough,
        !!source.isGarlicCrust,
        (source.note ?? "").trim(),
        customizations,
        customizations === "" ? (source.description ?? "").trim() : "",
    ];
}

function comboChildKey(child: ComboItem): unknown[] {
    return [child.name, ...optionsKey(child)];
}

/**
 * Identity of an order line: the menu item (by name and category, which is stable across the
 * order response and the menu, unlike ids) plus every option. A Pepperoni M and a Pepperoni L,
 * or the same pizza with and without oregano, are different lines — different things for the
 * kitchen to make. The discount is part of it too, so a free line never merges into a paid one.
 */
export function orderLineSignature(item: CartItem): string {
    return JSON.stringify([
        item.name,
        item.category,
        item.discountAmount ?? 0,
        ...optionsKey(item),
        (item.comboItems ?? []).map(comboChildKey),
    ]);
}

/** Total quantity per signature, keeping the first line seen as the representative item. */
function tally(items: CartItem[]): Map<string, OrderLineChange> {
    const totals = new Map<string, OrderLineChange>();
    for (const item of items) {
        const signature = orderLineSignature(item);
        const existing = totals.get(signature);
        totals.set(signature, existing
            ? { item: existing.item, quantity: existing.quantity + item.quantity }
            : { item, quantity: item.quantity });
    }
    return totals;
}

/**
 * What an edit adds to and removes from an order. Lines are matched by {@link orderLineSignature},
 * and only the difference in quantity is reported: going from 2 to 1 Coca Cola is "1 × Coca Cola"
 * removed. A line whose options changed shows up as the old line removed and the new one added.
 */
export function diffOrderLines(original: CartItem[], edited: CartItem[]): OrderLineDiff {
    const before = tally(original);
    const after = tally(edited);
    const added: OrderLineChange[] = [];
    const removed: OrderLineChange[] = [];

    before.forEach((was, signature) => {
        const nowQuantity = after.get(signature)?.quantity ?? 0;
        if (nowQuantity < was.quantity) removed.push({ item: was.item, quantity: was.quantity - nowQuantity });
    });
    after.forEach((now, signature) => {
        const wasQuantity = before.get(signature)?.quantity ?? 0;
        if (now.quantity > wasQuantity) added.push({ item: now.item, quantity: now.quantity - wasQuantity });
    });

    return { added, removed };
}
