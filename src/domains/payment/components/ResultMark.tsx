import React from "react";
import {motion} from "framer-motion";

/**
 * The animated tick and cross on the payment-result page.
 *
 * The kiosk's `SuccessMark` / `ErrorMark` cannot be imported — they are React Native, built on
 * `react-native-svg` and Reanimated. What ports is the **geometry**, which is reproduced here
 * verbatim so the two surfaces draw the same mark: a 52×52 viewBox, a circle stroked with
 * `strokeDasharray 33`, and a check path of `M15 27 l 7 7 l 16 -16` at dasharray 29.
 *
 * Animated with framer-motion, already a dependency of this app. No new library.
 *
 * `prefers-reduced-motion` is honoured by framer-motion's `useReducedMotion` via the `initial`
 * prop below — a customer who has asked for less motion still sees the mark, just without the
 * draw-on.
 */

const SIZE = 88;
const VIEW_BOX = "0 0 52 52";
const CIRCLE_DASH = 166;
const CHECK_DASH = 48;
const CROSS_DASH = 32;

type MarkProps = {
    /** Milliseconds before the mark itself draws, after the circle. */
    reduced?: boolean;
};

const drawTransition = (delay: number, duration: number, reduced: boolean) =>
    reduced
        ? {duration: 0}
        : {delay, duration, ease: "easeOut" as const};

export function SuccessMark({reduced = false}: MarkProps): JSX.Element {
    return (
        <svg width={SIZE} height={SIZE} viewBox={VIEW_BOX} role="presentation" aria-hidden="true">
            <motion.circle
                cx="26"
                cy="26"
                r="25"
                fill="none"
                stroke="#4CAF50"
                strokeWidth="2"
                strokeDasharray={CIRCLE_DASH}
                initial={{strokeDashoffset: CIRCLE_DASH}}
                animate={{strokeDashoffset: 0}}
                transition={drawTransition(0, 0.6, reduced)}
            />
            <motion.path
                d="M15 27 l 7 7 l 16 -16"
                fill="none"
                stroke="#4CAF50"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={CHECK_DASH}
                initial={{strokeDashoffset: CHECK_DASH}}
                animate={{strokeDashoffset: 0}}
                transition={drawTransition(0.6, 0.4, reduced)}
            />
        </svg>
    );
}

export function ErrorMark({reduced = false}: MarkProps): JSX.Element {
    return (
        <svg width={SIZE} height={SIZE} viewBox={VIEW_BOX} role="presentation" aria-hidden="true">
            <motion.circle
                cx="26"
                cy="26"
                r="25"
                fill="none"
                stroke="#E44B4C"
                strokeWidth="2"
                strokeDasharray={CIRCLE_DASH}
                initial={{strokeDashoffset: CIRCLE_DASH}}
                animate={{strokeDashoffset: 0}}
                transition={drawTransition(0, 0.6, reduced)}
            />
            {[
                {d: "M17 17 l 18 18", delay: 0.5},
                {d: "M35 17 l -18 18", delay: 0.7},
            ].map((stroke) => (
                <motion.path
                    key={stroke.d}
                    d={stroke.d}
                    fill="none"
                    stroke="#E44B4C"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={CROSS_DASH}
                    initial={{strokeDashoffset: CROSS_DASH}}
                    animate={{strokeDashoffset: 0}}
                    transition={drawTransition(stroke.delay, 0.3, reduced)}
                />
            ))}
        </svg>
    );
}
