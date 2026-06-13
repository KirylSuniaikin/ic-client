import React from "react";
import { Box } from "@mui/material";
import MenuItemCardHorizontal from "./MenuItemCardHorizontal";
import {TextGroup} from "../../../shared/components/typography";
import type { Group, CartItem, MenuItem } from '../types';
import type { GroupWithCategory } from './MenuItemCardHorizontal';

interface SectionData {
    title: string;
    items: GroupWithCategory[];
    isBestSellerBlock?: boolean;
}

interface SectionRowProps {
    section: SectionData;
    idx: number;
    isLast: boolean;
    bestRef: React.RefObject<HTMLDivElement> | null;
    // item is optional to match MenuItemCardHorizontal's onSelect call signature
    handleOpenPopup: (group: GroupWithCategory, item?: MenuItem) => void;
    handleRemoveItemFromCart: (item: CartItem) => void;
    handleAddToCart: (item: CartItem) => void;
    handleChangeQuantity: (item: CartItem, delta: number) => void;
    cartItems: CartItem[];
    isAdmin: boolean;
}

export default function SectionRow({
                                       section,
                                       idx,
                                       isLast,
                                       bestRef,
                                       handleOpenPopup,
                                       handleRemoveItemFromCart,
                                       handleAddToCart,
                                       handleChangeQuantity,
                                       cartItems,
                                       isAdmin,
                                   }: SectionRowProps): JSX.Element {
    return (
        <Box sx={{ pb: isLast ? 1 : 4 }}>
            <TextGroup sx={{ px: 1.5, pb: 1 }}>{section.title}</TextGroup>

            <Box
                ref={bestRef}
                sx={{
                    display: "flex",
                    overflowX: "auto",
                    px: 1,
                    scrollSnapType: "x mandatory",
                    scrollBehavior: "auto",
                    WebkitOverflowScrolling: "touch",
                    "&::-webkit-scrollbar": { display: "none" },
                }}
            >
                {section.items.map((group) => (
                    <Box
                        key={group.name}
                        sx={{
                            flex: "0 0 auto",
                            scrollSnapAlign: "start",
                            mb: 0.5,
                        }}
                    >
                        <MenuItemCardHorizontal
                            group={group}
                            onSelect={handleOpenPopup}
                            isBestSellerBlock={section.isBestSellerBlock}
                            handleRemoveItemFromCart={handleRemoveItemFromCart}
                            handleAddToCart={handleAddToCart}
                            handleChangeQuantity={handleChangeQuantity}
                            cartItems={cartItems}
                            isAdmin={isAdmin}
                        />
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
