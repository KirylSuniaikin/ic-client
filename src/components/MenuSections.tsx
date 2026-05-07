import React from "react";
import { Box } from "@mui/material";
import SectionRow from "./SectionRow";
import type { CartItem, MenuItem } from '../management/types/menuTypes';
import type { GroupWithCategory } from './MenuItemCardHorizontal';

interface MenuSectionsProps {
    bestsellers: GroupWithCategory[];
    brickPizzas: GroupWithCategory[];
    combos: GroupWithCategory[];
    pizzas: GroupWithCategory[];
    sides: GroupWithCategory[];
    sauces: GroupWithCategory[];
    beverages: GroupWithCategory[];
    // item is optional to match MenuItemCardHorizontal's onSelect call signature
    handleOpenPopup: (group: GroupWithCategory, item?: MenuItem) => void;
    handleRemoveItemFromCart: (item: CartItem) => void;
    handleAddToCart: (item: CartItem) => void;
    handleChangeQuantity: (item: CartItem, delta: number) => void;
    cartItems: CartItem[];
    bestRef: React.RefObject<HTMLDivElement>;
}

export default function MenuSections({
                                         bestsellers,
                                         brickPizzas,
                                         combos,
                                         pizzas,
                                         sides,
                                         sauces,
                                         beverages,
                                         handleOpenPopup,
                                         handleRemoveItemFromCart,
                                         handleAddToCart,
                                         handleChangeQuantity,
                                         cartItems,
                                         bestRef
                                     }: MenuSectionsProps): JSX.Element {
    const sections = [
        { title: "Bestsellers", items: bestsellers, isBestSellerBlock: true },
        { title: "Detroit Brick Pizzas", items: brickPizzas },
        { title: "Combo Deals", items: combos },
        { title: "Pizzas", items: pizzas },
        { title: "Sides", items: sides },
        { title: "Sauces", items: sauces },
        { title: "Beverages", items: beverages },
    ].filter(({ items }) => items.length > 0);

    return (
        <Box sx={{ pt: 1.3, pb: 12 }}>
            {sections.map((section, idx, arr) => (
                <SectionRow
                    key={section.title}
                    section={section}
                    idx={idx}
                    isLast={idx === arr.length - 1}
                    bestRef={section.title === "Bestsellers" ? bestRef : null}
                    handleOpenPopup={handleOpenPopup}
                    handleRemoveItemFromCart={handleRemoveItemFromCart}
                    handleAddToCart={handleAddToCart}
                    handleChangeQuantity={handleChangeQuantity}
                    cartItems={cartItems}
                />
            ))}
        </Box>
    );
}
