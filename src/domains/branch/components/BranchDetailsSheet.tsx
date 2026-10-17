import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Drawer, IconButton } from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { SHEET_PAPER_SX, SheetHandle } from "../../delivery/components/sheetStyles";
import { BranchDetailsContent } from "./BranchDetailsContent";
import type { CartItem } from "../../menu/types";
import type { IBranch } from "../../management/inventory/types";

export interface BranchDetailsSheetProps {
    /** Null keeps the sheet shut; a branch opens it and is what the details describe. */
    branch: IBranch | null;
    /** Drives the availability line. Pass the live cart — an empty one hides that line entirely. */
    cartItems: CartItem[];
    /** From the picker's resolved location; null or undefined hides the distance line. */
    distanceKm?: number | null;
    onClose: () => void;
    /** "Order here" — the branch is only chosen at this point, never on the map tap itself. */
    onConfirm: (branch: IBranch) => void;
}

/**
 * The sheet between tapping a branch and choosing it.
 *
 * Tapping a pin used to select the branch outright, which gave the customer nothing to decide
 * with — and, mid-session with a full cart, dropped them straight onto a cart-loss warning. This
 * shows what they are picking first: what it looks like (its photos, when it has any), where it
 * is, whether it is open and when it reopens, how to get there, and whether their cart survives
 * the move.
 *
 * It only reports. Choosing still runs the caller's existing flow, so the cart-loss confirmation
 * stays exactly where it was — this sheet warns, it does not consent on the customer's behalf.
 *
 * The phone wrapper only: the content itself is BranchDetailsContent, which the PC picker shows
 * as a column instead.
 */
export function BranchDetailsSheet({ branch, cartItems, distanceKm, onClose, onConfirm }: BranchDetailsSheetProps): JSX.Element {
    const { t } = useTranslation("branch");

    // Keeps describing the last branch while the Drawer slides shut, instead of going blank.
    const [shown, setShown] = useState<IBranch | null>(branch);
    if (branch !== null && branch !== shown) setShown(branch);

    return (
        <Drawer
            anchor="bottom"
            open={branch !== null}
            onClose={onClose}
            // This sheet is opened from INSIDE BranchPickerDrawer, i.e. one MUI Drawer on top of
            // another. MUI does not raise a nested modal: ModalManager only manages `aria-hidden`
            // and the scroll lock, never z-index. The picker sits at theme.zIndex.modal + 1 (1301)
            // so it clears the cart Modal it can be opened from, and this sheet must stay above
            // that. The rest of this app never leaves stacking to chance — CashInputDrawer,
            // UnpaidInvoicesDrawer, BanCstmrDrawer and ShiftPopup all declare 1350 for exactly
            // this reason.
            sx={{ zIndex: 1350 }}
            PaperProps={{ sx: SHEET_PAPER_SX }}
        >
            <Box sx={{ position: "relative", p: 3, pb: "calc(32px + env(safe-area-inset-bottom))", overflowY: "auto" }}>
                <SheetHandle />
                <IconButton
                    size="small"
                    aria-label={t("picker.close")}
                    onClick={onClose}
                    sx={{ position: "absolute", top: 8, right: 8, bgcolor: "#f4ede8", color: "#3b352c", "&:hover": { bgcolor: "#ece3dd" } }}
                >
                    <CloseRoundedIcon sx={{ fontSize: 20 }} />
                </IconButton>
                {/* MUI unmounts these children once the exit transition ends, so reopening
                    mounts the content again: one fetch per open. */}
                {shown !== null && (
                    <BranchDetailsContent
                        key={shown.id}
                        branch={shown}
                        cartItems={cartItems}
                        distanceKm={distanceKm}
                        layout="sheet"
                        onConfirm={onConfirm}
                    />
                )}
            </Box>
        </Drawer>
    );
}
