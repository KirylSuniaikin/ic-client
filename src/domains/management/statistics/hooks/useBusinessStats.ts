import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {format, subMonths} from "date-fns";
import {getBusinessStats, patchChannelOverride} from "../../../../shared/api/management";
import {ChannelRowConflictError} from "../types";
import type {
    BusinessStatsResponse, ChannelField, ChannelOverridePatch, ChannelPerformanceMonth, ChannelPerformanceRow
} from "../types";
import {logger} from "../../../../shared/utils/logger";
import {p2, toDecimal} from "../../../../shared/utils/decimalUtils";
import type {MonthRange} from "../components/business/MonthRangePickerPopover";
import {CHANNEL_FIELD_LABELS, describeSaveError, shortMonthLabel} from "../components/business/businessFormat";

/**
 * The report opens on the CURRENT month only.
 *
 * <p>It used to open on the last seven, which meant every visit paid for seven months of pivot,
 * P&L, KPI and inventory computation before anyone had said what they wanted to look at — and the
 * answer to "how are we doing" is almost always this month. History is one click away in the picker,
 * and the presets there still reach back 3, 6 and 12 months.
 */
const DEFAULT_MONTHS_BACK = 0;

/** Mirrors the server's own limit, so an over-long range is refused here rather than as a 400. */
const MAX_MONTHS = 24;

/**
 * How long the channel table must be quiet before the rest of the report (P&L, KPIs, notices) is
 * refetched behind it. Long enough that typing down a column costs one refetch, not one per cell.
 */
export const BACKGROUND_REFRESH_DELAY_MS = 600;

type UseBusinessStats = {
    loading: boolean;
    data: BusinessStatsResponse | null;
    range: MonthRange;
    rangeLabel: string;
    setRange: (range: MonthRange) => void;
    refresh: () => Promise<void>;
    /** Queues a save of one cell. Null clears the override; for app fees that clears the fee. */
    saveChannelCell: (period: string, channelKey: string, field: ChannelField, value: number | null) => void;
    /** Queues a revert of the row's orders and gross revenue. The app fee is kept. */
    revertChannelRow: (period: string, channelKey: string) => void;
    /** {@link channelCellKey}s with a save queued or in flight. */
    channelSaving: ReadonlySet<string>;
    /** {@link channelCellKey}s whose last save failed, with why. Cleared by that cell's next save. */
    channelErrors: ReadonlyMap<string, string>;
    channelSaveError: string | null;
    clearChannelSaveError: () => void;
};

type CellChange = { field: ChannelField; value: number | null };

type SaveJob = {
    period: string;
    channelKey: string;
    label: string;
    kind: "cell" | "revert";
    changes: CellChange[];
    token: number;
};

// A value the screen already shows while its save is queued or in flight.
type PendingCell = { period: string; channelKey: string; field: ChannelField; value: number | null; token: number };

const NO_PENDING: ReadonlyMap<string, PendingCell> = new Map();
const NO_ERRORS: ReadonlyMap<string, string> = new Map();

export function channelCellKey(period: string, channelKey: string, field: ChannelField): string {
    return `${period}|${channelKey}|${field}`;
}

function startOfThisMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Normalises a picked range before it can reach the server: a reversed range is swapped rather than
 * rejected (picking "to" before "from" is a normal way to use two calendars), and an over-long one
 * is trimmed from the far end so the months the owner most recently looked at survive.
 */
export function normalizeRange(range: MonthRange): MonthRange {
    const from = range.from <= range.to ? range.from : range.to;
    const to = range.from <= range.to ? range.to : range.from;

    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
    if (months <= MAX_MONTHS) return {from, to};

    return {from: new Date(to.getFullYear(), to.getMonth() - (MAX_MONTHS - 1), 1), to};
}

function findRow(
    report: BusinessStatsResponse | null,
    period: string,
    channelKey: string
): ChannelPerformanceRow | undefined {
    return report?.channels.find(m => m.period === period)?.rows.find(r => r.channelKey === channelKey);
}

