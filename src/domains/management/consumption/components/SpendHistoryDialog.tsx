import React, {useEffect, useState} from "react";
import {Box, Card, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Typography} from "@mui/material";
import {alpha, useTheme} from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import {fetchSpendHistory} from "../../../../shared/api/management";
import {ProductPriceTrend, SpendHistoryTO, SpendMonth} from "../types";
import {monthLabel, priceDirection, pricedPoints} from "../spendHistory";

type Props = {
    open: boolean;
    onClose: () => void;
    branchId: string;
    // "" = every vendor / every product.
    vendor: string;
    product: string;
};

const MAX_PRODUCT_CARDS = 12;

function SpendBars({months}: {months: SpendMonth[]}) {
    const theme = useTheme();
    const max = Math.max(...months.map((m) => m.spent), 1);
    return (
        <Box sx={{display: "flex", alignItems: "flex-end", gap: 1.5, height: 170, pt: 3}}>
            {months.map((m, i) => (
                <Box key={m.month} sx={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end"}}>
                    <Typography variant="caption" sx={{fontVariantNumeric: "tabular-nums", mb: 0.5}} color="text.secondary">
                        {m.spent > 0 ? m.spent.toFixed(0) : "–"}
                    </Typography>
                    <Box
                        data-testid="spend-bar"
                        sx={{
                            width: "100%",
                            maxWidth: 44,
                            height: `${(m.spent / max) * 100}%`,
                            minHeight: m.spent > 0 ? 4 : 2,
                            borderRadius: "6px 6px 0 0",
                            bgcolor: i === months.length - 1 ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.35),
                        }}
                    />
                    <Typography variant="caption" sx={{mt: 0.5, fontWeight: i === months.length - 1 ? 700 : 400}}>
                        {monthLabel(m.month)}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}

function Sparkline({trend}: {trend: ProductPriceTrend}) {
    const theme = useTheme();
    const points = pricedPoints(trend.prices);
    const width = 120;
    const height = 36;
    if (points.length < 2) {
        return <Typography variant="caption" color="text.disabled">one purchase</Typography>;
    }
    const values = points.map((p) => p.unitPrice);
    const min = Math.min(...values);
    const span = Math.max(...values) - min || 1;
    const step = width / (trend.prices.length - 1);
    const coords = points.map((p) => `${(p.index * step).toFixed(1)},${(height - 4 - ((p.unitPrice - min) / span) * (height - 8)).toFixed(1)}`);
    const color = trend.changePercent !== null && trend.changePercent > 0 ? theme.palette.error.main : theme.palette.success.main;
    return (
        <svg width={width} height={height} aria-hidden>
            <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function ChangeChip({changePercent}: {changePercent: number | null}) {
    const direction = priceDirection(changePercent);
    if (direction === "unknown") return <Chip size="small" label="no trend" variant="outlined" />;
    const icon = direction === "up" ? <TrendingUpIcon /> : direction === "down" ? <TrendingDownIcon /> : <TrendingFlatIcon />;
    const color = direction === "up" ? "error" : direction === "down" ? "success" : "default";
    const sign = direction === "up" ? "+" : "";
    return <Chip size="small" icon={icon} color={color} label={`${sign}${changePercent!.toFixed(1)}%`} />;
}

function ProductPriceCard({trend}: {trend: ProductPriceTrend}) {
    const points = pricedPoints(trend.prices);
    const last = points.length ? points[points.length - 1].unitPrice : null;
    return (
        <Card variant="outlined" data-testid="price-card" sx={{p: 1.5, borderRadius: 3, display: "flex", flexDirection: "column", gap: 0.5}}>
            <Typography sx={{fontWeight: 600}} noWrap title={trend.productName}>{trend.productName}</Typography>
            <Box sx={{display: "flex", alignItems: "baseline", gap: 1}}>
                <Typography sx={{fontSize: 20, fontWeight: 700, fontVariantNumeric: "tabular-nums"}}>
                    {last === null ? "—" : last.toFixed(3)}
                </Typography>
                <Typography variant="caption" color="text.secondary">BD / unit</Typography>
            </Box>
            <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                <Sparkline trend={trend} />
                <ChangeChip changePercent={trend.changePercent} />
            </Box>
            <Typography variant="caption" color="text.secondary">Spent {trend.spent.toFixed(3)} BD</Typography>
        </Card>
    );
}

export function SpendHistoryDialog({open, onClose, branchId, vendor, product}: Props) {
    const [history, setHistory] = useState<SpendHistoryTO | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setHistory(null);
        setErr(null);
        fetchSpendHistory(branchId, vendor, product)
            .then((h) => { if (!cancelled) setHistory(h); })
            .catch((e: Error) => { if (!cancelled) setErr(e?.message ?? "Failed to load"); });
        return () => { cancelled = true; };
    }, [open, branchId, vendor, product]);

    const total = history ? history.months.reduce((sum, m) => sum + m.spent, 0) : 0;
    const title = product || vendor || "All vendors";
    const subtitle = product ? (vendor || "All vendors") : "Purchases, last 6 months";

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{paper: {sx: {borderRadius: 4}}}}>
            <DialogTitle sx={{display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1}}>
                <Box>
                    <Typography variant="h6" sx={{fontWeight: 700}}>{title}</Typography>
                    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
                </Box>
                <IconButton onClick={onClose} aria-label="Close"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{display: "flex", flexDirection: "column", gap: 2, pb: 3}}>
                {err && <Typography color="error">{err}</Typography>}
                {!history && !err && <Box sx={{display: "flex", justifyContent: "center", py: 6}}><CircularProgress /></Box>}
                {history && (
                    <>
                        <Card variant="outlined" sx={{p: 2, borderRadius: 3}}>
                            <Box sx={{display: "flex", alignItems: "baseline", justifyContent: "space-between"}}>
                                <Typography variant="subtitle2" color="text.secondary">Spent per month</Typography>
                                <Typography sx={{fontWeight: 700, fontVariantNumeric: "tabular-nums"}}>
                                    {total.toFixed(3)} <Typography component="span" variant="body2" color="text.secondary">BD · 6 months</Typography>
                                </Typography>
                            </Box>
                            <SpendBars months={history.months} />
                        </Card>
                        <Typography variant="subtitle2" color="text.secondary">Unit price trend</Typography>
                        {history.products.length === 0 ? (
                            <Typography color="text.secondary">No purchases in the last 6 months.</Typography>
                        ) : (
                            <Box sx={{display: "grid", gap: 1.5, gridTemplateColumns: {xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)"}}}>
                                {history.products.slice(0, MAX_PRODUCT_CARDS).map((t) => <ProductPriceCard key={t.productName} trend={t} />)}
                            </Box>
                        )}
                        {history.products.length > MAX_PRODUCT_CARDS && (
                            <Typography variant="caption" color="text.secondary">
                                Showing the top {MAX_PRODUCT_CARDS} of {history.products.length} products by spend.
                            </Typography>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
