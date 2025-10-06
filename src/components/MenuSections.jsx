import { Box } from "@mui/material";
import SectionRow from "./SectionRow";

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
                                     }) {
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