function overlayRow(row: ChannelPerformanceRow, pending: ReadonlyMap<string, PendingCell>): ChannelPerformanceRow {
    const orders = pending.get(channelCellKey(row.period, row.channelKey, "orders"));
    const gross = pending.get(channelCellKey(row.period, row.channelKey, "grossRevenue"));
    const fees = pending.get(channelCellKey(row.period, row.channelKey, "appFees"));
    if (!orders && !gross && !fees) return row;

    const next: ChannelPerformanceRow = {...row};
    // A cleared override shows the live figure again straight away, exactly as the server will.
    if (orders) {
        next.overrideOrders = orders.value;
        next.effectiveOrders = orders.value ?? row.generatedOrders;
    }
    if (gross) {
        next.overrideGrossRevenue = gross.value;
        next.effectiveGrossRevenue = gross.value ?? row.generatedGrossRevenue;
    }
    if (fees) {
        next.overrideAppFees = fees.value;
        next.effectiveAppFees = fees.value;
        next.appFeesEntered = fees.value !== null;
    }
    return withDerivedFigures(next);
}

// Mirrors ChannelPerformanceService.toTO on the server, so a row waiting on its save never shows
// the new fee beside the old net revenue.
function withDerivedFigures(row: ChannelPerformanceRow): ChannelPerformanceRow {
    const gross = toDecimal(row.effectiveGrossRevenue);
    const fees = toDecimal(row.effectiveAppFees);
    return {
        ...row,
        netRevenue: gross.minus(fees).toNumber(),
        appCommissionPercent: gross.isZero() ? null : p2(fees.times(100).dividedBy(gross)).toNumber(),
    };
}

// Mirrors ChannelPerformanceService.toMonthTO: the Total row and the missing-fee warning follow the
// figures on screen, not the last ones the server answered with.
function withDerivedTotals(month: ChannelPerformanceMonth, rows: ChannelPerformanceRow[]): ChannelPerformanceMonth {
    const gross = rows.reduce((sum, r) => sum.plus(toDecimal(r.effectiveGrossRevenue)), toDecimal(0));
    const fees = rows.reduce((sum, r) => sum.plus(toDecimal(r.effectiveAppFees)), toDecimal(0));
    return {
        ...month,
        rows,
        totalOrders: rows.reduce((sum, r) => sum + (r.effectiveOrders ?? 0), 0),
        totalGrossRevenue: gross.toNumber(),
        totalAppFees: fees.toNumber(),
        totalNetRevenue: gross.minus(fees).toNumber(),
        appFeesMissing: rows.some(r => !r.appFeesEntered && (r.effectiveGrossRevenue ?? 0) > 0),
    };
}

function isCellChange(row: ChannelPerformanceRow, field: ChannelField, value: number | null): boolean {
    if (field === "orders") return value === null ? row.overrideOrders !== null : value !== row.effectiveOrders;
    if (field === "grossRevenue") {
        return value === null ? row.overrideGrossRevenue !== null : value !== row.effectiveGrossRevenue;
    }
    return value !== row.effectiveAppFees;
}

// Same content, same object: a memoized row then skips the re-render a fresh copy would force.
function sameRow(a: ChannelPerformanceRow, b: ChannelPerformanceRow): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/** Puts the server's copy of one month in place, keeping every row that did not change as it was. */
function withMonth(
    report: BusinessStatsResponse | null,
    incoming: ChannelPerformanceMonth
): BusinessStatsResponse | null {
    if (report === null) return null;
    const index = report.channels.findIndex(m => m.period === incoming.period);
    if (index === -1) return report;

    const current = report.channels[index];
    const rows = incoming.rows.map(row => {
        const previous = current.rows.find(r => r.channelKey === row.channelKey);
        return previous && sameRow(previous, row) ? previous : row;
    });
    const channels = report.channels.slice();
    channels[index] = {...incoming, rows};
    return {...report, channels};
}

// The job's cells that no later save has taken over. Only these are the job's to settle: a cell
// re-edited while this save was queued shows, and reports on, the newer save.
function ownedKeys(pending: ReadonlyMap<string, PendingCell>, job: SaveJob): string[] {
    return job.changes
        .map(change => channelCellKey(job.period, job.channelKey, change.field))
        .filter(key => pending.get(key)?.token === job.token);
}

