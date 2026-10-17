import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Box,
    Typography,
    Button,
    IconButton,
} from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {useLocalizedItem} from "../../../../../shared/hooks/useLocalizedItem";
import {useDesktopLayout} from "../../../../../shared/hooks/useDesktopLayout";
import {DESKTOP_DIALOG_MAX_HEIGHT, DESKTOP_DIALOG_RADIUS, DESKTOP_DIALOG_SHADOW} from "../ItemPopupShell";
import type { MenuItem } from '../../../types';

const brandRed = "#E44B4C";

// Centred inside the fixed overlay, which (not a Modal) is what keeps the editor above the combo popup.
const EDITOR_DESKTOP_SHEET_SX: SxProps<Theme> = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "min(720px, 92vw)",
    maxHeight: DESKTOP_DIALOG_MAX_HEIGHT,
    p: 3,
    bgcolor: "#fff",
    borderRadius: DESKTOP_DIALOG_RADIUS,
    boxShadow: DESKTOP_DIALOG_SHADOW,
    display: "flex",
    flexDirection: "column",
};

interface EditorSaveResult {
    item: MenuItem;
    size: string;
    dough: string;
    crust: string;
}

interface ItemEditorPopupProps {
    open: boolean;
    onClose: () => void;
    items: MenuItem[];
    size?: string;
    onSave: (result: EditorSaveResult) => void;
    target?: string | null;
    dough?: string;
    crust?: string;
    initialItem?: MenuItem | null;
}

function ItemEditorPopup({ open, onClose, items, size, onSave, target, dough: initialDough, crust: initialCrust, initialItem }: ItemEditorPopupProps): JSX.Element | null {
    const { t } = useTranslation("menu");
    const { t: tAuth } = useTranslation("customerAuth");
    const {name: localizeName} = useLocalizedItem();
    const isDesktop = useDesktopLayout();
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(initialItem || items[0]);

    function handleConfirm(): void {
        if (!selectedItem) return;
        onSave({
            item: selectedItem,
            size: size ?? "",
            dough: initialDough? initialDough: "Traditional",
            crust: initialCrust ? initialCrust : "Classic Crust",
        });
        onClose();
    }

    if (!open) return null;

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 2000,
                backdropFilter: "blur(6px)",
                backgroundColor: "rgba(0,0,0,0.3)",
            }}
            onClick={onClose}
        >
            <Box
                sx={isDesktop ? EDITOR_DESKTOP_SHEET_SX : {
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 2,
                    width: "100%",
                    maxHeight: "85vh",
                    bgcolor: "#fff",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    display: "flex",
                    flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <IconButton
                    onClick={onClose}
                    aria-label={isDesktop ? tAuth("login.close") : undefined}
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        color: "#666",
                    }}
                >
                    <CloseIcon />
                </IconButton>

                <Box
                    sx={{
                        display: "grid",
                        gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr 1fr",
                        gap: 1,
                        flex: 1,
                        overflowY: "auto",
                        mt: 4,
                        pb: 2,
                    }}
                >
                    {items.map((it) => {
                        const isSelected = selectedItem?.id === it.id;

                        return (
                            <Box
                                key={it.id}
                                onClick={() => setSelectedItem(it)}
                                sx={{
                                    border: isSelected ? `2px solid ${brandRed}` : "1px solid #eee",
                                    borderRadius: 3,
                                    p: 1,
                                    textAlign: "center",
                                    cursor: "pointer",
                                }}
                            >
                                <Box
                                    component="img"
                                    src={it.photo}
                                    alt={localizeName(it)}
                                    sx={{
                                        width: "100%",
                                        height: "auto",
                                        maxWidth: isDesktop ? "100%" : { xs: 320, sm: 800, md: 900, lg: 1000 },
                                        maxHeight: isDesktop ? 180 : { xs: 320, sm: 600, md: 400, lg: 480 },
                                        objectFit: "contain",
                                        display: "block",
                                        mx: "auto",
                                        mb: 2,
                                    }}
                                />
                                    <Typography sx={{ mt: 1, fontWeight: 500 }}>
                                        {localizeName(it)}
                                    </Typography>
                            </Box>
                        );
                    })}
                </Box>

                <Button
                    fullWidth
                    variant="contained"
                    sx={{
                        backgroundColor: brandRed,
                        color: "#fff",
                        textTransform: "none",
                        fontSize: "20px",
                        borderRadius: 8,
                        flex: 1,
                        minHeight: 60,
                        height: "100%",
                        "&:hover": {
                        backgroundColor: "#d23f40"
                    }
                    }}
                    onClick={handleConfirm}
                >
                    {t("itemEditor.add")}
                </Button>
            </Box>
        </Box>
    );
}

export default ItemEditorPopup;
