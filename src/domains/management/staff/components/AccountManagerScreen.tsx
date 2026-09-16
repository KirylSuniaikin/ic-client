import * as React from "react";
import { useEffect, useState } from "react";
import {
    Avatar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    Paper,
    Skeleton,
    Stack,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
    useMediaQuery,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ErrorSnackbar from "../../../../shared/components/ErrorSnackbar";
import theme from "../../../../shared/utils/theme";
import { logger } from "../../../../shared/utils/logger";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles } from "../../../auth/types";
import type { IBranch } from "../../inventory/types";
import { ManagementTopBar } from "../../_shared/components/ManagementTopBar";
import { ROUNDED_FIELD_SX, roundedMenuProps } from "../../_shared/components/roundedSelect";
import { useBranchScope } from "../../_shared/hooks/useBranchScope";
import { useStaffAccounts } from "../hooks/useStaffAccounts";
import { canAdministerStaff } from "../types";
import type { StaffAdminTO } from "../types";
import { fetchTelegramBotUsername, generateTelegramConnectToken } from "../../../../shared/api/management";
import { copyToClipboard } from "../utils/copyToClipboard";
import HireStaffDrawer from "./HireStaffDrawer";
import ResetPasswordDrawer from "./ResetPasswordDrawer";
import EditStaffDrawer from "./EditStaffDrawer";
import { shortStaffName, staffDisplayName } from "../../../../shared/utils/staffName";

const colorRed = "#E44B4C";
const pageBg = "#fbfaf6";
const hairline = "#efece4";
// review-feedback-D.md Issue 8: named consts beside the other palette values above, rather than
// inline literals, for the "Telegram connected" roundel -- mirrors deactivatedPill's shape.
const telegramConnectedBg = "#eefaf3";
const telegramConnectedFg = "#1f6f4a";

// A tinted pill per role, rather than one grey chip for all of them: the roster's whole job is
// telling people apart at a glance, and the role is the column a manager actually scans for.
const ROLE_TINTS: Record<string, { bg: string; fg: string }> = {
    OWNER: { bg: "#fdeaea", fg: "#b3282a" },
    SUPER_MANAGER: { bg: "#fff2e0", fg: "#9c5600" },
    MANAGER: { bg: "#e9f0fd", fg: "#1a56b8" },
    SUPERVISOR: { bg: "#f1eafc", fg: "#5b34b5" },
    REVIEWER: { bg: "#e5f5f1", fg: "#0f7060" },
    COOK: { bg: "#f2f0ea", fg: "#5a5f66" },
};

function roleTint(role: string | null): { bg: string; fg: string } {
    return (role && ROLE_TINTS[role]) || { bg: "#f2f0ea", fg: "#5a5f66" };
}

