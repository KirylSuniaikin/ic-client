import { Box } from "@mui/material";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useLayoutEffect, useState } from "react";
import MenuItemCardHorizontal from "./MenuItemCardHorizontal";
import {TextGroup} from "../utils/typography";

export default function SectionRow({
                                       section,
                                       idx,
                                       isLast,
                                       bestRef,
                                       handleOpenPopup,
                                       handleRemoveItemFromCart,
                                       handleAddToCart,
                                       handleChangeQuantity,
                                       cartItems
                                   }) {
    const containerRef = useRef(null);
    // const scrollRef = useRef(null);
    // const [isScrollable, setIsScrollable] = useState(false);

    // Проверяем, длиннее ли контент ширины экрана
    // useLayoutEffect(() => {
    //     const el = scrollRef.current;
    //     if (el) setIsScrollable(el.scrollWidth > window.innerWidth + 20);
    // }, [section.items]);

    // Привязываем движение к вертикальному скроллу
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"],
    });

    // Смещение только если ряд длиннее экрана
    // const shift = isScrollable ? `${12 + idx * 8}%` : "0%";
    const x = useTransform(scrollYProgress, [0, 1], [`${15 - idx * 2}%`, `-${15 - idx * 2}%`]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.9, 1, 1, 0.9]);

    return (
        <Box ref={containerRef} sx={{ pb: isLast ? 1 : 4 }}>
            <TextGroup sx={{ px: 1.5, pb: 1 }}>{section.title}</TextGroup>

            {/* motion.div — просто слой движения, не ломает scroll */}
            <motion.div style={{ x, opacity }}>
                <Box
                    // ref={scrollRef}
                    sx={{
                        display: "flex",
                        overflowX: "auto",
                        px: 1,
                        scrollSnapType: "x mandatory",
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
                            />
                        </Box>
                    ))}
                </Box>
            </motion.div>
        </Box>
    );
}
