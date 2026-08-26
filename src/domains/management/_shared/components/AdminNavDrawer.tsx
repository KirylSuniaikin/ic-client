import { Box, Divider, Drawer, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LogoutIcon from "@mui/icons-material/Logout";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { StaffRoles } from "../../../auth/types";
import type { StaffRoles as StaffRolesType } from "../../../auth/types";
import { ShiftButton } from "../../shift/components/ShiftButton";
import { buildAdminNavSections } from "./adminNavItems";
import type { AdminNavHandlers } from "./adminNavItems";
import type { AdminTabKey } from "../hooks/useAdminUIState";

const colorRed = "#E44B4C";

export type AdminNavDrawerProps = {
    open: boolean;
    onClose: () => void;
    role: StaffRolesType | null;
    userName: string;
    cashStage: string;
    shiftStage: string;
    onCashClick: (stage?: string) => void;
    onShiftStageClick: (stage?: string) => void;
    getCashStage: (stage: string) => string;
    getShiftStage: (stage: string) => string;
    handlers: AdminNavHandlers;
    activeTab: AdminTabKey;
};

export default function AdminNavDrawer({
                                            open,
                                            onClose,
                                            role,
                                            userName,
                                            cashStage,
                                            shiftStage,
                                            onCashClick,
                                            onShiftStageClick,
                                            getCashStage,
                                            getShiftStage,
                                            handlers,
                                            activeTab,
                                        }: AdminNavDrawerProps): JSX.Element {
    const isReviewer = role === StaffRoles.REVIEWER;
    const sections = buildAdminNavSections(role, handlers, activeTab);

    // Assumed: every row in the drawer — including the promoted Cash/Shift buttons — closes the
    // drawer before firing its action (per the "every row closes the drawer, then invokes its
    // handler" acceptance criterion). The desktop ShiftButton wiring at AdminTopbar.tsx:292-302
    // is reused only for the stage/getStage props, not the raw unwrapped onClick.
    const closeThenRun = (action: () => void) => (): void => {
        onClose();
        action();
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            sx={{zIndex: 1340}}
            PaperProps={{
                sx: {
                    width: "min(320px, 85vw)",
                    height: "100%",
                    overflowY: "auto",
                    pb: "calc(16px + env(safe-area-inset-bottom))",
                },
            }}
        >
            <Box
                sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    p: 2,
                    borderBottom: "1px solid #f0f0f0",
                }}
            >
                <Box sx={{display: "flex", alignItems: "center", gap: 1}}>
                    <PersonOutlineIcon sx={{fontSize: "1.2rem", color: "#555"}}/>
                    <Box>
                        <Typography
                            sx={{
                                textTransform: "capitalize",
                                fontSize: "1rem",
                                fontWeight: 500,
                                color: "#333",
                                lineHeight: 1.2,
                            }}
                        >
                            {userName}
                        </Typography>
                        {role && (
                            <Typography sx={{fontSize: "0.75rem", color: "#888", textTransform: "capitalize"}}>
                                {role}
                            </Typography>
                        )}
                    </Box>
                </Box>
                <IconButton aria-label="Close" onClick={onClose} size="small">
                    <CloseIcon fontSize="small"/>
                </IconButton>
            </Box>

            {!isReviewer && (
                <Box sx={{display: "flex", flexDirection: "column", gap: 1, p: 2}}>
                    <ShiftButton
                        onClick={closeThenRun(() => onCashClick(cashStage))}
                        stage={cashStage}
                        getStage={getCashStage}
                    />
                    <ShiftButton
                        onClick={closeThenRun(() => onShiftStageClick(shiftStage))}
                        stage={shiftStage}
                        getStage={getShiftStage}
                    />
                </Box>
            )}

            <Box sx={{display: "flex", flexDirection: "column", gap: 2, px: 2, pb: 2}}>
                {sections
                    .filter(section => section.items.length > 0)
                    .map(section => (
                        <Box key={section.title}>
                            <Typography
                                sx={{
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
                                    color: "#999",
                                    mb: 0.5,
                                    px: 1,
                                }}
                            >
                                {section.title}
                            </Typography>
                            {section.items.map(item => (
                                <Box
                                    key={item.label}
                                    onClick={closeThenRun(item.onClick)}
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        minHeight: 48,
                                        px: 1.2,
                                        borderRadius: "12px",
                                        fontSize: "0.9rem",
                                        fontWeight: 500,
                                        fontFamily: "Baloo Bhaijaan 2",
                                        color: "#333",
                                        cursor: "pointer",
                                        "&:hover": {
                                            backgroundColor: "#fff5f5",
                                        },
                                    }}
                                >
                                    <Typography sx={{fontSize: "0.9rem"}}>{item.label}</Typography>
                                    <Box sx={{display: "flex", alignItems: "center"}}>{item.icon}</Box>
                                </Box>
                            ))}
                        </Box>
                    ))}
            </Box>

            <Divider sx={{mx: 2}}/>

            <Box
                onClick={closeThenRun(handlers.logout)}
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    minHeight: 48,
                    mx: 2,
                    my: 2,
                    px: 1.2,
                    borderRadius: "12px",
                    fontWeight: 600,
                    fontFamily: "Baloo Bhaijaan 2",
                    color: colorRed,
                    cursor: "pointer",
                    "&:hover": {
                        backgroundColor: "#fff5f5",
                    },
                }}
            >
                <Typography sx={{fontSize: "0.9rem", fontWeight: 600, color: colorRed}}>Logout</Typography>
                <Box sx={{display: "flex", alignItems: "center"}}>
                    <LogoutIcon fontSize="small" sx={{color: colorRed}}/>
                </Box>
            </Box>
        </Drawer>
    );
}
