import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Box,
    ButtonBase,
    Button,
    Chip,
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
    Tooltip,
    Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { ManagementTopBar } from "../../_shared/components/ManagementTopBar";
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
    deleteAccountingEntryImage,
    getAccountingCategories,
    getAccountingReport,
    updateAccountingReport,
    uploadAccountingEntryImage,
} from "../../../../shared/api/management";
import type { PhotoPatch } from "../../../../shared/components/EntityPhotoField";
import { EntryImageField } from "./EntryImageField";
import { logger } from "../../../../shared/utils/logger";
import { useAuth } from "../../../auth/context/AuthProvider";
import { StaffRoles } from "../../../auth/types";
import { dateFormatter } from "../../../../shared/utils/dateFormatter";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { PreResponseNetworkError } from "../../../../shared/api/client";
import { useIncrementalList } from "../../../../shared/hooks/useIncrementalList";
import { InfiniteScrollSentinel } from "../../../../shared/components/InfiniteScrollSentinel";
import { BRAND_RED } from "../../../../shared/utils/theme";
import {
    applyEntryView,
    unsavedRowKeys,
    areRowsEqual,
    DEFAULT_SORTS,
    EMPTY_FILTERS,
    isDefaultView,
    nextSorts,
    setSortDir,
    nextTypeFilter,
} from "../entryView";
import type { AccountFilterValue, EntryFilters, EntrySort, EntrySortColumn, SortDir } from "../entryView";
import { ColumnHeaderFilter } from "./ColumnHeaderFilter";
import type { HeaderSortState } from "./ColumnHeaderFilter";
import { MultiSelectFilterPopover } from "./MultiSelectFilterPopover";
import type { FilterOption } from "./MultiSelectFilterPopover";
import { TextFilterPopover } from "./TextFilterPopover";
import { UnsavedChangesPrompt } from "./UnsavedChangesPrompt";

/**
 * Null is a real fourth answer, not a missing value: an adjustment or a correction did not move
 * through any account, and picking one anyway puts money into a cash or card total it never touched.
 * The column is nullable on the server for the same reason.
 */
type AccountSource = "DEBIT_CARD" | "CASH" | "CORPORATE_ACCOUNT" | null;

/** MUI Select cannot hold null, so blank is "" in the widget and null on the wire. */
const NO_ACCOUNT = "";

const ACCOUNT_LABELS: Record<NonNullable<AccountSource>, string> = {
    DEBIT_CARD: "Debit Card",
    CASH: "Cash",
    CORPORATE_ACCOUNT: "Corporate Account",
};

const ACCOUNT_OPTIONS: NonNullable<AccountSource>[] = ["DEBIT_CARD", "CASH", "CORPORATE_ACCOUNT"];

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
    /** A photo is stored on the server for this entry. */
    hasImage: boolean;
    /** Picked in this session, not uploaded yet — a new row has no id to upload against. */
    pendingImage: Blob | null;
    /** The stored photo should be deleted when the report is saved. */
    removeImage: boolean;
};

/**
 * Now, as a `datetime-local` value — "2026-09-07T14:30".
 *
 * <p>Built from the LOCAL clock, not `toISOString()`, which converts to UTC first: in Bahrain that
 * is three hours earlier, so a 01:00 entry would default to the previous day and land in the wrong
 * month's report.
 */
