import React, { useEffect, useMemo, useState } from "react";
import {
    Alert,
    AppBar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    MenuItem,
    Paper,
    Select,
    SelectChangeEvent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Toolbar,
    Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import type { IBranch } from "../../inventory/types";
import type {
    AccountingCategoryTO,
    AccountingReportTO,
    AccountingType,
    CreateAccountingReportPayload,
    UpdateAccountingReportPayload,
} from "../types";
import {
    createAccountingReport,
    getAccountingCategories,
    getAccountingReport,
    updateAccountingReport,
} from "../../../../shared/api/management";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles } from "../../../auth/types";
import { dateFormatter } from "../../../../shared/utils/dateFormatter";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

type AccountSource = "DEBIT_CARD" | "CASH" | "CORPORATE_ACCOUNT";

const ACCOUNT_LABELS: Record<AccountSource, string> = {
    DEBIT_CARD: "Debit Card",
    CASH: "Cash",
    CORPORATE_ACCOUNT: "Corporate Account",
};

const ACCOUNT_OPTIONS: AccountSource[] = ["DEBIT_CARD", "CASH", "CORPORATE_ACCOUNT"];

// Pill styles mirroring TransactionDetailsTable
const amountStyles = {
    credit: {
        bg: "rgba(52, 199, 89, 0.12)",
        text: "#008a00",
    },
    debit: {
        bg: "rgba(255, 59, 48, 0.12)",
        text: "#c41c00",
    },
};

const noUnderlineSx = {
    "& .MuiInput-underline:before": { borderBottom: "none" },
    "& .MuiInput-underline:after": { borderBottom: "none" },
    "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "none" },
    "&:before": { borderBottom: "none" },
    "&:after": { borderBottom: "none" },
    "&:hover:not(.Mui-disabled):before": { borderBottom: "none" },
};

type EntryRow = {
    _key: string;
    id?: number;
    date: string;
    type: AccountingType;
    amount: string;
    note: string;
    account: AccountSource;
    categoryId: number | null;
    contributorName: string | null;
    runningBalance: number | null;
};

function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

function newRow(): EntryRow {
    return {
        _key: `new-${Date.now()}-${Math.random()}`,
        date: todayIso(),
        type: "DEBIT",
        amount: "",
        note: "",
        account: "CASH",
        categoryId: null,
        contributorName: null,
        runningBalance: null,
    };
}

function recomputeBalances(rows: EntryRow[], baseBalance: number | null): EntryRow[] {
    if (baseBalance === null) return rows.map((r) => ({ ...r, runningBalance: null }));
    let balance = baseBalance;
    return [...rows]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((r) => {
            const amt = parseFloat(r.amount) || 0;
            balance = r.type === "CREDIT" ? balance + amt : balance - amt;
            return { ...r, runningBalance: balance };
        });
}

function deriveBaseBalance(report: AccountingReportTO): number | null {
    if (!report.entries.length) return null;
    const sorted = [...report.entries].sort((a, b) =>
        a.occurredAt.localeCompare(b.occurredAt)
    );
    const first = sorted[0];
    if (first.runningBalance == null) return null;
    const firstAmt = typeof first.amount === "number" ? first.amount : parseFloat(String(first.amount));
    return first.type === "CREDIT"
        ? first.runningBalance - firstAmt
        : first.runningBalance + firstAmt;
}

type Props = {
    open: boolean;
    mode: "new" | "edit";
    reportId?: number;
    branch: IBranch;
    onClose: () => void;
    onSaved: (report: AccountingReportTO) => void;
};

