import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    AppBar,
    Box,
    Button,
    CircularProgress,
    Dialog,
    IconButton,
    MenuItem,
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
import AddIcon from "@mui/icons-material/Add";
import type { IBranch } from "../types/inventoryTypes";
import type {
    AccountingCategoryTO,
    AccountingReportTO,
    AccountingType,
    CreateAccountingReportPayload,
    UpdateAccountingReportPayload,
} from "../types/accountingTypes";
import {
    createAccountingReport,
    getAccountingCategories,
    getAccountingReport,
    updateAccountingReport,
} from "../api/api";
import { useAuth } from "../security/AuthProvider";
import { StaffRoles } from "../types/authTypes";
import {dateFormatter} from "../mappers/dateFormatter";

type AccountSource = "DEBIT_CARD" | "CASH" | "CORPORATE_ACCOUNT";

const ACCOUNT_LABELS: Record<AccountSource, string> = {
    DEBIT_CARD: "Debit Card",
    CASH: "Cash",
    CORPORATE_ACCOUNT: "Corporate Account",
};

const ACCOUNT_OPTIONS: AccountSource[] = ["DEBIT_CARD", "CASH", "CORPORATE_ACCOUNT"];

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
        <Dialog fullScreen open={open} onClose={onClose} PaperProps={{ sx: { backgroundColor: "#fbfaf6" } }}>
            <AppBar
                elevation={0}
                color="inherit"
                position="sticky"
                sx={{ borderBottom: 1, borderColor: "divider", backgroundColor: "#fbfaf6" }}
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
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Account</TableCell>
                                    <TableCell sx={{ fontWeight: 700 }}>Category</TableCell>
                                    <TableCell sx={{ fontWeight: 700}}>Contributor</TableCell>
                                    {isSuperManager && (
                                        <TableCell sx={{ fontWeight: 700 }}>Balance</TableCell>
                                    )}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {computedRows.map((row) => {
                                    const isExpense = row.type === "DEBIT";
                                    const accentColor = isExpense ? "#ff0000" : "#00ff0a";
                                    const textColor = isExpense ? "#ff0000" : "#00ff0a";

                                    const accentCellSx = {
                                        backgroundColor: accentColor,
                                        color: textColor,
                                    };

                                    return (
                                        <TableRow key={row._key}>
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
                                                    sx={{ width: 130 }}
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
                                                    sx={{ width: 110 }}
                                                >
                                                    <MenuItem value="CREDIT">Credit</MenuItem>
                                                    <MenuItem value="DEBIT">Debit</MenuItem>
                                                </Select>
                                            </TableCell>

                                            {/* Amount */}
                                            <TableCell sx={{ minWidth: 100, ...accentCellSx }}>
                                                <TextField
                                                    type="number"
                                                    value={row.amount}
                                                    onChange={(e) =>
                                                        updateRow(row._key, { amount: e.target.value })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    inputProps={{ min: 0, step: "0.001" }}
                                                    sx={{ width: 100 }}
                                                />
                                            </TableCell>

                                            {/* Description */}
                                            <TableCell sx={{ minWidth: 160, ...accentCellSx }}>
                                                <TextField
                                                    value={row.note}
                                                    onChange={(e) =>
                                                        updateRow(row._key, { note: e.target.value })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    placeholder="Note"
                                                    sx={{ width: 160 }}
                                                />
                                            </TableCell>

                                            {/* Account */}
                                            <TableCell sx={{ minWidth: 150, ...accentCellSx }}>
                                                <Select
                                                    value={row.account}
                                                    onChange={(e: SelectChangeEvent) =>
                                                        updateRow(row._key, {
                                                            account: e.target.value as AccountSource,
                                                        })
                                                    }
                                                    size="small"
                                                    variant="standard"
                                                    sx={{ width: 150 }}
                                                >
                                                    {ACCOUNT_OPTIONS.map((opt) => (
                                                        <MenuItem key={opt} value={opt}>
                                                            {ACCOUNT_LABELS[opt]}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
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
                                                    sx={{ width: 150 }}
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

                                            <TableCell sx={{ minWidth: 160 }}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{ width: 160 }}
                                                    color='text.secondary'
                                                >
                                                    {row.contributorName ?? username}
                                                </Typography>
                                            </TableCell>

                                            {/* Running balance (SUPER_MANAGER only) */}
                                            {isSuperManager && (
                                                <TableCell sx={{ minWidth: 100 }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {row.runningBalance != null
                                                            ? row.runningBalance.toFixed(3)
                                                            : "?"}
                                                    </Typography>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>
        </Dialog>
    );
}