function payloadFor(job: SaveJob, version: number | null): ChannelOverridePatch {
    const change = (field: ChannelField): CellChange | undefined => job.changes.find(c => c.field === field);
    const valueOf = (field: ChannelField): number | null => change(field)?.value ?? null;
    const clears = (field: ChannelField): boolean => {
        const c = change(field);
        return c !== undefined && c.value === null;
    };
    return {
        period: job.period,
        channelKey: job.channelKey,
        version,
        orders: valueOf("orders"),
        grossRevenue: valueOf("grossRevenue"),
        appFees: valueOf("appFees"),
        note: null,
        clearOrders: clears("orders"),
        clearGrossRevenue: clears("grossRevenue"),
        clearAppFees: clears("appFees"),
    };
}

function saveErrorMessage(job: SaveJob, error: unknown): string {
    const what = job.kind === "revert"
        ? `revert ${job.label} (${shortMonthLabel(job.period)})`
        : `save ${job.label} ${CHANNEL_FIELD_LABELS[job.changes[0].field]} (${shortMonthLabel(job.period)})`;
    // Not "someone else changed it": the other write may well have been the owner's own, elsewhere.
    if (error instanceof ChannelRowConflictError) {
        return `Couldn't ${what}: this row changed since it was loaded — the latest figures are shown.`;
    }
    return `Couldn't ${what}: ${describeSaveError(error)}`;
}