function initials(person: StaffAdminTO): string {
    const source = (person.fullName ?? person.username).trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function prettyRole(role: string | null): string {
    if (!role) return "—";
    return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export interface AccountManagerScreenProps {
    open: boolean;
    role: StaffRoles | null;
    branch: IBranch;
    onClose: () => void;
}

// Presented exactly like the other full-screen Management surfaces (InventoryPage, ShiftHomePage,
// AccountingHomePage): a fullScreen Dialog over the cream page, ManagementTopBar with a back
// arrow, the branch switcher in the bar. It stopped being a tab next to the order desk when it
// moved into the nav drawer's Management section.
export default function AccountManagerScreen({ open, role, branch, onClose }: AccountManagerScreenProps): React.JSX.Element {
    const { userId } = useAuth();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    // canSwitch is branches.length > 1, not a role check -- useAdminBranchInit already hands a
    // non-city role a one-element array, so this is the role gate for free. Same shape as
    // InventoryPage / CashRegisterPopup / HistoryComponent.
    const { branches, branch: scopedBranch, setBranch: setScopedBranch, canSwitch } = useBranchScope(branch);
    const { staff, loading, error, create, resetPassword, setEnabled, changeBranch, updatePayroll, updateDetails } = useStaffAccounts(scopedBranch.id);

    const [hireOpen, setHireOpen] = useState(false);
    const [resetTarget, setResetTarget] = useState<StaffAdminTO | null>(null);
    const [editTarget, setEditTarget] = useState<StaffAdminTO | null>(null);
    const [showDeactivated, setShowDeactivated] = useState(false);
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);
    const [botUsername, setBotUsername] = useState<string | null>(null);
    // Per-row in-flight tracking for the connect-link copy button, mirroring ResetPasswordDrawer's
    // `submitting` flag -- but keyed by staff id since several rows' buttons can be pressed
    // independently rather than one drawer at a time.
    const [connectLinkPendingIds, setConnectLinkPendingIds] = useState<ReadonlySet<number>>(new Set());

    const isOwnerViewer = role === StaffRoles.OWNER;

    // Mirror the hook's error into local snackbar state, same pattern as TaskBoardScreen.tsx.
    useEffect(() => {
        if (error) setErrorMessage(error);
    }, [error]);

    // Fetched once on mount, not per row -- every row's connect link is built from the same
    // bot username, so there is nothing row-specific to refetch.
    useEffect(() => {
        let cancelled = false;
        void (async (): Promise<void> => {
            try {
                const { botUsername: username } = await fetchTelegramBotUsername();
                if (!cancelled) setBotUsername(username);
            } catch (err) {
                if (!cancelled) logger.error("Failed to load Telegram bot username:", err);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Security fix: the link payload is now a single-use, server-generated, expiring token
    // fetched fresh per click, never the raw staff id -- staff ids are small sequential integers
    // and the bot is public, so a client-built `?start={s.id}` link let anyone hijack any staff
    // member's notification channel by guessing.
    //
    // Bug fix: this must NOT `await` the token fetch before writing to the clipboard. Several
    // browsers/WebViews only allow clipboard access within a short window tied to the original
    // click; by the time a network round-trip finishes, that window can already be gone, and the
    // write silently fails -- the manager gets no link at all, with no visible reason why. The
    // async Clipboard.write() + ClipboardItem(Promise) API exists specifically to solve this: call
    // it SYNCHRONOUSLY inside the click handler (no leading await) and let the item's data resolve
    // once the token fetch completes, without losing the write permission.
    const handleCopyConnectLink = (s: StaffAdminTO): void => {
        if (!botUsername) return;
        setConnectLinkPendingIds(prev => new Set(prev).add(s.id));

        const linkPromise = generateTelegramConnectToken(s.id).then(
            ({ token }) => `https://t.me/${botUsername}?start=${token}`
        );

        const finish = (): void => {
            setConnectLinkPendingIds(prev => {
                const next = new Set(prev);
                next.delete(s.id);
                return next;
            });
        };

        const onSuccess = (): void => setCopyToastMessage("Connect link copied");
        // The token fetch can succeed even when the clipboard write fails -- surface the actual
        // link rather than a bare error, so the manager isn't left with nothing to send manually.
        const onFailure = (err: unknown): void => {
            void linkPromise.then(
                link => setErrorMessage(`Couldn't copy automatically — here's the link to copy manually: ${link}`),
                () => {
                    logger.error("Failed to generate Telegram connect link:", err);
                    setErrorMessage(err instanceof Error ? err.message : "Failed to generate connect link");
                }
            );
        };

        // Cast: this DOM lib target doesn't declare ClipboardItem/Clipboard.write, but both are
        // broadly supported (Chrome, Safari 13.1+, most Android/iOS WebViews) -- feature-detected
        // via `in` before use, not assumed.
        const clipboard = navigator.clipboard as Clipboard & { write?: (items: unknown[]) => Promise<void> };
        if (typeof window !== "undefined" && "ClipboardItem" in window && typeof clipboard.write === "function") {
            const ClipboardItemCtor = (window as unknown as { ClipboardItem: new (items: Record<string, Promise<Blob>>) => unknown }).ClipboardItem;
            const blobPromise = linkPromise.then(link => new Blob([link], { type: "text/plain" }));
            const item = new ClipboardItemCtor({ "text/plain": blobPromise });
            clipboard.write([item]).then(onSuccess, onFailure).finally(finish);
            return;
        }

        // No Promise-based Clipboard.write support -- fall back to the previous await-then-copy
        // path (still best-effort on those browsers, same as before this fix).
        void linkPromise.then(link => copyToClipboard(link)).then(onSuccess, onFailure).finally(finish);
    };

    // Filtered here rather than server-side: the roster is one branch's staff, the caller may
    // already see every row, and toggling the filter then costs no refetch that could race the
    // branch selector.
    const byState = showDeactivated ? staff : staff.filter(s => s.enabled);
    const visibleStaff = roleFilter === "ALL" ? byState : byState.filter(s => s.role === roleFilter);
    const deactivatedCount = staff.filter(s => !s.enabled).length;
    const isEmpty = !loading && visibleStaff.length === 0;
    // Only roles actually on this branch, so the filter can never select an empty roster.
    const rolesPresent = Array.from(new Set(staff.map(s => s.role).filter((r): r is StaffRoles => r !== null))).sort();

    const iconButtonSx = {
        border: `1px solid ${hairline}`,
        borderRadius: "10px",
        color: "#6b7079",
        backgroundColor: "#fff",
        "&:hover": { backgroundColor: "#fff5f5", borderColor: colorRed, color: colorRed },
    } as const;

    // Always visible rather than revealed on hover: the admin surface runs on kitchen tablets,
    // where there is no hover and a hidden control is an unreachable one.
    const rowActions = (s: StaffAdminTO): React.JSX.Element => (
        <Stack direction="row" spacing={0.75} justifyContent="flex-end">
            <Tooltip title="Edit">
                <IconButton
                    size="small"
                    aria-label="Edit"
                    onClick={() => setEditTarget(s)}
                    data-testid={`staff-edit-${s.id}`}
                    sx={iconButtonSx}
                >
                    <EditOutlinedIcon fontSize="small" />
                </IconButton>
            </Tooltip>
            <Tooltip title="Reset password">
                <IconButton
                    size="small"
                    aria-label="Reset password"
                    onClick={() => setResetTarget(s)}
                    data-testid={`staff-reset-${s.id}`}
                    sx={iconButtonSx}
                >
                    <LockResetIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
    );

    const identity = (s: StaffAdminTO): React.JSX.Element => {
        const tint = roleTint(s.role);
        return (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                <Avatar
                    sx={{
                        width: 38,
                        height: 38,
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        bgcolor: tint.bg,
                        color: tint.fg,
                    }}
                >
                    {initials(s)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: "0.95rem", color: "#1f2430", lineHeight: 1.3 }} noWrap>
                        {shortStaffName(staffDisplayName(s))}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8rem", color: "#8a8f98" }} noWrap>
                        {s.username}
                    </Typography>
                </Box>
            </Stack>
        );
    };

    const rolePill = (s: StaffAdminTO): React.JSX.Element => {
        const tint = roleTint(s.role);
        return (
            <Box
                component="span"
                sx={{
                    display: "inline-block",
                    px: 1.25,
                    py: 0.35,
                    borderRadius: "999px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    backgroundColor: tint.bg,
                    color: tint.fg,
                    whiteSpace: "nowrap",
                }}
            >
                {prettyRole(s.role)}
            </Box>
        );
    };

    const deactivatedPill = (s: StaffAdminTO): React.JSX.Element => (
        <Box
            component="span"
            data-testid={`staff-deactivated-chip-${s.id}`}
            sx={{
                display: "inline-block",
                px: 1.25,
                py: 0.35,
                borderRadius: "999px",
                fontSize: "0.72rem",
                fontWeight: 700,
                backgroundColor: "#f2f0ea",
                color: "#8a8f98",
                whiteSpace: "nowrap",
            }}
        >
            Deactivated
        </Box>
    );

    const price = (s: StaffAdminTO): string => (s.pricePerHour !== null ? `BD ${s.pricePerHour}` : "—");

    // Always visible, same rationale as rowActions above: no hover on a kitchen tablet.
    const telegramCell = (s: StaffAdminTO): React.JSX.Element => {
        if (s.telegramConnected) {
            return (
                <Tooltip title="Telegram connected">
                    <Box
                        component="span"
                        data-testid={`staff-telegram-connected-${s.id}`}
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 30,
                            height: 30,
                            borderRadius: "999px",
                            backgroundColor: telegramConnectedBg,
                            color: telegramConnectedFg,
                        }}
                    >
                        <CheckCircleRoundedIcon fontSize="small" />
                    </Box>
                </Tooltip>
            );
        }

        const pending = connectLinkPendingIds.has(s.id);
        return (
            <Tooltip title="Copy Telegram connect link">
                <span>
                    <IconButton
                        size="small"
                        aria-label="Copy Telegram connect link"
                        data-testid={`staff-telegram-copy-${s.id}`}
                        disabled={!botUsername || pending}
                        onClick={() => void handleCopyConnectLink(s)}
                        sx={iconButtonSx}
                    >
                        {pending ? <CircularProgress size={14} /> : <ContentCopyRoundedIcon fontSize="small" />}
                    </IconButton>
                </span>
            </Tooltip>
        );
    };

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            PaperProps={{ sx: { backgroundColor: pageBg } }}
            data-testid="account-manager-screen"
        >
            <ManagementTopBar
                title="Account Manager"
                onBack={onClose}
                actions={
                    <Button
                        variant="contained"
                        disableElevation
                        startIcon={<PersonAddAlt1Icon />}
                        onClick={() => setHireOpen(true)}
                        sx={{
                            borderRadius: "999px",
                            textTransform: "none",
                            fontWeight: 700,
                            px: 2,
                            bgcolor: colorRed,
                            "&:hover": { bgcolor: "#c73c3d" },
                        }}
                        data-testid="staff-hire-button"
                    >
                        Add
                    </Button>
                }
            />

            <Box sx={{ maxWidth: 1000, mx: "auto", px: { xs: 1, sm: 3 }, py: { xs: 1.5, sm: 2.5 } }}>
                {/* Every filter in one row: the branch used to sit up in the top bar, away from
                    the controls it belongs with. */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1.25,
                        mb: 2,
                        flexWrap: "wrap",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={showDeactivated ? "all" : "active"}
                            onChange={(_, v: string | null) => v && setShowDeactivated(v === "all")}
                            sx={{
                                columnGap: 1,
                                "& .MuiToggleButtonGroup-grouped": {
                                    border: `1px solid ${hairline}`,
                                    borderRadius: 999,
                                    margin: 0,
                                    "&:not(:first-of-type)": { marginLeft: 0, borderLeft: `1px solid ${hairline}` },
                                },
                                "& .MuiToggleButton-root": {
                                    textTransform: "none",
                                    fontWeight: 600,
                                    px: 2,
                                    py: 0.6,
                                    color: "#6b7079",
                                    backgroundColor: "#fff",
                                    "&:hover": { backgroundColor: "#f4f2ed" },
                                },
                                "& .MuiToggleButton-root.Mui-selected": {
                                    backgroundColor: colorRed,
                                    color: "#fff",
                                    borderColor: colorRed,
                                    "&:hover": { backgroundColor: "#d23c3d", borderColor: "#d23c3d" },
                                },
                            }}
                        >
                            <ToggleButton value="active" data-testid="staff-filter-active">Active</ToggleButton>
                            <ToggleButton value="all" data-testid="staff-filter-all">All</ToggleButton>
                        </ToggleButtonGroup>

                        {canSwitch && (
                            <TextField
                                select
                                size="small"
                                label="Branch"
                                value={scopedBranch.id}
                                onChange={e => {
                                    const next = branches.find(b => String(b.id) === e.target.value);
                                    if (next) setScopedBranch(next);
                                }}
                                SelectProps={{ MenuProps: roundedMenuProps() }}
                                sx={{ minWidth: 150, ...ROUNDED_FIELD_SX }}
                                data-testid="staff-filter-branch"
                            >
                                {branches.map(b => (
                                    <MenuItem key={b.id} value={String(b.id)}>{b.branchName}</MenuItem>
                                ))}
                            </TextField>
                        )}

                        <TextField
                            select
                            size="small"
                            label="Role"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                            SelectProps={{ MenuProps: roundedMenuProps() }}
                            sx={{ minWidth: 150, ...ROUNDED_FIELD_SX }}
                            data-testid="staff-filter-role"
                        >
                            <MenuItem value="ALL">All roles</MenuItem>
                            {rolesPresent.map(r => (
                                <MenuItem key={r} value={r}>{prettyRole(r)}</MenuItem>
                            ))}
                        </TextField>
                    </Box>

                    <Typography sx={{ fontSize: "0.82rem", color: "#8a8f98" }}>
                        {visibleStaff.length} {visibleStaff.length === 1 ? "person" : "people"}
                        {!showDeactivated && deactivatedCount > 0 && ` \u00b7 ${deactivatedCount} hidden`}
                    </Typography>
                </Box>

                {loading && staff.length === 0 && (
                    <Stack spacing={1}>
                        {[0, 1, 2].map(i => (
                            <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: "14px" }} />
                        ))}
                    </Stack>
                )}

                {isEmpty && (
                    <Paper
                        elevation={0}
                        sx={{
                            borderRadius: "16px",
                            border: `1px solid ${hairline}`,
                            py: 6,
                            px: 3,
                            textAlign: "center",
                        }}
                        data-testid="staff-empty-state"
                    >
                        <GroupOutlinedIcon sx={{ fontSize: 40, color: "#cfcbc0", mb: 1 }} />
                        <Typography sx={{ fontWeight: 700, color: "#4a4f57", mb: 0.5 }}>
                            {showDeactivated ? "No accounts on this branch" : "No active accounts"}
                        </Typography>
                        <Typography sx={{ fontSize: "0.85rem", color: "#8a8f98" }}>
                            {!showDeactivated && deactivatedCount > 0
                                ? "Every account here is deactivated. Switch to All to see them."
                                : "Use Hire to add the first person to this branch."}
                        </Typography>
                    </Paper>
                )}

                {!isEmpty && visibleStaff.length > 0 && (isMobile ? (
                    <Stack spacing={1.25} data-testid="staff-list">
                        {visibleStaff.map(s => {
                            const administrable = canAdministerStaff(role, userId ?? null, s);
                            return (
                                <Paper
                                    key={s.id}
                                    elevation={0}
                                    data-testid={`staff-row-${s.id}`}
                                    sx={{
                                        borderRadius: "16px",
                                        border: `1px solid ${hairline}`,
                                        px: 2,
                                        py: 1.75,
                                        opacity: s.enabled ? 1 : 0.6,
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                                        {identity(s)}
                                        {isOwnerViewer && (
                                            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#4a4f57", whiteSpace: "nowrap" }}>
                                                {price(s)}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 1,
                                            mt: 1.5,
                                            flexWrap: "wrap",
                                        }}
                                    >
                                        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.75 }}>
                                            {rolePill(s)}
                                            {!s.enabled && deactivatedPill(s)}
                                        </Stack>
                                        <Stack direction="row" spacing={0.75} alignItems="center">
                                            {telegramCell(s)}
                                            {administrable && rowActions(s)}
                                        </Stack>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Stack>
                ) : (
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{ borderRadius: "16px", border: `1px solid ${hairline}`, overflow: "hidden" }}
                    >
                        <Table
                            data-testid="staff-list"
                            sx={{
                                "& .MuiTableCell-root": {
                                    borderBottom: `1px solid ${hairline}`,
                                    py: 1.25,
                                },
                                "& .MuiTableHead-root .MuiTableCell-root": {
                                    py: 1.25,
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.07em",
                                    textTransform: "uppercase",
                                    color: "#9a9ea6",
                                    backgroundColor: "#fcfbf8",
                                },
                                "& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root": {
                                    borderBottom: 0,
                                },
                                "& .MuiTableBody-root .MuiTableRow-root:hover": {
                                    backgroundColor: "#fcfbf8",
                                },
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Role</TableCell>
                                    {isOwnerViewer && <TableCell>Price/hour</TableCell>}
                                    <TableCell align="center" sx={{ width: 90 }}>Telegram</TableCell>
                                    <TableCell align="right" sx={{ width: 150 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {visibleStaff.map(s => {
                                    const administrable = canAdministerStaff(role, userId ?? null, s);
                                    return (
                                        <TableRow
                                            key={s.id}
                                            data-testid={`staff-row-${s.id}`}
                                            sx={{ opacity: s.enabled ? 1 : 0.6 }}
                                        >
                                            <TableCell>{identity(s)}</TableCell>
                                            <TableCell>
                                                <Stack direction="row" spacing={0.75} alignItems="center">
                                                    {rolePill(s)}
                                                    {!s.enabled && deactivatedPill(s)}
                                                </Stack>
                                            </TableCell>
                                            {isOwnerViewer && (
                                                <TableCell sx={{ fontSize: "0.88rem", color: "#4a4f57", whiteSpace: "nowrap" }}>
                                                    {price(s)}
                                                </TableCell>
                                            )}
                                            <TableCell align="center">
                                                {telegramCell(s)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                                                {administrable && rowActions(s)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                ))}
            </Box>

            <HireStaffDrawer
                open={hireOpen}
                onClose={() => setHireOpen(false)}
                create={create}
                defaultBranchId={scopedBranch.id}
            />

            <ResetPasswordDrawer
                open={resetTarget !== null}
                target={resetTarget}
                onClose={() => setResetTarget(null)}
                resetPassword={resetPassword}
            />

            <EditStaffDrawer
                open={editTarget !== null}
                target={editTarget}
                callerRole={role}
                onClose={() => setEditTarget(null)}
                updateDetails={updateDetails}
                changeBranch={changeBranch}
                updatePayroll={updatePayroll}
                setEnabled={setEnabled}
            />

            <ErrorSnackbar
                open={errorMessage !== null}
                message={errorMessage ?? ""}
                severity="error"
                handleClose={(): void => setErrorMessage(null)}
            />

            <ErrorSnackbar
                open={copyToastMessage !== null}
                message={copyToastMessage ?? ""}
                severity="success"
                handleClose={(): void => setCopyToastMessage(null)}
            />
        </Dialog>
    );
}
