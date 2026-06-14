import React, { useRef } from "react";
import { Box } from "@mui/material";
import SectionRow from "./SectionRow";
import type { CartItem, MenuItem } from '../types';
import type { GroupWithCategory } from './MenuItemCardHorizontal';
import type { CategoryGroups } from '../../../shared/utils/menuUtils';
import {is} from "date-fns/locale";

interface MenuSectionsProps {
    groups: CategoryGroups;
    handleOpenPopup: (group: GroupWithCategory, item?: MenuItem) => void;
    handleRemoveItemFromCart: (item: CartItem) => void;
    handleAddToCart: (item: CartItem) => void;
    handleChangeQuantity: (item: CartItem, delta: number) => void;
    cartItems: CartItem[];
    isAdmin: boolean;
}

export default function MenuSections({
    groups,
    handleOpenPopup,
    handleRemoveItemFromCart,
    handleAddToCart,
    handleChangeQuantity,
    cartItems,
    isAdmin,
}: MenuSectionsProps): JSX.Element {
    const bestRef = useRef<HTMLDivElement | null>(null);

    const sections = [
        { title: "Ramadan Offers", items: groups.ramadan as GroupWithCategory[] },
        { title: "Bestsellers", items: groups.bestsellers as GroupWithCategory[], isBestSellerBlock: true },
        { title: "Baguette Pizzas", items: groups.pizzaBaguettes as GroupWithCategory[] },
        { title: "Detroit Brick Pizzas", items: groups.brickPizzas as GroupWithCategory[] },
        { title: "Combo Deals", items: groups.combos as GroupWithCategory[] },
        { title: "Pizzas", items: groups.pizzas as GroupWithCategory[] },
        { title: "Sides", items: groups.sides as GroupWithCategory[] },
        { title: "Sauces", items: groups.sauces as GroupWithCategory[] },
        { title: "Beverages", items: groups.beverages as GroupWithCategory[] },
    ].filter(s => s.items.length > 0);

    return (
        <Box sx={{ pt: 1.3, pb: 12 }}>
            {sections.map((section, idx, arr) => (
                <SectionRow
                    key={section.title}
                    section={section}
                    idx={idx}
                    isLast={idx === arr.length - 1}
                    bestRef={section.isBestSellerBlock ? bestRef : null}
                    handleOpenPopup={handleOpenPopup}
                    handleRemoveItemFromCart={handleRemoveItemFromCart}
                    handleAddToCart={handleAddToCart}
                    handleChangeQuantity={handleChangeQuantity}
                    cartItems={cartItems}
                    isAdmin={isAdmin}
                />
            ))}
        </Box>
    );
}