export function useBusinessStats(): UseBusinessStats {
    const [loading, setLoading] = useState<boolean>(false);
    // The server's figures as last received. What the screen shows is this plus `pending`.
    const [server, setServer] = useState<BusinessStatsResponse | null>(null);
    const [pending, setPending] = useState<ReadonlyMap<string, PendingCell>>(NO_PENDING);
    const [channelErrors, setChannelErrors] = useState<ReadonlyMap<string, string>>(NO_ERRORS);
    const [channelSaveError, setChannelSaveError] = useState<string | null>(null);
    const [range, setRangeState] = useState<MonthRange>(() => {
        const to = startOfThisMonth();
        return {from: subMonths(to, DEFAULT_MONTHS_BACK), to};
    });

    // Queued saves run after awaits, long before React re-renders, so they read and write these
    // refs rather than state: the version a save sends must be the one the previous save returned.
    const serverRef = useRef<BusinessStatsResponse | null>(null);
    const pendingRef = useRef<ReadonlyMap<string, PendingCell>>(NO_PENDING);
    const queueRef = useRef<Promise<void>>(Promise.resolve());
    const queuedJobsRef = useRef<number>(0);
    const tokenRef = useRef<number>(0);
    // Bumped by every refresh, and by every save as it is queued and as it settles. A refresh whose
    // number moved while it was in flight carries figures the screen has already moved past.
    const refreshSeqRef = useRef<number>(0);
    const mutationSeqRef = useRef<number>(0);
    const loudRefreshesRef = useRef<number>(0);
    const backgroundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keyed on the yyyy-MM strings, not the Date objects: two Dates for the same month are
    // different values and would refetch an identical range on every render.
    const fromKey = useMemo(() => format(range.from, "yyyy-MM"), [range.from]);
    const toKey = useMemo(() => format(range.to, "yyyy-MM"), [range.to]);
    const rangeKeysRef = useRef<{ from: string; to: string }>({from: fromKey, to: toKey});
    rangeKeysRef.current = {from: fromKey, to: toKey};

    const commitServer = useCallback((next: BusinessStatsResponse | null): void => {
        serverRef.current = next;
        setServer(next);
    }, []);

    const writePending = useCallback((mutate: (draft: Map<string, PendingCell>) => void): void => {
        const next = new Map(pendingRef.current);
        mutate(next);
        pendingRef.current = next;
        setPending(next);
    }, []);

    const load = useCallback(async (from: string, to: string, silent: boolean): Promise<void> => {
        const seq = ++refreshSeqRef.current;
        const mutationsAtStart = mutationSeqRef.current;
        if (!silent) {
            loudRefreshesRef.current += 1;
            setLoading(true);
        }
        try {
            const next = await getBusinessStats(from, to);
            // A newer refresh has been started, or a channel save overlapped this one: either way
            // these figures are older than what the screen holds, and applying them would bring
            // back a stale version that turns the owner's next edit into a 409.
            const stale = seq !== refreshSeqRef.current
                || mutationsAtStart !== mutationSeqRef.current
                || queuedJobsRef.current > 0;
            if (!stale) commitServer(next);
        } catch (e) {
            logger.error("Failed to load business stats", e);
        } finally {
            if (!silent) {
                loudRefreshesRef.current -= 1;
                if (loudRefreshesRef.current === 0) setLoading(false);
            }
        }
    }, [commitServer]);

    const refresh = useCallback(
        (): Promise<void> => load(fromKey, toKey, false),
        [load, fromKey, toKey]);

    const setRange = useCallback((next: MonthRange): void => {
        setRangeState(normalizeRange(next));
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // A save still in flight when the screen closes would otherwise schedule a full report refetch
    // after this cleanup has run.
    // Set in the effect body too, because StrictMode runs this cleanup once on a live component.
    const mountedRef = useRef<boolean>(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (backgroundTimerRef.current !== null) clearTimeout(backgroundTimerRef.current);
        };
    }, []);

    const cancelBackgroundRefresh = useCallback((): void => {
        if (backgroundTimerRef.current === null) return;
        clearTimeout(backgroundTimerRef.current);
        backgroundTimerRef.current = null;
    }, []);

    // The PATCH answer already brought the table up to date; this catches up everything built on
    // it (P&L, KPIs, notices) without the skeleton or the spinner, so the cell never waits for it.
    const scheduleBackgroundRefresh = useCallback((): void => {
        cancelBackgroundRefresh();
        if (!mountedRef.current) return;
        backgroundTimerRef.current = setTimeout(() => {
            backgroundTimerRef.current = null;
            void load(rangeKeysRef.current.from, rangeKeysRef.current.to, true);
        }, BACKGROUND_REFRESH_DELAY_MS);
    }, [cancelBackgroundRefresh, load]);

    /** Releases the cells the job still owns and returns their keys. */
    const settle = useCallback((job: SaveJob): string[] => {
        const owned = ownedKeys(pendingRef.current, job);
        writePending(draft => owned.forEach(key => draft.delete(key)));
        return owned;
    }, [writePending]);

    const clearCellErrors = useCallback((keys: readonly string[]): void => {
        setChannelErrors(prev => {
            if (!keys.some(k => prev.has(k))) return prev;
            const next = new Map(prev);
            keys.forEach(k => next.delete(k));
            return next;
        });
    }, []);

    const reloadMonth = useCallback(async (period: string): Promise<void> => {
        try {
            const fresh = await getBusinessStats(period, period);
            const month = fresh.channels.find(m => m.period === period);
            if (month) commitServer(withMonth(serverRef.current, month));
        } catch (e) {
            logger.error("Failed to reload channel performance", e);
        }
    }, [commitServer]);

    const runJob = useCallback(async (job: SaveJob): Promise<void> => {
        const version = findRow(serverRef.current, job.period, job.channelKey)?.version ?? null;
        try {
            const month = await patchChannelOverride(payloadFor(job, version));
            commitServer(withMonth(serverRef.current, month));
            // A cell's mark reflects its last settled save, so this one being saved retires any.
            clearCellErrors(settle(job));
        } catch (e) {
            logger.error("Failed to save channel performance", e);
            const owned = settle(job);
            const message = saveErrorMessage(job, e);
            setChannelSaveError(message);
            if (owned.length > 0) {
                setChannelErrors(prev => {
                    const next = new Map(prev);
                    owned.forEach(key => next.set(key, message));
                    return next;
                });
            }
            // Inside the queue, so the next queued save sends the version this brings back.
            await reloadMonth(job.period);
        } finally {
            mutationSeqRef.current += 1;
            queuedJobsRef.current -= 1;
            if (queuedJobsRef.current === 0) scheduleBackgroundRefresh();
        }
    }, [commitServer, settle, clearCellErrors, reloadMonth, scheduleBackgroundRefresh]);

    // One queue for the whole table: saves leave in the order they were made, and each reads the
    // row's version only when it is sent, after the save before it has answered with a new one.
    const enqueue = useCallback((job: Omit<SaveJob, "token">): void => {
        const queued: SaveJob = {...job, token: ++tokenRef.current};
        const keys = queued.changes.map(c => channelCellKey(queued.period, queued.channelKey, c.field));

        writePending(draft => {
            queued.changes.forEach((change, i) => draft.set(keys[i], {
                period: queued.period, channelKey: queued.channelKey, field: change.field,
                value: change.value, token: queued.token,
            }));
        });
        clearCellErrors(keys);

        mutationSeqRef.current += 1;
        queuedJobsRef.current += 1;
        cancelBackgroundRefresh();
        queueRef.current = queueRef.current.then(() => runJob(queued));
    }, [writePending, clearCellErrors, cancelBackgroundRefresh, runJob]);

    const saveChannelCell = useCallback((
        period: string,
        channelKey: string,
        field: ChannelField,
        value: number | null
    ): void => {
        const stored = findRow(serverRef.current, period, channelKey);
        if (!stored) return;
        const shown = overlayRow(stored, pendingRef.current);
        // Leaving a cell untouched must not pin the live figure as an override.
        if (!isCellChange(shown, field, value)) return;
        enqueue({period, channelKey, label: shown.channelLabel, kind: "cell", changes: [{field, value}]});
    }, [enqueue]);

    const revertChannelRow = useCallback((period: string, channelKey: string): void => {
        const stored = findRow(serverRef.current, period, channelKey);
        if (!stored) return;
        const shown = overlayRow(stored, pendingRef.current);
        if (shown.overrideOrders === null && shown.overrideGrossRevenue === null) return;
        // The app fee is deliberately not part of a revert: it has no live figure to fall back to,
        // so reverting it would simply delete it. Emptying its cell is the way to clear it.
        enqueue({
            period, channelKey, label: shown.channelLabel, kind: "revert",
            changes: [{field: "orders", value: null}, {field: "grossRevenue", value: null}],
        });
    }, [enqueue]);

    const clearChannelSaveError = useCallback((): void => setChannelSaveError(null), []);

    // Rows with nothing pending stay the server's own objects, so the memoized table rows skip them.
    const overlaidRows = useRef<WeakMap<ChannelPerformanceRow, { signature: string; row: ChannelPerformanceRow }>>(
        new WeakMap());
    const data = useMemo((): BusinessStatsResponse | null => {
        if (server === null || pending.size === 0) return server;
        const periods = new Set(Array.from(pending.values(), p => p.period));
        let changed = false;
        const channels = server.channels.map(month => {
            if (!periods.has(month.period)) return month;
            let monthChanged = false;
            const rows = month.rows.map(row => {
                const shown = overlayRow(row, pending);
                if (shown === row) return row;
                monthChanged = true;
                // Re-use the previous overlaid copy while this row's own pending values are the
                // same, so a save on another row does not re-render this one.
                const signature = JSON.stringify(shown);
                const cached = overlaidRows.current.get(row);
                if (cached && cached.signature === signature) return cached.row;
                overlaidRows.current.set(row, {signature, row: shown});
                return shown;
            });
            if (!monthChanged) return month;
            changed = true;
            return withDerivedTotals(month, rows);
        });
        return changed ? {...server, channels} : server;
    }, [server, pending]);

    const channelSaving = useMemo((): ReadonlySet<string> => new Set(pending.keys()), [pending]);

    const rangeLabel = useMemo(() => {
        const fmt = (d: Date): string =>
            d.toLocaleDateString("en-US", {month: "short", year: "numeric"});
        return `${fmt(range.from)} — ${fmt(range.to)}`;
    }, [range.from, range.to]);

    return {
        loading, data, range, rangeLabel, setRange, refresh,
        saveChannelCell, revertChannelRow, channelSaving, channelErrors, channelSaveError, clearChannelSaveError,
    };
}