export function AccountingReportPopup({
                                          open,
                                          mode,
                                          reportId,
                                          branch,
                                          onClose,
                                          onSaved,
                                      }: Props): JSX.Element {
    const { role, username } = useAuth();
    const isSuperManager = role === StaffRoles.SUPER_MANAGER;

    const [rows, setRows] = useState<EntryRow[]>([]);
    const [baseBalance, setBaseBalance] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [version, setVersion] = useState<number | null>(null);
    const [categories, setCategories] = useState<AccountingCategoryTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const computedRows = useMemo(
        () => (isSuperManager ? recomputeBalances(rows, baseBalance) : rows),
        [rows, baseBalance, isSuperManager]
    );

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setLoading(true);
        setError(null);

        (async () => {
            try {
                const cats = await getAccountingCategories(branch.id.toString());
                if (!alive) return;
                setCategories(cats);

                if (mode === "edit" && reportId != null) {
                    const report = await getAccountingReport(reportId);
                    if (!alive) return;
                    setTitle(report.title);
                    setVersion(report.version);
                    const base = isSuperManager ? deriveBaseBalance(report) : null;
                    setBaseBalance(base);
                    setRows(
                        [...report.entries]
                            .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
                            .map((e) => ({
                                _key: `loaded-${e.id}`,
                                id: e.id,
                                date: e.occurredAt.slice(0, 10),
                                type: e.type,
                                amount: String(e.amount),
                                note: e.note ?? "",
                                account: e.accountType as AccountSource,
                                categoryId: e.categoryId,
                                contributorName: e.contributorName,
                                runningBalance: e.runningBalance ?? null,
                            }))
                    );
                } else {
                    setTitle(dateFormatter().toLowerCase() + "-" + branch.locale.toUpperCase());
                    setVersion(null);
                    setBaseBalance(null);
                    setRows([newRow()]);
                }
            } catch (e: unknown) {
                if (alive) setError(e instanceof Error ? e.message : "Failed to load");
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [open, mode, reportId, branch.id, isSuperManager]);

    function updateRow(key: string, patch: Partial<EntryRow>): void {
        setRows((prev) =>
            prev.map((r) => (r._key === key ? { ...r, ...patch } : r))
        );
    }

    function addRow(): void {
        setRows((prev) => [...prev, newRow()]);
    }

    function categoriesForType(type: AccountingType): AccountingCategoryTO[] {
        return categories.filter((c) => c.type === type && !c.archived);
    }

    function deleteRow(key: string) {
        setRows(prev => prev.filter(r => r._key !== key));
    }

    async function handleSave(): Promise<void> {
        if (!title.trim()) {
            setError("Report title is required.");
            return;
        }
        const hasInvalid = rows.some(
            (r) => !r.categoryId || !r.amount || parseFloat(r.amount) <= 0
        );
        if (hasInvalid) {
            setError("Every row needs a category and a positive amount.");
            return;
        }

        setSaving(true);
        setError(null);
        try {
            if (mode === "new") {
                const payload: CreateAccountingReportPayload = {
                    branchId: branch.id.toString(),
                    title: title.trim(),
                    entries: rows.map((r) => ({
                        categoryId: r.categoryId as number,
                        amount: parseFloat(r.amount),
                        occurredAt: r.date + "T00:00:00",
                        accountType: r.account,
                        note: r.note || undefined,
                    })),
                };
                const saved = await createAccountingReport(payload);
                onSaved(saved);
            } else {
                if (version == null) return;
                const payload: UpdateAccountingReportPayload = {
                    version,
                    entries: rows.map((r) => ({
                        id: r.id,
                        categoryId: r.categoryId as number,
                        accountType: r.account,
                        amount: parseFloat(r.amount),
                        occurredAt: r.date + "T00:00:00",
                        note: r.note || undefined,
                    })),
                };
                const saved = await updateAccountingReport(reportId as number, payload);
                onSaved(saved);
            }
        } catch (e: unknown) {
            const status = (e as { status?: number })?.status;
            if (status === 409) {
                setError(
                    "This report was modified by another user. Please reload to see the latest changes."
                );
            } else {
                setError(e instanceof Error ? e.message : "Failed to save.");
            }
        } finally {
            setSaving(false);
        }
    }

    const BRAND = "#E44B4C";

    return (
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            sx={{ "& .MuiDialog-paper": { backgroundColor: "#fff" } }}
        >
            <AppBar
                elevation={0}
                color="inherit"
                position="sticky"
                sx={{ p: 2,
                    borderBottom: 1,
                    borderColor: "divider",
                    backgroundColor: "#fff",
                    position: "sticky",
                    top: 0,
                    zIndex: 10, }}
            >
                <Toolbar sx={{ gap: 1 }}>
                    <IconButton edge="start" onClick={onClose} size="small" aria-label="close">
                        <ArrowBackIosNewRoundedIcon />
                    </IconButton>

                    <TextField
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Report title"
                        variant="standard"
                        size="small"
                        sx={{ minWidth: 180, fontWeight: 700 }}
                        inputProps={{ style: { fontWeight: 700, fontSize: "1.1rem" } }}
                    />

                    <Box flex={1} />

                    <Button
                        onClick={addRow}
                        sx={{
                            borderRadius: 4,
                            textTransform: "none",
                            fontWeight: 700,
                            border: `1px solid ${BRAND}`,
                            color: BRAND,
                            mr: 1,
                        }}
                    >
                        Add
                    </Button>

                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{
                            borderRadius: 4,
                            textTransform: "none",
                            fontWeight: 700,
                            bgcolor: BRAND,
                            "&:hover": { bgcolor: "#c93d3e" },
                        }}
                    >
                        {saving ? <CircularProgress size={18} color="inherit" /> : "Save"}
                    </Button>
                </Toolbar>
            </AppBar>

            <Box sx={{ p: 2 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <TableContainer
                        component={Paper}
                        elevation={0}
                        sx={{ borderRadius: 4,
                            overflow: "hidden",
                            overflowX: "auto",
                            WebkitOverflowScrolling: "touch"
                        }}
                    >
                        <Table size="small" stickyHeader aria-label="accounting entries">
                            <TableHead sx={{ bgcolor: "#fff" }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Account</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Category</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Contributor</TableCell>
                                    {isSuperManager && (
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Balance</TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {computedRows.map((row) => {
                                    const isCredit = row.type === "CREDIT";
                                    const pill = isCredit ? amountStyles.credit : amountStyles.debit;
                                    const hasAmount = row.amount !== "" && !isNaN(parseFloat(row.amount));

                                    return (
                                        <TableRow
                                            key={row._key}
                                            sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                                        >
                                            {/* Date */}
                                            <TableCell sx={{ minWidth: 130 }}>
                                                <TextField
                                                    type="date"
                                                    value={row.date}
                                                    onChange={(e) =>
                                                        updateRow(row._key, { date: e.target.value })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    sx={{ width: 130, ...noUnderlineSx }}
                                                />
                                            </TableCell>

                                            {/* Type */}
                                            <TableCell sx={{ minWidth: 110 }}>
                                                <Select
                                                    value={row.type}
                                                    onChange={(e: SelectChangeEvent) =>
                                                        updateRow(row._key, {
                                                            type: e.target.value as AccountingType,
                                                            categoryId: null,
                                                        })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    sx={{ width: 110, ...noUnderlineSx }}
                                                >
                                                    <MenuItem value="CREDIT">Credit</MenuItem>
                                                    <MenuItem value="DEBIT">Debit</MenuItem>
                                                </Select>
                                            </TableCell>

                                            {/* Amount — soft pill like TransactionDetailsTable */}
                                            <TableCell sx={{ minWidth: 130 }}>
                                                <Box
                                                    sx={{
                                                        backgroundColor: pill.bg,
                                                        color: pill.text,
                                                        py: 0.5,
                                                        px: 1.5,
                                                        borderRadius: 2,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        fontWeight: "bold",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    <Box component="span" sx={{ mr: 0.5 }}>
                                                        {hasAmount ? (isCredit ? "+" : "−") : ""}
                                                    </Box>
                                                    <TextField
                                                        type="number"
                                                        value={row.amount}
                                                        onChange={(e) =>
                                                            updateRow(row._key, { amount: e.target.value })
                                                        }
                                                        size="small"
                                                        variant="standard"
                                                        placeholder="0"
                                                        inputProps={{ min: 0, step: "0.001" }}
                                                        sx={{
                                                            width: 80,
                                                            "& .MuiInput-underline:before, & .MuiInput-underline:after, & .MuiInput-underline:hover:not(.Mui-disabled):before": {
                                                                borderBottom: "none",
                                                            },
                                                            "& input": {
                                                                color: pill.text,
                                                                fontWeight: "bold",
                                                                fontSize: "0.9rem",
                                                                padding: 0,
                                                            },
                                                        }}
                                                    />
                                                </Box>
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell sx={{ minWidth: 160 }}>
                                                <Box sx={{
                                                    backgroundColor: pill.bg,
                                                    color: pill.text,
                                                    py: 0.5,
                                                    px: 1.5,
                                                    borderRadius: 2,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    fontWeight: "bold",
                                                    fontSize: "0.9rem",
                                                }}>
                                                    <TextField
                                                        value={row.note}
                                                        onChange={(e) =>
                                                            updateRow(row._key, { note: e.target.value })
                                                        }
                                                        size="small"
                                                        variant="standard"
                                                        placeholder="—"
                                                        sx={{
                                                            width: 160,
                                                            ...noUnderlineSx,
                                                            "& input": { fontSize: "0.85rem", color: pill.text, fontWeight: "bold", padding: 0 },
                                                            "& input::placeholder": { color: pill.text, opacity: 0.5 },
                                                        }}
                                                    />
                                                </Box>
                                            </TableCell>

                                            {/* Account */}
                                            <TableCell sx={{ minWidth: 150 }}>
                                                <Box sx={{
                                                    backgroundColor: pill.bg,
                                                    color: pill.text,
                                                    py: 0.5,
                                                    px: 1.5,
                                                    borderRadius: 2,
                                                    display: "inline-flex",
                                                    alignItems: "center",
                                                    fontWeight: "bold",
                                                    fontSize: "0.9rem",
                                                }}>
                                                    <Select
                                                        value={row.account}
                                                        onChange={(e: SelectChangeEvent) =>
                                                            updateRow(row._key, {
                                                                account: e.target.value as AccountSource,
                                                            })
                                                        }
                                                        size="small"
                                                        variant="standard"
                                                        sx={{ fontSize: "0.9rem", color: pill.text, fontWeight: "bold", ...noUnderlineSx }}
                                                    >
                                                        {ACCOUNT_OPTIONS.map((opt) => (
                                                            <MenuItem key={opt} value={opt}>
                                                                {ACCOUNT_LABELS[opt]}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </Box>
                                            </TableCell>

                                            {/* Category */}
                                            <TableCell sx={{ minWidth: 150 }}>
                                                <Select
                                                    value={row.categoryId != null ? String(row.categoryId) : ""}
                                                    onChange={(e: SelectChangeEvent) =>
                                                        updateRow(row._key, {
                                                            categoryId: Number(e.target.value),
                                                        })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    displayEmpty
                                                    sx={{ width: 150, fontSize: "0.9rem", ...noUnderlineSx }}
                                                >
                                                    <MenuItem value="" disabled>
                                                        <Typography color="text.secondary" variant="body2">
                                                            Select…
                                                        </Typography>
                                                    </MenuItem>
                                                    {categoriesForType(row.type).map((c) => (
                                                        <MenuItem key={c.id} value={String(c.id)}>
                                                            {c.name}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </TableCell>

                                            {/* Contributor */}
                                            <TableCell sx={{ minWidth: 160 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ width: 160, fontSize: "0.85rem" }}
                                                    color="text.secondary"
                                                >
                                                    {row.contributorName ?? username}
                                                </Typography>
                                            </TableCell>

                                            {/* Running balance (SUPER_MANAGER only) */}
                                            {isSuperManager && (
                                                <TableCell sx={{ minWidth: 100 }}>
                                                    <Box sx={{
                                                        backgroundColor: "#e2e874",
                                                        py: 0.5,
                                                        px: 1.5,
                                                        borderRadius: 2,
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        fontWeight: "bold",
                                                        fontSize: "0.9rem",
                                                    }}>
                                                        <Typography
                                                            variant="body2"
                                                            sx={{ fontSize: "0.85rem", fontWeight: "bold", color: "#5a5e00" }}
                                                        >
                                                            {row.runningBalance != null
                                                                ? row.runningBalance.toFixed(3)
                                                                : "?"}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            )}

                                            {/* Delete */}
                                            <TableCell sx={{width: 40, pr: 1}}>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => deleteRow(row._key)}
                                                    sx={{color: "rgba(0,0,0,0.3)", "&:hover": {color: "#c41c00"}}}
                                                >
                                                    <DeleteOutlineRoundedIcon fontSize="small"/>
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {computedRows.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={isSuperManager ? 8 : 7}
                                            align="center"
                                            sx={{ py: 3, color: "text.secondary" }}
                                        >
                                            No entries yet — click “Add” to create one
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Dialog>
    );
}
