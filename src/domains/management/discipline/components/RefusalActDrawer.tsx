import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Drawer, MenuItem, TextField, Typography } from "@mui/material";
import { staffDisplayName } from "../../../../shared/utils/staffName";
import { StaffRoles } from "../../../auth/types";
import { BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX } from "../../_shared/components/roundedSelect";
import { SHEET_MENU_PROPS, SHEET_Z_INDEX } from "../../_shared/components/ResponsiveSheet";
import type { StaffAdminTO } from "../../staff/types";
import type { RefusalActRequest } from "../types";

export type RefusalActDrawerProps = {
    open: boolean;
    employeeId: number;
    roster: ReadonlyArray<StaffAdminTO>;
    onSubmit: (request: RefusalActRequest) => Promise<void>;
    onClose: () => void;
};

const CHIEF_ROLES: ReadonlyArray<StaffRoles> = [StaffRoles.MANAGER, StaffRoles.SUPER_MANAGER, StaffRoles.OWNER];
const GM_ROLES: ReadonlyArray<StaffRoles> = [StaffRoles.SUPER_MANAGER, StaffRoles.OWNER];

const RefusalActDrawer: React.FC<RefusalActDrawerProps> = ({ open, employeeId, roster, onSubmit, onClose }) => {
    const [chiefId, setChiefId] = useState<string>("");
    const [gmId, setGmId] = useState<string>("");
    const [busy, setBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setChiefId("");
            setGmId("");
            setError(null);
        }
    }, [open]);

    const chiefs = useMemo(
        () => roster.filter((s) => s.enabled && s.id !== employeeId && CHIEF_ROLES.includes(s.role)),
        [roster, employeeId],
    );
    const gms = useMemo(
        () => roster.filter(
            (s) => s.enabled && s.id !== employeeId && GM_ROLES.includes(s.role) && String(s.id) !== chiefId,
        ),
        [roster, employeeId, chiefId],
    );

    const submit = async (): Promise<void> => {
        setBusy(true);
        setError(null);
        try {
            await onSubmit({ shiftChiefStaffId: Number(chiefId), gmStaffId: Number(gmId) });
            onClose();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    };

    const options = (list: ReadonlyArray<StaffAdminTO>): React.JSX.Element[] =>
        list.map((s) => <MenuItem key={s.id} value={String(s.id)}>{staffDisplayName(s)}</MenuItem>);

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={busy ? undefined : onClose}
            sx={{ zIndex: SHEET_Z_INDEX }}
            PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxWidth: { sm: 500 }, mx: { sm: "auto" } } }}
        >
            <Box data-testid="refusal-act-drawer" sx={{ p: 3, pb: 4 }}>
                <Box sx={{ width: 40, height: 4, bgcolor: "grey.300", borderRadius: 2, mx: "auto", mb: 2 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 2 }}>Record refusal to sign</Typography>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label="Shift chief"
                    value={chiefId}
                    onChange={(e) => {
                        setChiefId(e.target.value);
                        if (e.target.value === gmId) setGmId("");
                    }}
                    SelectProps={{ MenuProps: SHEET_MENU_PROPS }}
                    sx={{ mb: 2, ...ROUNDED_FIELD_SX }}
                >
                    {options(chiefs)}
                </TextField>
                <TextField
                    select
                    fullWidth
                    size="small"
                    label="General Manager / Owner"
                    value={gmId}
                    onChange={(e) => setGmId(e.target.value)}
                    SelectProps={{ MenuProps: SHEET_MENU_PROPS }}
                    sx={ROUNDED_FIELD_SX}
                >
                    {options(gms)}
                </TextField>
                {error !== null && (
                    <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
                        {error}
                    </Typography>
                )}
                <Box sx={{ display: "flex", gap: 1, mt: 2 }}>
                    <Button
                        variant="contained"
                        sx={BRAND_BUTTON_SX}
                        disabled={chiefId === "" || gmId === "" || busy}
                        onClick={() => void submit()}
                    >
                        Record refusal
                    </Button>
                    <Button sx={NEUTRAL_BUTTON_SX} disabled={busy} onClick={onClose}>Close</Button>
                </Box>
            </Box>
        </Drawer>
    );
};

export default RefusalActDrawer;
