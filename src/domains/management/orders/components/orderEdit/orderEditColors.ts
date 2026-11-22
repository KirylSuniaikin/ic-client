/**
 * The editor's palette, from DESIGN.md (sheet text, hairline, disabled CTA) and the order card
 * (the beige an open category shares with the board's buttons). The added/removed pairs are the
 * spec's §4.7 values: dark text on a light tint, both above 4.5:1, and never the only signal —
 * every use also carries an icon or the words ADDED/REMOVED.
 */
export const EDIT_COLORS = {
    text: "#3b352c",
    hairline: "#f1eae4",
    openHeader: "#FCF4DD",
    disabledCta: "#e9dedb",
    badgeBg: "#FCE9E9",
    badgeText: "#8F2627",
    addedText: "#145C31",
    addedBg: "#E7F6EC",
    removedText: "#8F2627",
    removedBg: "#FDECEA",
} as const;
