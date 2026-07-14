import React, {useEffect, useRef, useState} from "react";
import PizzaLoader from "../../../order-status/components/animations/PizzaLoader";
import OrderCard from "./OrderCard";
import {Box, IconButton, InputBase, Tooltip, Typography} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {Masonry} from "@mui/lab";
import {ManagementTopBar} from "../../_shared/components/ManagementTopBar";
import type { Order } from '../../../order/types';
import {useDeleteOrder} from "../hooks/useDeleteOrder";
import {useOrderHistory} from "../hooks/useOrderHistory";
import {DeleteOrderDialog} from "./DeleteOrderDialog";

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

interface SelectedBranch {
    id: string;
    [key: string]: unknown;
}

interface HistoryComponentProps {
    onClose: () => void;
    selectedBranch: SelectedBranch;
}

function HistoryComponent({onClose, selectedBranch}: HistoryComponentProps): JSX.Element {
    const {
        orders,
        setOrders,
        loading,
        error,
        searchInput,
        setSearchInput,
        loadMore,
    } = useOrderHistory(selectedBranch.id);

    const [searchOpen, setSearchOpen] = useState(false);

    const {deleteDialogOpen, orderToDelete, handleDeleteClick, confirmDelete, cancelDelete} =
        useDeleteOrder((id) => setOrders(prev => prev.filter((order: Order) => order.id !== id)));

    const sentinelRef = useRef<HTMLDivElement | null>(null);

    // Watches an invisible sentinel rendered after the last card; when it scrolls
    // into view, request the next page (spec §6.6).
    // `loading` is included in the deps: while loading is true the component below
    // early-returns <PizzaLoader/> and the sentinel node isn't mounted, so this effect
    // must re-run after each loader->list transition to (re)observe the node that is
    // actually in the DOM (mount, and again after every debounced search re-fetch).
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
            if (!next) setSearchInput("");
            return next;
        });
    };

    if (loading) {
        return <PizzaLoader/>;
    }
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
                }}>
                    <InputBase
                        autoFocus
                        fullWidth
                        placeholder="Search by order id, external id, telephone no, or customer name"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        endAdornment={
                            <Tooltip title={searchLegend} arrow enterTouchDelay={0} leaveTouchDelay={8000}>
                                <InfoOutlinedIcon fontSize="small" sx={{color: "text.disabled", cursor: "pointer"}}/>
                            </Tooltip>
                        }
                        sx={{
                            px: 1.5,
                            py: 0.5,
                            borderRadius: 2,
                            backgroundColor: "#fff",
                            border: 1,
                            borderColor: "divider",
                        }}
                    />
                </Box>
            )}
            <Box sx={{
                pt: 1,
                pl: 1,
                backgroundColor: "#fbfaf6",
                flex: 1,
                overflowY: 'auto',
                overscrollBehaviorY: 'contain',
                width: '100%'
            }}>
            {sortedOrders.length === 0 ? (
                <Typography sx={{p: 2, color: "text.secondary"}}>No orders found.</Typography>
            ) : (
                <Masonry columns={{ xs: 1, sm: 2, md: 3, lg: 4 }} spacing={1} sequential>
                    {sortedOrders.map((order) => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onReadyClick={() => setOrders(prevState => prevState.filter(prev => prev.id !== order.id))}
                            isHistory={true}
                            onDeleteClick={() => {handleDeleteClick(order)}}/>
                    ))}
                </Masonry>
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