function nowIsoMinutes(): string {
    const d = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        + `T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * `datetime-local` yields minutes; the API takes a LocalDateTime. Older rows may already carry
 * seconds, so this normalises rather than blindly appending.
 */
function withSeconds(value: string): string {
    if (!value) return value;
    if (value.length === 10) return `${value}T00:00:00`;
    return value.length === 16 ? `${value}:00` : value;
}

function newRow(): EntryRow {
    return {
        _key: `new-${Date.now()}-${Math.random()}`,
        date: nowIsoMinutes(),
        type: "DEBIT",
        amount: "",
        note: "",
        // No account until someone picks one. Defaulting to CASH quietly asserted that every new
        // entry was cash, which is the assertion this change exists to stop making.
        account: null,
        categoryId: null,
        contributorName: null,
        runningBalance: null,
        hasImage: false,
        pendingImage: null,
        removeImage: false,
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
    // Defend against a malformed response (missing/null `entries`): spreading or
    // reading `.length` on undefined throws and masks as a react-dom internal error.
    const entries = report.entries ?? [];
    if (!entries.length) return null;
    const sorted = [...entries].sort((a, b) =>
        a.occurredAt.localeCompare(b.occurredAt)
    );
    const first = sorted[0];
    if (first.runningBalance == null) return null;
    const firstAmt = typeof first.amount === "number" ? first.amount : parseFloat(String(first.amount));
    return first.type === "CREDIT"
        ? first.runningBalance - firstAmt
        : first.runningBalance + firstAmt;
}

const SORT_LABELS: Record<EntrySortColumn, string> = {
    date: "Date",
    amount: "Amount",
    note: "Description",
    account: "Account",
    category: "Category",
};

const TYPE_FILTER_LABELS: Record<EntryFilters["type"], string> = {
    ALL: "All",
    DEBIT: "Debit",
    CREDIT: "Credit",
};

const NOTE_FILTER_DEBOUNCE_MS = 300;

const ACCOUNT_FILTER_OPTIONS: FilterOption<AccountFilterValue>[] = [
    ...ACCOUNT_OPTIONS.map((value): FilterOption<AccountFilterValue> => ({ value, label: ACCOUNT_LABELS[value] })),
    { value: "NONE", label: "None" },
];

function toggled<T>(list: readonly T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Re-syncs local rows to what the server now holds: ids from the clientRef map, and the photo
 * flags resolved (a pending upload / removal has just been carried out).
 */
function adoptRows(rows: EntryRow[], saved: AccountingReportTO): EntryRow[] {
    const serverIdByRef = new Map<string, number>();
    for (const entry of saved.entries ?? []) {
        if (entry.clientRef) serverIdByRef.set(entry.clientRef, entry.id);
    }
    return rows.map((r) => ({
        ...r,
        id: serverIdByRef.get(r._key) ?? r.id,
        hasImage: r.pendingImage ? true : r.removeImage ? false : r.hasImage,
        pendingImage: null,
        removeImage: false,
    }));
}

type SaveOutcome =
    | { kind: "saved"; saved: AccountingReportTO }
    | { kind: "photosFailed"; saved: AccountingReportTO; failedPhotos: number }
    | { kind: "failed" };

function photoFailureMessage(failedPhotos: number): string {
    return (
        `Report saved, but ${failedPhotos} photo(s) could not be uploaded. ` +
        `Re-attach them and save again — the report data is safe.`
    );
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
    const isOwner = role === StaffRoles.OWNER;

    const [rows, setRows] = useState<EntryRow[]>([]);
    const [baseBalance, setBaseBalance] = useState<number | null>(null);
    const [title, setTitle] = useState("");
    const [version, setVersion] = useState<number | null>(null);
    const [categories, setCategories] = useState<AccountingCategoryTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Newest-first by default, matching a freshly added row's expected position. Ordered by
    // priority: index 0 is the primary sort.
    const [sorts, setSorts] = useState<EntrySort[]>([...DEFAULT_SORTS]);
    const [filters, setFilters] = useState<EntryFilters>(EMPTY_FILTERS);
    // What the Description box shows; committed to `filters.note` after a debounce so typing
    // does not re-filter (and re-render) up to 400 rows on every keystroke.
    const [noteDraft, setNoteDraft] = useState("");
    // `rows` as of the last load / successful prompt-save. "Dirty" means rows differ from this.
    const [savedSnapshot, setSavedSnapshot] = useState<EntryRow[]>([]);
    // The report this popup is editing on the server. Starts as the prop, and becomes the created
    // id after a first save so a second save UPDATES instead of creating a duplicate report.
    const [persistedReportId, setPersistedReportId] = useState<number | null>(
        mode === "edit" ? (reportId ?? null) : null
    );
    const [promptOpen, setPromptOpen] = useState(false);
    // The sort/filter change waiting on the unsaved-changes prompt. A ref: it is never rendered.
    const pendingChangeRef = useRef<(() => void) | null>(null);

    const computedRows = useMemo(
        () => (isOwner ? recomputeBalances(rows, baseBalance) : rows),
        [rows, baseBalance, isOwner]
    );

    const categoryNameById = useMemo(
        () => new Map(categories.map((c) => [c.id, c.name] as const)),
        [categories]
    );
    const insertionIndex = useMemo(() => new Map(rows.map((r, i) => [r._key, i] as const)), [rows]);

    // Filtering and sorting are for DISPLAY only — computedRows above already carries the correct
    // running balances (oldest-first internally), so the view must never touch balance math, and
    // `rows` (what save sends) is never filtered or re-ordered. Ties are broken by insertion order
    // in `rows`, NOT position within computedRows (which recomputeBalances may have already
    // re-sorted for an owner) — this is what lets a freshly added same-date row still show first
    // without needing addRow() to mutate the underlying array order (see addRow()'s comment).
    const isDirty = useMemo(() => !areRowsEqual(rows, savedSnapshot), [rows, savedSnapshot]);
    const pinnedKeys = useMemo(
        () => (isDirty ? unsavedRowKeys(rows, savedSnapshot) : undefined),
        [isDirty, rows, savedSnapshot]
    );

    const sortedRows = useMemo(
        () => applyEntryView(computedRows, filters, sorts, { categoryNameById, insertionIndex, pinnedKeys }),
        [computedRows, filters, sorts, categoryNameById, insertionIndex, pinnedKeys]
    );

    // A month-end report runs to ~400 entries, each an editable row of selects and inputs, and
    // rendering them all is what makes this popup crawl. Windows the RENDER only: `rows` stays
    // complete, so save still sends every entry and the running balance is still computed across
    // the whole list.
    //
    // Deliberately not server-side paging. updateReport hard-deletes any stored entry missing from
    // the payload, so saving a page would delete the other 380 and their photos; and the balance
    // accumulates from the first row, so row 21 cannot be computed without rows 1-20.
    //
    // Only SAVED rows are windowed. A row you just added has no id yet, and hiding it behind a
    // scroll is the one thing this must never do -- you would click Add and see nothing.
    //
    // Keyed on the sorts and filters as well as the report: a new order or a new subset is a new
    // list, and leaving the window 200 rows into the old one would show an arbitrary slice of it.
    const {
        visible: windowSlice,
        hasMore: hasMoreRows,
        sentinelRef,
    } = useIncrementalList(sortedRows, {
        pageSize: 20,
        resetKey: `${reportId ?? "new"}-${JSON.stringify(sorts)}-${JSON.stringify(filters)}`,
    });

    // Filtered by INDEX rather than concatenating two slices: sortedRows already carries the
    // display order, including the tie-break that puts a freshly added same-date row first, and
    // rebuilding the array from parts silently reorders it.
    const windowCount = windowSlice.length;
    const visibleRows = useMemo(
        () => sortedRows.filter((r, i) => i < windowCount || r.id === undefined),
        [sortedRows, windowCount]
    );

    useEffect(() => {
        if (!open) return;
        let alive = true;
        setLoading(true);
        setError(null);
        setSorts([...DEFAULT_SORTS]);
        setFilters(EMPTY_FILTERS);
        setNoteDraft("");
        setPromptOpen(false);
        pendingChangeRef.current = null;
        // Deliberately NOT a dependency of this effect: promoting a new report to an edit after
        // its first save must not refetch or reset the rows the user is looking at.
        setPersistedReportId(mode === "edit" ? (reportId ?? null) : null);

        (async () => {
            try {
                const cats = await getAccountingCategories(branch.id.toString());
                if (!alive) return;
                // `categoriesForType` calls `.filter` on this in render; a non-array
                // response would crash the render, so normalize to an array here.
                setCategories(Array.isArray(cats) ? cats : []);

                if (mode === "edit" && reportId != null) {
                    const report = await getAccountingReport(reportId);
                    if (!alive) return;
                    setTitle(report.title);
                    setVersion(report.version);
                    const base = isOwner ? (report.startBalance ?? deriveBaseBalance(report)) : null;
                    setBaseBalance(base);
                    const loaded: EntryRow[] = [...(report.entries ?? [])]
                            .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
                            .map((e) => ({
                                _key: `loaded-${e.id}`,
                                id: e.id,
                                // 16 chars, not 10: "2026-09-07T14:30". Truncating to the date threw
                                // the time away on load and wrote it back as midnight on save, so
                                // every entry in a report collapsed to the same instant and their
                                // order became whatever the array happened to be.
                                date: e.occurredAt.slice(0, 16),
                                type: e.type,
                                amount: String(e.amount),
                                note: e.note ?? "",
                                account: (e.accountType ?? null) as AccountSource,
                                categoryId: e.categoryId,
                                contributorName: e.contributorName,
                                runningBalance: e.runningBalance ?? null,
                                hasImage: e.hasImage,
                                pendingImage: null,
                                removeImage: false,
                            }));
                    setRows(loaded);
                    setSavedSnapshot(loaded);
                } else {
                    // Accounting always names the report after the current month — never roll
                    // back near month-start the way Inventory does.
                    setTitle(dateFormatter("-", "en", false).toLowerCase() + "-" + branch.locale.toUpperCase());
                    setVersion(null);
                    setBaseBalance(null);
                    const seeded = [newRow()];
                    setRows(seeded);
                    setSavedSnapshot(seeded);
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
    }, [open, mode, reportId, branch.id, isOwner]);

    function updateRow(key: string, patch: Partial<EntryRow>): void {
        setRows((prev) =>
            prev.map((r) => (r._key === key ? { ...r, ...patch } : r))
        );
    }

    function addRow(): void {
        // Append, not prepend: `rows` is sent to the backend verbatim as the entries payload
        // on save (see handleSave), and the backend's balance computation sorts entries by
        // occurredAt with a STABLE sort — for same-date entries, ties are broken by array
        // order. Prepending here silently reversed that tie-break for every same-day report,
        // corrupting running balances (a swap: entries get processed newest-added-first
        // instead of oldest-added-first). "New row on top" is a display-only concern —
        // sortedRows (below) already puts a freshly added same-date row first for the user,
        // without touching this array's true chronological order.
        setRows((prev) => [...prev, newRow()]);
    }

    function categoriesForType(type: AccountingType): AccountingCategoryTO[] {
        return categories.filter((c) => c.type === type);
    }

    function deleteRow(key: string) {
        setRows(prev => prev.filter(r => r._key !== key));
    }

    function updateRowPhoto(key: string, patch: PhotoPatch): void {
        updateRow(key, patch);
    }

    /**
     * Uploads/removes entry photos AFTER the report is saved — a brand-new entry has no id until
     * the save assigns one, and the response's clientRef -> entry id mapping is what connects a
     * blob held in memory to its row.
     *
     * allSettled, not all: one failed photo must not hide the fact that the report itself saved.
     * Each upload gets one retry, since the usual cause is a momentary tablet wifi drop.
     * @returns how many photo operations ultimately failed
     */
    async function syncEntryImages(saved: AccountingReportTO): Promise<number> {
        const serverIdByRef = new Map<string, number>();
        for (const entry of saved.entries ?? []) {
            if (entry.clientRef) serverIdByRef.set(entry.clientRef, entry.id);
        }

        const jobs: Array<() => Promise<unknown>> = [];
        for (const row of rows) {
            const serverId = serverIdByRef.get(row._key) ?? row.id;
            if (serverId == null) continue;
            if (row.pendingImage) {
                const blob = row.pendingImage;
                jobs.push(() => uploadAccountingEntryImage(serverId, blob));
            } else if (row.removeImage && row.hasImage) {
                jobs.push(() => deleteAccountingEntryImage(serverId));
            }
        }
        if (jobs.length === 0) return 0;

        const runWithOneRetry = async (job: () => Promise<unknown>): Promise<unknown> => {
            try {
                return await job();
            } catch {
                return job();
            }
        };

        const results = await Promise.allSettled(jobs.map(runWithOneRetry));
        const failed = results.filter((r) => r.status === "rejected");
        failed.forEach((r) => logger.error((r as PromiseRejectedResult).reason, "entry photo sync failed"));
        return failed.length;
    }

    /**
     * Re-syncs local rows to what the server now holds, so the popup can stay open after a partial
     * photo failure without a second save duplicating rows or re-uploading what already landed.
     */
    function adoptSavedReport(saved: AccountingReportTO): void {
        setVersion(saved.version);
        setRows((prev) => adoptRows(prev, saved));
    }

    /**
     * Takes a just-saved report back in as the new baseline — version, ids, photo flags, opening
     * balance and per-row balances — and snapshots it, so the popup reads clean and a second save
     * updates in place. Built from the rows that were actually SENT, once, so `rows` and the
     * snapshot are the same array.
     */
    function takeInSavedReport(saved: AccountingReportTO): void {
        const entryByRef = new Map<string, AccountingReportTO["entries"][number]>();
        const entryById = new Map<number, AccountingReportTO["entries"][number]>();
        for (const entry of saved.entries ?? []) {
            entryById.set(entry.id, entry);
            if (entry.clientRef) entryByRef.set(entry.clientRef, entry);
        }
        const adopted = adoptRows(rows, saved).map((r) => {
            const entry = entryByRef.get(r._key) ?? (r.id !== undefined ? entryById.get(r.id) : undefined);
            if (!entry) return r;
            return {
                ...r,
                runningBalance: entry.runningBalance ?? r.runningBalance,
                contributorName: entry.contributorName ?? r.contributorName,
            };
        });
        setVersion(saved.version);
        setBaseBalance(isOwner ? (saved.startBalance ?? deriveBaseBalance(saved)) : null);
        setRows(adopted);
        setSavedSnapshot(adopted);
    }

    /**
     * Validates, saves (with the one network retry) and syncs photos. Reports the outcome instead
     * of deciding what happens next, because the Save button closes the popup and the unsaved-
     * changes prompt keeps it open. Failures are surfaced here through the error alert.
     */
    async function runSave(): Promise<SaveOutcome> {
        if (!title.trim()) {
            setError("Report title is required.");
            return { kind: "failed" };
        }
        const hasInvalid = rows.some(
            (r) => !r.categoryId || !r.amount || parseFloat(r.amount) <= 0
        );
        if (hasInvalid) {
            setError("Every row needs a category and a positive amount.");
            return { kind: "failed" };
        }

        // Create vs update follows what is on the server, not the `mode` prop: after a first save
        // from the prompt the popup is still mounted with mode "new".
        const target =
            persistedReportId !== null && version !== null ? { id: persistedReportId, version } : null;
        if (persistedReportId !== null && target === null) return { kind: "failed" };

        async function saveReportOnce(): Promise<AccountingReportTO> {
            if (target === null) {
                const payload: CreateAccountingReportPayload = {
                    branchId: branch.id.toString(),
                    title: title.trim(),
                    entries: rows.map((r) => ({
                        categoryId: r.categoryId as number,
                        amount: parseFloat(r.amount),
                        occurredAt: withSeconds(r.date),
                        accountType: r.account,
                        note: r.note || undefined,
                        clientRef: r._key,
                    })),
                };
                return createAccountingReport(payload);
            }
            const payload: UpdateAccountingReportPayload = {
                version: target.version,
                entries: rows.map((r) => ({
                    id: r.id,
                    categoryId: r.categoryId as number,
                    accountType: r.account,
                    amount: parseFloat(r.amount),
                    occurredAt: withSeconds(r.date),
                    note: r.note || undefined,
                    clientRef: r._key,
                })),
            };
            return updateAccountingReport(target.id, payload);
        }

        // Retries once, but ONLY when no HTTP response was ever received (offline, DNS failure,
        // a rejected `fetch()` inside authFetch). authFetch throws PreResponseNetworkError
        // exclusively for that case; anything past a received response (an `!res.ok` status, the
        // 401 handler, or a body-parse failure on a successful response) surfaces as a plain
        // Error and must never be blind-retried — that could duplicate the report server-side.
        async function saveReportWithOneRetry(): Promise<AccountingReportTO> {
            try {
                return await saveReportOnce();
            } catch (e: unknown) {
                if (!(e instanceof PreResponseNetworkError)) throw e;
                return saveReportOnce();
            }
        }

        setSaving(true);
        setError(null);
        try {
            const saved = await saveReportWithOneRetry();

            const failedPhotos = await syncEntryImages(saved);

            // The report itself is already persisted, so the parent list is refreshed either way.
            // A failed photo must never present itself as a failed save.
            onSaved(saved);

            return failedPhotos > 0 ? { kind: "photosFailed", saved, failedPhotos } : { kind: "saved", saved };
        } catch (e: unknown) {
            const status = (e as { status?: number })?.status;
            if (status === 409) {
                setError(
                    "This report was modified by another user. Please reload to see the latest changes."
                );
            } else if (e instanceof PreResponseNetworkError) {
                setError("Network error — please check your connection and try saving again.");
            } else {
                setError(e instanceof Error ? e.message : "Failed to save.");
            }
            return { kind: "failed" };
        } finally {
            setSaving(false);
        }
    }

    async function handleSave(): Promise<void> {
        const outcome = await runSave();
        if (outcome.kind === "photosFailed") {
            adoptSavedReport(outcome.saved);
            setError(photoFailureMessage(outcome.failedPhotos));
            return;
        }
        if (outcome.kind === "saved") onClose();
    }

    /** The one gate every sort/filter change goes through. */
    function requestViewChange(apply: () => void): void {
        if (!isDirty) {
            apply();
            return;
        }
        pendingChangeRef.current = apply;
        setPromptOpen(true);
    }
    // The debounce timer below outlives the render that created it.
    const requestViewChangeRef = useRef(requestViewChange);
    requestViewChangeRef.current = requestViewChange;

    function closePromptAndRunPending(): void {
        const pending = pendingChangeRef.current;
        pendingChangeRef.current = null;
        setPromptOpen(false);
        pending?.();
    }

    function handlePromptRevert(): void {
        setRows(savedSnapshot);
        closePromptAndRunPending();
    }

    function handlePromptDismiss(): void {
        pendingChangeRef.current = null;
        setPromptOpen(false);
        setNoteDraft(filters.note);
    }

    /** Saves and stays open; only then applies the change that opened the prompt. */
    async function handlePromptSave(): Promise<void> {
        const outcome = await runSave();
        if (outcome.kind === "failed") {
            pendingChangeRef.current = null;
            setPromptOpen(false);
            setNoteDraft(filters.note);
            return;
        }
        // The report IS persisted in both remaining cases, so it is taken in either way.
        if (persistedReportId === null) setPersistedReportId(outcome.saved.id);
        takeInSavedReport(outcome.saved);
        if (outcome.kind === "photosFailed") {
            pendingChangeRef.current = null;
            setPromptOpen(false);
            setNoteDraft(filters.note);
            setError(photoFailureMessage(outcome.failedPhotos));
            return;
        }
        closePromptAndRunPending();
    }

    function handleSortClick(column: EntrySortColumn): void {
        const next = nextSorts(sorts, column);
        requestViewChange(() => setSorts(next));
    }

    function handleSortSet(column: EntrySortColumn, dir: SortDir): void {
        const next = setSortDir(sorts, column, dir);
        requestViewChange(() => setSorts(next));
    }

    function handleTypeCycle(): void {
        const next = nextTypeFilter(filters.type);
        requestViewChange(() => setFilters((f) => ({ ...f, type: next })));
    }

    function handleAccountToggle(value: AccountFilterValue): void {
        const next = toggled(filters.accounts, value);
        requestViewChange(() => setFilters((f) => ({ ...f, accounts: next })));
    }

    function handleCategoryToggle(id: number): void {
        const next = toggled(filters.categoryIds, id);
        requestViewChange(() => setFilters((f) => ({ ...f, categoryIds: next })));
    }

    function clearFilters(): void {
        setFilters(EMPTY_FILTERS);
        setNoteDraft("");
    }

    function handleClearAll(): void {
        requestViewChange(() => {
            clearFilters();
            setSorts([...DEFAULT_SORTS]);
        });
    }

    function handleClearFilters(): void {
        requestViewChange(clearFilters);
    }

    function handleRemoveSort(column: EntrySortColumn): void {
        const next = sorts.filter((s) => s.column !== column);
        requestViewChange(() => setSorts(next));
    }

    useEffect(() => {
        // `filters.note` changing from anywhere else (Clear all, a chip) must reach the input.
        setNoteDraft(filters.note);
    }, [filters.note]);

    useEffect(() => {
        if (noteDraft === filters.note) return;
        const timer = setTimeout(() => {
            requestViewChangeRef.current(() => setFilters((f) => ({ ...f, note: noteDraft })));
        }, NOTE_FILTER_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [noteDraft, filters.note]);

    function sortStateFor(column: EntrySortColumn): HeaderSortState {
        const index = sorts.findIndex((s) => s.column === column);
        if (index === -1) return { dir: null, priority: null, showBadge: false };
        return { dir: sorts[index].dir, priority: index + 1, showBadge: sorts.length >= 2 };
    }

    function ariaSortFor(column: EntrySortColumn): "ascending" | "descending" | "none" {
        const { dir } = sortStateFor(column);
        if (dir === null) return "none";
        return dir === "asc" ? "ascending" : "descending";
    }

    const categoryFilterOptions = useMemo(
        (): FilterOption<number>[] => categories.map((c) => ({ value: c.id, label: c.name })),
        [categories]
    );

    function filterChips(): { key: string; label: string; onRemove: () => void }[] {
        const chips: { key: string; label: string; onRemove: () => void }[] = [];
        if (filters.type !== "ALL") {
            chips.push({
                key: "filter-type",
                label: `Type: ${TYPE_FILTER_LABELS[filters.type]}`,
                onRemove: () => requestViewChange(() => setFilters((f) => ({ ...f, type: "ALL" }))),
            });
        }
        const note = filters.note.trim();
        if (note !== "") {
            chips.push({
                key: "filter-note",
                label: `Description: “${note}”`,
                onRemove: () =>
                    requestViewChange(() => {
                        setFilters((f) => ({ ...f, note: "" }));
                        setNoteDraft("");
                    }),
            });
        }
        if (filters.accounts.length > 0) {
            const names = ACCOUNT_FILTER_OPTIONS.filter((o) => filters.accounts.includes(o.value)).map((o) => o.label);
            chips.push({
                key: "filter-accounts",
                label: `Account: ${names.join(", ")} (${names.length})`,
                onRemove: () => requestViewChange(() => setFilters((f) => ({ ...f, accounts: [] }))),
            });
        }
        if (filters.categoryIds.length > 0) {
            // Option order, like the Account chip, rather than the order the user ticked them.
            const position = (id: number): number => {
                const index = categories.findIndex((c) => c.id === id);
                return index === -1 ? categories.length : index;
            };
            const names = [...filters.categoryIds]
                .sort((a, b) => position(a) - position(b))
                .map((id) => categoryNameById.get(id) ?? `#${id}`);
            chips.push({
                key: "filter-categories",
                label: `Category: ${names.join(", ")} (${names.length})`,
                onRemove: () => requestViewChange(() => setFilters((f) => ({ ...f, categoryIds: [] }))),
            });
        }
        sorts.forEach((s, i) => {
            chips.push({
                key: `sort-${s.column}`,
                label: `${i + 1} ${SORT_LABELS[s.column]} ${s.dir === "asc" ? "↑" : "↓"}`,
                onRemove: () => handleRemoveSort(s.column),
            });
        });
        return chips;
    }

    const BRAND = "#E44B4C";

    const chips = isDefaultView(filters, sorts) ? [] : filterChips();
    const emptyColSpan = isOwner ? 10 : 9;

    return (
        <>
        <Dialog
            fullScreen
            open={open}
            onClose={onClose}
            // The paper stops scrolling itself: it was the scroll container for the whole page, so
            // the table (auto height) never scrolled and the page did. The table region below now
            // owns vertical scroll.
            sx={{ "& .MuiDialog-paper": { backgroundColor: "#fbfaf6", overflow: "hidden" } }}
        >
            <ManagementTopBar
                title="Accounting Report"
                onBack={onClose}
                titleSlot={
                    <TextField
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Report title"
                        variant="standard"
                        size="small"
                        sx={{ minWidth: 180, fontWeight: 700 }}
                        inputProps={{ style: { fontWeight: 700, fontSize: "1.1rem" } }}
                    />
                }
                actions={
                    <>
                        {/* In the bar rather than above the table: it is the figure every other
                            number on this screen is measured from, and it used to scroll away with
                            the rows. Left of the actions, so the two buttons stay where the thumb
                            expects them. Owners only -- baseBalance is null for anyone else. */}
                        {isOwner && (
                            <Typography
                                variant="body2"
                                data-testid="opening-balance"
                                sx={{
                                    color: "text.secondary",
                                    fontWeight: 700,
                                    mr: 2,
                                    whiteSpace: "nowrap",
                                    display: { xs: "none", sm: "block" },
                                }}
                            >
                                Opening balance:{" "}
                                {baseBalance != null ? baseBalance.toFixed(3) : "—"}
                            </Typography>
                        )}

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
                    </>
                }
            />

            {/* A bounded flex column: the alert and chips row stay put and the table region below
                takes what is left, so it (not the page) is what scrolls. minHeight: 0 is what lets a
                flex child shrink below its content height. */}
            <Box sx={{ p: 2, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, flexShrink: 0 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {loading ? (
                    <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {chips.length > 0 && (
                            <Box
                                data-testid="filter-chips"
                                sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1, flexShrink: 0 }}
                            >
                                {chips.map((chip) => (
                                    <Chip
                                        key={chip.key}
                                        data-testid={`chip-${chip.key}`}
                                        size="small"
                                        variant="outlined"
                                        label={chip.label}
                                        onDelete={chip.onRemove}
                                        deleteIcon={<CloseRoundedIcon />}
                                        sx={{
                                            color: BRAND_RED,
                                            borderColor: BRAND_RED,
                                            "& .MuiChip-deleteIcon": { color: BRAND_RED },
                                        }}
                                    />
                                ))}
                                <Typography variant="body2" color="text.secondary" data-testid="showing-count">
                                    {`Showing ${sortedRows.length} of ${rows.length}`}
                                </Typography>
                                <Button
                                    size="small"
                                    data-testid="clear-all"
                                    onClick={handleClearAll}
                                    sx={{ textTransform: "none", fontWeight: 700, color: BRAND_RED }}
                                >
                                    Clear all
                                </Button>
                            </Box>
                        )}
                        <TableContainer
                            component={Paper}
                            elevation={0}
                            // Its own bounded, two-axis scroll region: sticky headers stick to the
                            // nearest scrolling ancestor, so this must be the one that scrolls
                            // vertically. flexShrink (no grow) so a short table stays short.
                            sx={{
                                borderRadius: 4,
                                flex: "0 1 auto",
                                minHeight: 0,
                                overflow: "auto",
                                overscrollBehavior: "contain",
                                WebkitOverflowScrolling: "touch",
                            }}
                        >
                            <Table size="small" stickyHeader aria-label="accounting entries">
                                <TableHead sx={{ bgcolor: "#fff" }}>
                                    <TableRow>
                                        <TableCell aria-sort={ariaSortFor("date")} sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ColumnHeaderFilter
                                                label="Date"
                                                testId="header-sort-date"
                                                sortState={sortStateFor("date")}
                                                onSort={() => handleSortClick("date")}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Photo</TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ButtonBase
                                                data-testid="header-type-cycle"
                                                onClick={handleTypeCycle}
                                                sx={{
                                                    fontWeight: "bold",
                                                    fontSize: "inherit",
                                                    fontFamily: "inherit",
                                                    color: filters.type === "ALL" ? "text.secondary" : BRAND_RED,
                                                    borderRadius: 1,
                                                    px: 0.5,
                                                }}
                                            >
                                                {`Type: ${TYPE_FILTER_LABELS[filters.type]}`}
                                            </ButtonBase>
                                        </TableCell>
                                        <TableCell aria-sort={ariaSortFor("amount")} sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ColumnHeaderFilter
                                                label="Amount"
                                                testId="header-sort-amount"
                                                sortState={sortStateFor("amount")}
                                                onSort={() => handleSortClick("amount")}
                                            />
                                        </TableCell>
                                        <TableCell aria-sort={ariaSortFor("note")} sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ColumnHeaderFilter
                                                label="Description"
                                                testId="header-sort-note"
                                                sortState={sortStateFor("note")}
                                                filter={{
                                                    active: filters.note.trim() !== "",
                                                    ariaLabel: "Filter description",
                                                    testId: "header-filter-note",
                                                    children: (popover) => (
                                                        <TextFilterPopover
                                                            {...popover}
                                                            value={noteDraft}
                                                            onChange={setNoteDraft}
                                                            ariaLabel="Description contains"
                                                            sort={{ dir: sortStateFor("note").dir, onSelect: (d) => handleSortSet("note", d) }}
                                                        />
                                                    ),
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell aria-sort={ariaSortFor("account")} sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ColumnHeaderFilter
                                                label="Account"
                                                testId="header-sort-account"
                                                sortState={sortStateFor("account")}
                                                filter={{
                                                    active: filters.accounts.length > 0,
                                                    ariaLabel: "Filter account",
                                                    testId: "header-filter-account",
                                                    children: (popover) => (
                                                        <MultiSelectFilterPopover
                                                            {...popover}
                                                            options={ACCOUNT_FILTER_OPTIONS}
                                                            selected={filters.accounts}
                                                            onToggle={handleAccountToggle}
                                                            sort={{ dir: sortStateFor("account").dir, onSelect: (d) => handleSortSet("account", d) }}
                                                        />
                                                    ),
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell aria-sort={ariaSortFor("category")} sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                            <ColumnHeaderFilter
                                                label="Category"
                                                testId="header-sort-category"
                                                sortState={sortStateFor("category")}
                                                filter={{
                                                    active: filters.categoryIds.length > 0,
                                                    ariaLabel: "Filter category",
                                                    testId: "header-filter-category",
                                                    children: (popover) => (
                                                        <MultiSelectFilterPopover
                                                            {...popover}
                                                            options={categoryFilterOptions}
                                                            selected={filters.categoryIds}
                                                            onToggle={handleCategoryToggle}
                                                            sort={{ dir: sortStateFor("category").dir, onSelect: (d) => handleSortSet("category", d) }}
                                                            searchable
                                                        />
                                                    ),
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>Contributor</TableCell>
                                        {isOwner && (
                                            <TableCell sx={{ fontWeight: "bold", color: "text.secondary" }}>
                                                <Tooltip title="Balance after this transaction" arrow>
                                                    <span>Balance</span>
                                                </Tooltip>
                                            </TableCell>
                                        )}
                                        {/* Header for the delete-button column: unlabelled visually,
                                            but it has to exist so head and body column counts match. */}
                                        <TableCell aria-label="Actions" sx={{ width: 40, pr: 1 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {visibleRows.map((row) => {
                                        const isCredit = row.type === "CREDIT";
                                        const pill = isCredit ? amountStyles.credit : amountStyles.debit;
                                        const hasAmount = row.amount !== "" && !isNaN(parseFloat(row.amount));

                                        return (
                                            <TableRow
                                                key={row._key}
                                                sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                                            >
                                                {/* Date */}
                                                <TableCell sx={{ minWidth: 190 }}>
                                                    {/* datetime-local, not date: entries are filtered
                                                        and ordered on occurred_at, and a date-only
                                                        value wrote every entry to midnight — so a
                                                        day's entries all shared one instant and
                                                        their order came down to array position. */}
                                                    <TextField
                                                        type="datetime-local"
                                                        value={row.date}
                                                        onChange={(e) =>
                                                            updateRow(row._key, { date: e.target.value })
                                                        }
                                                        size="small"
                                                        variant="standard"
                                                        sx={{ width: 185, ...noUnderlineSx }}
                                                    />
                                                </TableCell>

                                                {/* Receipt photo */}
                                                <TableCell sx={{ minWidth: 90 }}>
                                                    <EntryImageField
                                                        rowKey={row._key}
                                                        serverId={row.id ?? null}
                                                        hasImage={row.hasImage}
                                                        pendingImage={row.pendingImage}
                                                        removeImage={row.removeImage}
                                                        onChange={(patch) => updateRowPhoto(row._key, patch)}
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
                                                        // flex-start, not center: once the note wraps,
                                                        // centring pushes the first line off the top
                                                        // of the pill.
                                                        alignItems: "flex-start",
                                                        fontWeight: "bold",
                                                        fontSize: "0.9rem",
                                                    }}>
                                                        {/* multiline: the description carries the
                                                            only account of WHY an entry exists, and
                                                            a single-line input scrolled it out of
                                                            sight the moment it ran past the column.
                                                            maxRows caps the growth so one essay
                                                            cannot stretch every other row's height.
                                                            The styling moves from "& input" to
                                                            "& textarea" — multiline renders a
                                                            textarea, and the old selector would
                                                            simply stop matching. */}
                                                        <TextField
                                                            value={row.note}
                                                            onChange={(e) =>
                                                                updateRow(row._key, { note: e.target.value })
                                                            }
                                                            size="small"
                                                            variant="standard"
                                                            placeholder="—"
                                                            multiline
                                                            maxRows={4}
                                                            sx={{
                                                                width: 160,
                                                                ...noUnderlineSx,
                                                                "& textarea": {
                                                                    fontSize: "0.85rem",
                                                                    color: pill.text,
                                                                    fontWeight: "bold",
                                                                    padding: 0,
                                                                    lineHeight: 1.35,
                                                                },
                                                                "& textarea::placeholder": { color: pill.text, opacity: 0.5 },
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
                                                            displayEmpty
                                                            data-testid="account-select"
                                                            inputProps={{ "aria-label": "account" }}
                                                            value={row.account ?? NO_ACCOUNT}
                                                            onChange={(e: SelectChangeEvent) =>
                                                                updateRow(row._key, {
                                                                    // "" is the blank option; it goes
                                                                    // to the server as null, not as
                                                                    // an empty string it would then
                                                                    // fail to parse into the enum.
                                                                    account: e.target.value === NO_ACCOUNT
                                                                        ? null
                                                                        : (e.target.value as AccountSource),
                                                                })
                                                            }
                                                            size="small"
                                                            variant="standard"
                                                            sx={{ fontSize: "0.9rem", color: pill.text, fontWeight: "bold", ...noUnderlineSx }}
                                                        >
                                                            <MenuItem value={NO_ACCOUNT}>
                                                                <em>—</em>
                                                            </MenuItem>
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

                                                {/* Running balance (OWNER only) */}
                                                {isOwner && (
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
                                                                    : persistedReportId === null
                                                                        ? "After save"
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
                                    {rows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={emptyColSpan}
                                                align="center"
                                                sx={{ py: 3, color: "text.secondary" }}
                                            >
                                                No entries yet — click “Add” to create one
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {rows.length > 0 && sortedRows.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={emptyColSpan}
                                                align="center"
                                                sx={{ py: 3, color: "text.secondary" }}
                                            >
                                                No entries match the filters{" "}
                                                <Button
                                                    size="small"
                                                    data-testid="filters-empty-clear"
                                                    onClick={handleClearFilters}
                                                    sx={{ textTransform: "none", fontWeight: 700, color: BRAND_RED }}
                                                >
                                                    Clear filters
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {/* Outside the table: a Box is not valid inside tbody, and the sentinel
                                has to sit in normal flow for the observer to see it. */}
                            {hasMoreRows && (
                                <InfiniteScrollSentinel sentinelRef={sentinelRef}
                                                        testId="accounting-entries-sentinel"/>
                            )}
                        </TableContainer>
                    </>
                )}
            </Box>
        </Dialog>
        <UnsavedChangesPrompt
            open={promptOpen}
            saving={saving}
            onRevert={handlePromptRevert}
            onSave={handlePromptSave}
            onDismiss={handlePromptDismiss}
        />
        </>
    );
}
