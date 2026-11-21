import PizzaPopup from "../../../../menu/components/popups/PizzaPopupContent";
import { BaguettePizzaPopup } from "../../../../menu/components/popups/BaguettePizzaPopup";
import GenericItemPopupContent from "../../../../menu/components/popups/GenericItemPopupContent";
import { PizzaComboPopup } from "../../../../menu/components/popups/combo/PizzaComboPopup";
import { DetroitComboPopup } from "../../../../menu/components/popups/combo/DetroitComboPopup";
import type { CartItem, ExtraIngr, Group, MenuItem, Topping } from "../../../../menu/types";

/** The menu's own item popup, opened over the editor — for a new line, or pre-filled for a line. */
export type ItemPopupRequest =
    | { kind: "pizza"; group: Group; editItem: CartItem | null }
    | { kind: "baguette"; menuItem: MenuItem }
    | { kind: "generic"; group: Group }
    | { kind: "pizzaCombo"; comboGroup: MenuItem[]; editItem: CartItem | null }
    | { kind: "detroitCombo"; combo: MenuItem[]; editItem: CartItem | null };

/** The category groups the combo popups pick their pizza, brick, drink and sauce from. */
export interface ComboChoices {
    pizzas: Group[];
    bricks: Group[];
    drinks: Group[];
    sauces: Group[];
}

interface OrderEditItemPopupsProps {
    request: ItemPopupRequest;
    choices: ComboChoices;
    extraIngredients: ExtraIngr[];
    toppings: Topping[];
    isSDoughAvailable: boolean;
    onAdd: (items: CartItem[]) => void;
    onClose: () => void;
}

// The popups' removeFromCart is the customer cart's value-matching removal. The editor replaces
// an edited line by its key in onAdd instead (as useCart replaces by reference), so there is
// nothing to remove here.
function keepLines(): void {
    return undefined;
}

/**
 * Renders the popup the menu page would open, text-only (hidePhoto). Like the admin menu
 * (HomePageModals), it takes the PC layout from `md` up and the phone sheet below.
 */
export function OrderEditItemPopups({
    request, choices, extraIngredients, toppings, isSDoughAvailable, onAdd, onClose,
}: OrderEditItemPopupsProps): JSX.Element {
    const addOne = (item: CartItem): void => onAdd([item]);
    return (
        <>
            {request.kind === "pizza" && (
                <PizzaPopup
                    open
                    hidePhoto
                    group={request.group}
                    editItem={request.editItem}
                    isEditMode={request.editItem !== null}
                    extraIngredients={extraIngredients}
                    toppings={toppings}
                    onAddToCart={onAdd}
                    removeFromCart={keepLines}
                    onClose={onClose}
                    isSDoughAvailable={isSDoughAvailable}
                    isAdmin
                />
            )}
            {request.kind === "baguette" && (
                <BaguettePizzaPopup
                    open
                    hidePhoto
                    menuItem={request.menuItem}
                    crossSellItems={[]}
                    onAddToCart={onAdd}
                    removeFromCart={keepLines}
                    onClose={onClose}
                />
            )}
            {request.kind === "generic" && (
                <GenericItemPopupContent
                    open
                    hidePhoto
                    group={request.group}
                    extraIngredients={extraIngredients}
                    crossSellItems={[]}
                    onAddToCart={onAdd}
                    onClose={onClose}
                />
            )}
            {request.kind === "pizzaCombo" && (
                <PizzaComboPopup
                    open
                    hidePhoto
                    comboGroup={request.comboGroup}
                    pizzas={choices.pizzas}
                    drinks={choices.drinks}
                    sauces={choices.sauces}
                    editItem={request.editItem}
                    isEditMode={request.editItem !== null}
                    onAddToCart={addOne}
                    removeFromCart={keepLines}
                    onClose={onClose}
                    isSDoughAvailable={isSDoughAvailable}
                    isAdmin
                    extraIngredients={extraIngredients}
                    toppings={toppings}
                />
            )}
            {request.kind === "detroitCombo" && (
                <DetroitComboPopup
                    open
                    hidePhoto
                    combo={request.combo}
                    bricks={choices.bricks}
                    drinks={choices.drinks}
                    sauces={choices.sauces}
                    editItem={request.editItem}
                    isEditMode={request.editItem !== null}
                    onAddToCart={addOne}
                    removeFromCart={keepLines}
                    onClose={onClose}
                />
            )}
        </>
    );
}
