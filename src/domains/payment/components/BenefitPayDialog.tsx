import React, {useEffect, useRef, useState} from "react";
import {Box, CircularProgress, Dialog, DialogContent, IconButton, Typography} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {useTranslation} from "react-i18next";

import {openBenefitPayWidget} from "../openBenefitPayWidget";
import type {BenefitPaySession} from "../types";
import {logger} from "../../../shared/utils/logger";

const BRAND_RED = "#E44B4C";

/** The id the vendor SDK gives its injected container. */
const WIDGET_NODE_ID = "b_p";

/** How long to wait for the SDK to inject its node before giving up on relocating it. */
const RELOCATE_TIMEOUT_MS = 4000;

export type BenefitPayDialogProps = {
    open: boolean;
    session: BenefitPaySession | null;
    /** Called once the customer finishes or dismisses. `completed` says nothing about payment. */
    onFinished: (completed: boolean) => void;
    onClose: () => void;
};

/**
 * Shows BenefitPay's QR inside our own dialog.
 *
 * <h2>This works against the SDK, on purpose</h2>
 * `InApp.min.js` appends a fixed-position container to `<html>` — outside React's tree, above
 * everything, styled by the vendor. Containing it means waiting for that node to appear and moving
 * it into this dialog.
 *
 * <p>That is deliberately fragile in one direction only: if the node never appears, or the vendor
 * renames it in a future build, the widget is simply left where the SDK put it and the customer can
 * still pay. A failed relocation must never cost a payment, so nothing here throws and nothing
 * blocks on it.
 *
 * <h2>The QR is not the outcome</h2>
 * Scanning it does not tell us anything. The guide is explicit that a successful widget operation
 * does not indicate a successful payment, so `onFinished` only reports that the customer is done —
 * the server decides what actually happened by asking check-status.
 */
export function BenefitPayDialog(props: BenefitPayDialogProps): JSX.Element {
    const {open, session, onFinished, onClose} = props;
    const {t} = useTranslation("payment");
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [contained, setContained] = useState(false);
    const openedFor = useRef<string | null>(null);

    useEffect(() => {
        if (!open || session == null) return;
        // One widget per attempt: React may re-run this effect, and opening twice would leave two
        // iframes racing for the same reference.
        if (openedFor.current === session.reference) return;
        openedFor.current = session.reference;

        setContained(false);

        const observer = relocateWhenInjected(hostRef, () => setContained(true));

        void openBenefitPayWidget(session)
            .then((outcome) => onFinished(outcome.completed))
            .catch((error: unknown) => {
                // Loading the vendor script can fail (offline, blocked, 404). The order is already
                // recorded server-side, so this is a dead end for the widget, not for the payment.
                logger.error("Could not open the BenefitPay widget:", error);
                onFinished(false);
            })
            .finally(() => observer.disconnect());

        return () => observer.disconnect();
    }, [open, session, onFinished]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
                PaperProps={{sx: {borderRadius: 3, overflow: "hidden"}}}>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", px: 2, pt: 2}}>
                <Typography sx={{fontWeight: 700}}>{t("wallet.title")}</Typography>
                <IconButton aria-label={t("wallet.close")} onClick={onClose} size="small">
                    <CloseIcon fontSize="small"/>
                </IconButton>
            </Box>

            <DialogContent sx={{pt: 1}}>
                <Typography variant="body2" sx={{color: "text.secondary", mb: 2}}>
                    {t("wallet.instruction")}
                </Typography>

                {/* Where the vendor node is moved to, when it can be. */}
                <Box ref={hostRef} sx={{minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center"}}>
                    {!contained && <CircularProgress sx={{color: BRAND_RED}}/>}
                </Box>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Watches for the SDK's injected node and moves it into our dialog.
 *
 * <p>A {@link MutationObserver} rather than a poll because the node appears once, at a moment the
 * SDK owns. Gives up quietly after a few seconds: by then the widget is on screen somewhere and
 * usable, and interfering further would risk breaking it.
 */
function relocateWhenInjected(
    hostRef: React.MutableRefObject<HTMLDivElement | null>,
    onContained: () => void,
): MutationObserver {
    const observer = new MutationObserver(() => {
        const node = document.getElementById(WIDGET_NODE_ID);
        const host = hostRef.current;
        if (node == null || host == null || node.parentElement === host) return;

        try {
            host.appendChild(node);
            // The vendor styles it fixed and full-screen so it can overlay the page; inside our
            // dialog it has to lie flat in the box instead.
            node.style.position = "static";
            node.style.width = "100%";
            node.style.height = "320px";
            onContained();
        } catch (error) {
            // Leave it where the SDK put it — still visible, still payable.
            logger.error("Could not contain the BenefitPay widget; leaving it in place:", error);
        }
        observer.disconnect();
    });

    observer.observe(document.documentElement, {childList: true, subtree: true});
    window.setTimeout(() => observer.disconnect(), RELOCATE_TIMEOUT_MS);
    return observer;
}
