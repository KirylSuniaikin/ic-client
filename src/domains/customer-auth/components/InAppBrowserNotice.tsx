import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, IconButton, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import OpenInBrowserRoundedIcon from "@mui/icons-material/OpenInBrowserRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { BRAND_RED } from "../../../shared/utils/theme";
import { externalBrowserUrl, instagramInAppPlatform } from "../../../shared/utils/inAppBrowser";
import { logger } from "../../../shared/utils/logger";

// Per tab session, not for good: a customer who closes it today should still be asked on the next
// visit, which — inside Instagram — is exactly when they will have been signed out again.
export const IN_APP_BROWSER_NOTICE_DISMISSED_KEY = "icpizza.inAppBrowserNoticeDismissed";

const TEXT_PRIMARY = "#3b352c";
const TEXT_SECONDARY = "#8a807a";
const ICON_SIZE = 32;
const GAP_PX = 10;
// Below this the title would wrap word by word beside the button, so the button wraps instead.
// Small enough that both labels still fit beside the title on a 390 px phone.
const TITLE_MIN_WIDTH_PX = 120;

// The storefront's section card (white on the cream ground, hairline, 16 px corners), with tighter
// padding: it sits above the hero and every pixel of it pushes the menu down.
const CARD_SX = {
    mx: 1.5,
    my: 1.25,
    px: 1.5,
    py: 1.25,
    backgroundColor: "#fff",
    border: "1px solid #f1eae4",
    borderRadius: 4,
    boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
} satisfies SxProps<Theme>;

// The storefront's primary pill, sized down to sit inline with the title.
const CTA_SX = {
    flexShrink: 0,
    px: 1.75,
    py: 0.75,
    borderRadius: 999,
    backgroundColor: BRAND_RED,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.2,
    textTransform: "none",
    whiteSpace: "nowrap",
    boxShadow: "none",
    "&:hover": { backgroundColor: BRAND_RED, boxShadow: "none", filter: "brightness(0.94)" },
} satisfies SxProps<Theme>;

function readDismissed(): boolean {
    try {
        return window.sessionStorage.getItem(IN_APP_BROWSER_NOTICE_DISMISSED_KEY) === "1";
    } catch (err) {
        // Blocked storage (private mode, a locked-down webview) must not hide the notice for good.
        logger.warn("In-app browser notice: session storage unreadable, showing the notice:", err);
        return false;
    }
}

function persistDismissed(): void {
    try {
        window.sessionStorage.setItem(IN_APP_BROWSER_NOTICE_DISMISSED_KEY, "1");
    } catch (err) {
        logger.warn("In-app browser notice: session storage unwritable, dismissed until reload only:", err);
    }
}

/**
 * Asks a customer browsing inside Instagram to reopen the site in Safari or Chrome, where they
 * stay signed in. Renders nothing in any other browser. See shared/utils/inAppBrowser.ts.
 */
export function InAppBrowserNotice(): JSX.Element | null {
    const { t } = useTranslation("inAppBrowser");
    const titleId = useId();
    const platform = useMemo(() => instagramInAppPlatform(navigator.userAgent), []);
    const [dismissed, setDismissed] = useState<boolean>(() => platform !== null && readDismissed());

    if (platform === null || dismissed) return null;

    function handleDismiss(): void {
        persistDismissed();
        setDismissed(true);
    }

    return (
        <Box component="aside" aria-labelledby={titleId} data-testid="in-app-browser-notice" data-platform={platform} sx={CARD_SX}>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: `${GAP_PX}px` }}>
                <Box
                    aria-hidden="true"
                    sx={{
                        width: ICON_SIZE,
                        height: ICON_SIZE,
                        flexShrink: 0,
                        borderRadius: "50%",
                        backgroundColor: "#FCE9E9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <OpenInBrowserRoundedIcon sx={{ color: BRAND_RED, fontSize: 18 }} />
                </Box>
                {/* The button sits beside the title while the title keeps a readable width, and
                    wraps under it on narrower phones instead of squeezing it into a column. */}
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: `${GAP_PX}px`, rowGap: 0.75 }}>
                    <Typography
                        id={titleId}
                        sx={{ flex: `1 1 ${TITLE_MIN_WIDTH_PX}px`, minHeight: ICON_SIZE, display: "flex", alignItems: "center", fontSize: 14, fontWeight: 700, lineHeight: 1.3, color: TEXT_PRIMARY }}
                    >
                        {t(`${platform}.title`)}
                    </Typography>
                    {/* A real link rather than a scripted redirect: the hand-off then rides on the
                        customer's own tap, which in-app webviews are least inclined to refuse. */}
                    <Button component="a" href={externalBrowserUrl(platform, window.location)} disableElevation sx={CTA_SX}>
                        {t(`${platform}.button`)}
                    </Button>
                    {platform === "ios" && (
                        <Typography sx={{ flexBasis: "100%", fontSize: 12, lineHeight: 1.35, color: TEXT_SECONDARY }}>
                            {t("ios.hint")}
                        </Typography>
                    )}
                </Box>
                <IconButton aria-label={t("dismiss")} onClick={handleDismiss} size="small" sx={{ p: 0.5, mt: 0.25, mr: -0.75, color: TEXT_SECONDARY }}>
                    <CloseRoundedIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>
        </Box>
    );
}
