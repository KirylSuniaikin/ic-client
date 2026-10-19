import { Box, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import React from "react";
import { BRAND_RED } from "../../../shared/utils/theme";

// The card form's loading state (owner, 19 Oct 2026: "something funnier, like connecting dough
// with sauce"). A dough ball and a sauce drop reach for each other while the secure session
// loads. Drawn inline in SVG over CSS keyframes, like DeliveryRideAnimation, so it adds no Lottie
// file and no dependency.

const CYCLE = "2.4s";
const DOUGH_KEYFRAMES = "doughSauceDough";
const SAUCE_KEYFRAMES = "doughSauceSauce";
const LINK_KEYFRAMES = "doughSauceLink";
const DOT_KEYFRAMES = "doughSauceDot";
const HEART_KEYFRAMES = "doughSauceHeart";

const INK = "#3b352c";

// transform-box lets each shape squash about its own centre rather than the SVG's origin.
const LOADER_SX = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 1,
    "& svg *": { transformBox: "fill-box", transformOrigin: "center" },
    [`@keyframes ${DOUGH_KEYFRAMES}`]: {
        "0%, 35%": { transform: "translateX(0) scale(1)" },
        "52%": { transform: "translateX(12px) scale(1)" },
        "58%": { transform: "translateX(11px) scale(0.94, 1.06)" },
        "66%": { transform: "translateX(12px) scale(1)" },
        "90%, 100%": { transform: "translateX(0) scale(1)" },
    },
    [`@keyframes ${SAUCE_KEYFRAMES}`]: {
        "0%, 35%": { transform: "translateX(0) scale(1)" },
        "52%": { transform: "translateX(-12px) scale(1)" },
        "58%": { transform: "translateX(-11px) scale(0.94, 1.06)" },
        "66%": { transform: "translateX(-12px) scale(1)" },
        "90%, 100%": { transform: "translateX(0) scale(1)" },
    },
    [`@keyframes ${LINK_KEYFRAMES}`]: {
        "0%, 35%": { opacity: 1 },
        "45%, 85%": { opacity: 0 },
        "95%, 100%": { opacity: 1 },
    },
    [`@keyframes ${DOT_KEYFRAMES}`]: {
        "0%, 100%": { opacity: 0.35 },
        "50%": { opacity: 1 },
    },
    [`@keyframes ${HEART_KEYFRAMES}`]: {
        "0%, 52%": { opacity: 0, transform: "translateY(6px) scale(0.4)" },
        "62%": { opacity: 1, transform: "translateY(0) scale(1)" },
        "80%, 100%": { opacity: 0, transform: "translateY(-8px) scale(1)" },
    },
    "& .dough": { animation: `${DOUGH_KEYFRAMES} ${CYCLE} ease-in-out infinite` },
    "& .sauce": { animation: `${SAUCE_KEYFRAMES} ${CYCLE} ease-in-out infinite` },
    "& .link": { animation: `${LINK_KEYFRAMES} ${CYCLE} ease-in-out infinite` },
    "& .link circle": { animation: `${DOT_KEYFRAMES} 0.8s ease-in-out infinite` },
    "& .link circle:nth-of-type(2)": { animationDelay: "0.15s" },
    "& .link circle:nth-of-type(3)": { animationDelay: "0.3s" },
    // Hidden until its keyframes pop it, so with motion off the pair simply waits, apart.
    "& .heart": { opacity: 0, animation: `${HEART_KEYFRAMES} ${CYCLE} ease-out infinite` },
    "@media (prefers-reduced-motion: reduce)": { "& svg *": { animation: "none" } },
} satisfies SxProps<Theme>;

export function DoughSauceLoader({ label }: { label: string }): React.JSX.Element {
    return (
        <Box role="status" data-testid="dough-sauce-loader" sx={LOADER_SX}>
            <svg width="160" height="84" viewBox="0 0 160 84" aria-hidden focusable="false">
                <g className="dough">
                    <circle cx="44" cy="48" r="24" fill="#F6DDAF" stroke="#E5B96E" strokeWidth="3" />
                    <circle cx="34" cy="38" r="1.6" fill="#FFF8EA" />
                    <circle cx="55" cy="58" r="1.4" fill="#FFF8EA" />
                    <circle cx="31" cy="52" r="3" fill="#F2A48A" opacity="0.6" />
                    <circle cx="57" cy="52" r="3" fill="#F2A48A" opacity="0.6" />
                    <circle cx="38" cy="45" r="2.4" fill={INK} />
                    <circle cx="50" cy="45" r="2.4" fill={INK} />
                    <path d="M39 53 Q44 58 49 53" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>
                <g className="link">
                    <circle cx="74" cy="50" r="2.6" fill="#D9CFC7" />
                    <circle cx="81" cy="50" r="2.6" fill="#D9CFC7" />
                    <circle cx="88" cy="50" r="2.6" fill="#D9CFC7" />
                </g>
                <g className="sauce">
                    <path d="M118 22 C126 34 140 44 140 56 A22 22 0 0 1 96 56 C96 44 110 34 118 22 Z" fill={BRAND_RED} />
                    <ellipse cx="106" cy="50" rx="2.5" ry="5" fill="#FFFFFF" opacity="0.35" />
                    <circle cx="112" cy="55" r="3.2" fill="#FFFFFF" />
                    <circle cx="124" cy="55" r="3.2" fill="#FFFFFF" />
                    <circle cx="112.6" cy="55.6" r="1.6" fill={INK} />
                    <circle cx="124.6" cy="55.6" r="1.6" fill={INK} />
                    <path d="M113 63 Q118 67 123 63" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" fill="none" />
                </g>
                <path
                    className="heart"
                    d="M81 30 C71 22 73 13 78 13 C80 13 81 15 81 16 C81 15 82 13 84 13 C89 13 91 22 81 30 Z"
                    fill={BRAND_RED}
                />
            </svg>
            <Typography sx={{ color: "#8a807a", textAlign: "center", textWrap: "balance" }}>{label}</Typography>
        </Box>
    );
}
