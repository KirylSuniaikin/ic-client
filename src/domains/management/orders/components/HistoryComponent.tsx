import React, {useEffect, useRef, useState} from "react";
import { LoadingIndicator } from "../../../../shared/components/LoadingIndicator";
import OrderCard from "./OrderCard";
import {Box, Chip, IconButton, InputBase, Tooltip, Typography} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarTodayRoundedIcon from "@mui/icons-material/CalendarTodayRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {endOfDay, format, parseISO, startOfDay} from "date-fns";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import type { Order } from '../../../order/types';
import {useDeleteOrder} from "../hooks/useDeleteOrder";
import {useOrderHistory} from "../hooks/useOrderHistory";
import {DeleteOrderDialog} from "./DeleteOrderDialog";
import {BranchSelectorComponent} from "../../_shared/components/BranchSelectorComponent";
import {useBranchScope} from "../../_shared/hooks/useBranchScope";
import type {IBranch} from "../../inventory/types";
import {DateRangePickerPopover} from "../../statistics/components/performance/DateRangePickerPopover";
import {formatStatRange} from "../../statistics/components/performance/statsFormat";
import type {DateRangeState} from "../../statistics/types";
import type {HistoryDateRange} from "../../../order/types";
import {BRAND_RED} from "../../../../shared/utils/theme";

// The search field has no mode switch -- what you type IS the filter, picked purely by shape.
// Mirrors classifySearchInput() in useOrderHistory.ts; keep the two in sync.
const searchLegend = (
    <Box sx={{p: 0.5, maxWidth: 280}}>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>4 digits</b> — order no, or the last 4 digits of a Keeta/Jahez/Talabat id (the number
            printed on the ticket) — e.g. <b>1234</b>
        </Typography>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>8 digits</b> — internal order id — e.g. <b>10004523</b>
        </Typography>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>11+ digits</b> — telephone no, with country code — e.g. <b>97311111111</b>
        </Typography>
        <Typography variant="caption" component="div" sx={{mb: 0.5}}>
            <b>16 digits</b> — full external id — e.g. <b>1234567890123456</b>
        </Typography>
        <Typography variant="caption" component="div">
            <b>anything else</b> — customer name — e.g. <b>Ahmed</b>
        </Typography>
    </Box>
);

// What the calendar opens on: the applied range, or today when none is applied -- never a range
// that was picked and then dismissed without Apply.
function pickerRangeFor(applied: HistoryDateRange | null): DateRangeState[] {
    if (applied === null) {
        const now = new Date();
        return [{startDate: startOfDay(now), endDate: endOfDay(now), key: "selection"}];
    }
    return [{startDate: parseISO(applied.startDate), endDate: parseISO(applied.finishDate), key: "selection"}];
}

interface HistoryComponentProps {
    onClose: () => void;
    selectedBranch: IBranch;
}

function HistoryComponent({onClose, selectedBranch}: HistoryComponentProps): JSX.Element {
    const {branches, branch: scopedBranch, setBranch: setScopedBranch, canSwitch} = useBranchScope(selectedBranch);
    const {
        orders,
        setOrders,
        loading,
        error,
        searchInput,
        setSearchInput,
        dateRange,
        setDateRange,
        loadMore,
    } = useOrderHistory(scopedBranch.id);

    const [searchOpen, setSearchOpen] = useState(false);
    const [calendarAnchorEl, setCalendarAnchorEl] = useState<HTMLElement | null>(null);
    const [pickerRange, setPickerRange] = useState<DateRangeState[]>(() => pickerRangeFor(null));

    const {deleteDialogOpen, orderToDelete, handleDeleteClick, confirmDelete, cancelDelete} =
        useDeleteOrder((id) => setOrders(prev => prev.filter((order: Order) => order.id !== id)));

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Watches an invisible sentinel rendered after the last card; when it scrolls
    // into view, request the next page (spec §6.6).
    // `loading` is included in the deps so the observer is attached only once a list is actually
    // on screen. The sentinel node now stays mounted through the loading state (only the list
    // itself is swapped for the spinner), but attaching while a fetch is in flight would let an
    // already-visible sentinel fire loadMore against stale results — hence the guard below, and
    // the re-run after every loader->list transition (mount, and each debounced search re-fetch).
    useEffect(() => {
        if (loading) return;

        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries.some(entry => entry.isIntersecting)) {
                loadMore();
            }
        });

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [loadMore, loading]);

    const handleToggleSearch = (): void => {
        setSearchOpen(prev => {
            const next = !prev;
            if (!next) {
                setSearchInput("");
                setDateRange(null);
            }
            return next;
        });
    };

    const handleOpenCalendar = (event: React.MouseEvent<HTMLElement>): void => {
        setPickerRange(pickerRangeFor(dateRange));
        setCalendarAnchorEl(event.currentTarget);
    };

    const handleApplyRange = (): void => {
        setDateRange({
            startDate: format(pickerRange[0].startDate, "yyyy-MM-dd"),
            finishDate: format(pickerRange[0].endDate, "yyyy-MM-dd"),
        });
        setCalendarAnchorEl(null);
    };

    if (error) return <div>Error: {error}</div>;

    const sortedOrders = [...orders].sort(
        (a, b) => new Date(b.order_created).getTime() - new Date(a.order_created).getTime()
    );

    return (
        <div
            className="p-4 max-w-4xl mx-auto"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100dvh',
                overflow: 'hidden'
            }}
        >
            <Box sx={{
                gap: 1,
                flexShrink: 0,
            }}>
                <ManagementTopBar
                    title="Order History"
                    onBack={onClose}
                    branchSelector={canSwitch ? (
                        <BranchSelectorComponent
                            branches={branches}
                            selectedBranch={scopedBranch}
                            onBranchChange={setScopedBranch}
                        />
                    ) : undefined}
                    actions={
                        <IconButton edge="end" onClick={handleToggleSearch} aria-label="search" size="small">
                            {searchOpen ? <CloseIcon/> : <SearchIcon/>}
                        </IconButton>
                    }
                />
            </Box>
            {searchOpen && (
                <Box sx={{
                    px: 2,
                    py: 1,
                    flexShrink: 0,
                    backgroundColor: "#fbfaf6",
                    borderBottom: 1,
                    borderColor: "divider",
                    // The range chip sits beside the input on a wide screen and wraps under it on a phone.
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                }}>
                    <InputBase
                        autoFocus
                        placeholder="Search by order id, external id, telephone no, or customer name"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        endAdornment={
                            <Tooltip title={searchLegend} arrow enterTouchDelay={0} leaveTouchDelay={8000}>
                                <InfoOutlinedIcon fontSize="small" sx={{color: "text.disabled", cursor: "pointer"}}/>
                            </Tooltip>
                        }
                        sx={{
                            flex: "1 1 220px",
                            minWidth: 0,
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            backgroundColor: "#fff",
                            border: 1,
                            borderColor: "divider",
                        }}
                    />
                    <IconButton onClick={handleOpenCalendar} aria-label="filter by date" size="small">
                        <CalendarTodayRoundedIcon fontSize="small" sx={{color: BRAND_RED}}/>
                    </IconButton>
                    {dateRange !== null && (
                        <Chip
                            data-testid="history-date-range-chip"
                            size="small"
                            variant="outlined"
                            label={formatStatRange(dateRange.startDate, dateRange.finishDate)}
                            onDelete={() => setDateRange(null)}
                            deleteIcon={<CloseRoundedIcon/>}
                            sx={{
                                color: BRAND_RED,
                                borderColor: BRAND_RED,
                                "& .MuiChip-deleteIcon": {color: BRAND_RED},
                            }}
                        />
                    )}
                    <DateRangePickerPopover
                        mode="range"
                        id="history-date-range-popover"
                        open={Boolean(calendarAnchorEl)}
                        anchorEl={calendarAnchorEl}
                        onClose={() => setCalendarAnchorEl(null)}
                        range={pickerRange}
                        onRangeChange={setPickerRange}
                        applyLabel="Apply"
                        onApply={handleApplyRange}
                    />
                </Box>
            )}
            {/* No scroll anchoring: under the old Masonry layout it followed appended cards as they
                were re-ordered and landed the list back on its first orders (owner, 19 Oct 2026). The
                grid appends pages below what is on screen, so there is nothing to anchor. */}
            <Box data-testid="history-scroll-list" sx={{
                pt: 1,
                pl: 1,
                backgroundColor: "#fbfaf6",
                flex: 1,
                overflowY: 'auto',
                overscrollBehaviorY: 'contain',
                overflowAnchor: 'none',
                width: '100%'
            }}>
            {/* Only the list is swapped for the spinner: a debounced search re-fetches on every
                keystroke pause, so blanking the whole screen would take away the search box the
                user is still typing into. The sentinel below stays mounted for the same reason —
                its observer effect already skips attaching while `loading` is true. */}
            {loading ? (
                <LoadingIndicator minHeight={240} />
            ) : sortedOrders.length === 0 ? (
                <Typography sx={{p: 2, color: "text.secondary"}}>No orders found.</Typography>
            ) : (
                // Rows rather than Masonry (owner, 24 Oct 2026): orders read left to right, newest
                // first, and each row starts below the tallest ticket of the row above.
                <Box
                    data-testid="history-order-grid"
                    sx={{
                        display: "grid",
                        gridTemplateColumns: {
                            xs: "repeat(1, minmax(0, 1fr))",
                            sm: "repeat(2, minmax(0, 1fr))",
                            md: "repeat(3, minmax(0, 1fr))",
                            lg: "repeat(4, minmax(0, 1fr))",
                        },
                        gap: 1,
                        // OrderCard brings its own bottom margin for the live board; here the gap alone
                        // spaces the tickets, 8px each way as under Masonry. "&&" outranks the card's
                        // class whichever order emotion inserted the two in.
                        "&& > *": {m: 0},
                        // The scroll box is 100% wide plus its left padding, so its last 8px are off
                        // screen; Masonry stopped short of them too.
                        pr: 1,
                    }}
                >
                    {sortedOrders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onReadyClick={() => setOrders(prevState => prevState.filter(prev => prev.id !== order.id))}
                            isHistory={true}
                            onDeleteClick={() => {handleDeleteClick(order)}}/>
                    ))}
                </Box>
            )}
            <div ref={sentinelRef} data-testid="history-scroll-sentinel" style={{height: 1}}/>
            </Box>

            <DeleteOrderDialog
                open={deleteDialogOpen}
                order={orderToDelete}
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
            />
        </div>
    )
}

export default HistoryComponent;
