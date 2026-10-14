import React from "react";
import {Box, Card, CardContent, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography} from "@mui/material";
import {StatEmptyState, StatSkeleton} from "./performance/statPlaceholders";
import {noOfferReasonLabel} from "../../couriers/utils/noOfferReasonLabels";
import type {NoOfferReason} from "../../couriers/types";
import type {DeliverySkipReasonBucket, DeliverySkipReasonStats} from "../types";

/**
 * What buying your way out of this reason actually costs — the manual's own pricing (§06 item E),
 * not a second opinion invented here.
 *
 * Only the four reasons the manual prices are annotated. The others are real and are still listed
 * with their numbers; inventing an instruction for them would be guidance nobody decided on.
 */
const POINTS_TO: Partial<Record<NoOfferReason, string>> = {
    BUSY_UNTIL: "Hire a rider",
    NO_RESOLVABLE_FREE_AT: "Hire a rider",
    TOO_FAR: "The coverage map is wrong",
    POSITION_STALE: "Fix the phones",
};

/**
 * Skips divided by the orders they cost — the ratio that separates the two problems a raw skip
 * count cannot tell apart. Twenty skips over one order is one stalled ticket; twenty over twenty
 * is a systemic constraint.
 *
 * An em dash when no order was affected: a ratio with a zero denominator is not zero, it is
 * undefined, and printing "0.0" would say the opposite of what happened.
 */
export function formatSkipsPerOrder(skips: number, ordersAffected: number): string {
    if (ordersAffected <= 0) return "—";
    return (skips / ordersAffected).toFixed(1);
}

/**
 * Ordered by the number the card exists to answer — which reason cost us the most ORDERS — with
 * skips as the tiebreak and the payload's own enum order beneath that, so the order is total and
 * two identical payloads can never render differently.
 *
 * Every reason survives the sort, including the ones at zero: a reason that never fired is
 * information, and dropping it would make "no longer happening" look like "no longer reported".
 */
export function sortByOrdersAffected(buckets: DeliverySkipReasonBucket[]): DeliverySkipReasonBucket[] {
    return buckets
        .map((bucket, index) => ({bucket, index}))
        .sort((a, b) =>
            b.bucket.ordersAffected - a.bucket.ordersAffected ||
            b.bucket.skips - a.bucket.skips ||
            a.index - b.index)
        .map((entry) => entry.bucket);
}

type Props = {
    stats: DeliverySkipReasonStats | null;
    /** The APPLIED date range these figures were fetched for — never the range in the picker. */
    range: string | null;
};

/**
 * Why the assignment engine passed riders over, aggregated — delivery-manual.html §06 item E.
 *
 * The dispatcher board already explains one rider on one order. This is the same data over a
 * window, and it exists to answer a different question: which reason cost us the most ORDERS, and
 * therefore what to buy. Three rules follow from that:
 *
 *  - Skips are never shown alone. Twenty skips against one order and twenty against twenty are
 *    the same skip count and different problems, so the orders figure leads, the skip count sits
 *    beside it, and the ratio between them is printed rather than left to be worked out.
 *  - Every reason is listed even at zero. The payload always carries all of them, and a real zero
 *    is the evidence that a problem has stopped — which an omitted row would hide.
 *  - The totals are not the sum of the rows and the card says so. An order passed over for two
 *    reasons is in two buckets and is still one order.
 *
 * The branch filter above does not narrow these figures: the endpoint is read chain-wide, which is
 * also the only read that can see a skip recorded against an order with no branch.
 */
export function DeliverySkipReasonsCard({stats, range}: Props): JSX.Element {
    const rows = stats == null ? [] : sortByOrdersAffected(stats.byReason);
    // The reason that cost the most orders, and only when it actually cost any: a "most orders"
    // badge on a row of zeros would invent a culprit out of an empty week.
    const worst = rows.length > 0 && rows[0].ordersAffected > 0 ? rows[0].reason : null;

    return (
        <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
            <CardContent>
                <Box sx={{mb: 2}}>
                    <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>Riders Passed Over</b></Typography>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        why the assignment engine skipped a rider — priced in orders, not just skips
                    </Typography>
                    {range !== null && stats !== null && (
                        <Typography
                            data-testid="skip-reasons-scope"
                            variant="caption"
                            sx={{display: "block", mt: 0.5, fontWeight: 600, color: "text.secondary"}}
                        >
                            All branches · {range}
                        </Typography>
                    )}
                </Box>

                {stats == null ? (
                    <StatSkeleton lines={3}/>
                ) : stats.totalSkips === 0 ? (
                    <StatEmptyState message="No rider was passed over in this range"/>
                ) : (
                    <>
                        <Box sx={{display: "flex", flexWrap: "wrap", gap: 4, mb: 1}}>
                            {/* Orders first: it is the number a decision is made on. Skips are
                                the volume, orders are the cost. */}
                            <Box data-testid="skip-orders-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Orders affected
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {stats.ordersAffected}
                                </Typography>
                            </Box>
                            <Box data-testid="skip-total-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Skips
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {stats.totalSkips}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {formatSkipsPerOrder(stats.totalSkips, stats.ordersAffected)} per affected order
                                </Typography>
                            </Box>
                            <Box data-testid="skip-couriers-headline">
                                <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                                    Riders affected
                                </Typography>
                                <Typography variant="h5" fontWeight="bold" sx={{lineHeight: 1.2}}>
                                    {stats.couriersAffected}
                                </Typography>
                            </Box>
                        </Box>

                        <Typography variant="caption" color="text.secondary" sx={{display: "block", mb: 1}}>
                            The totals are not the sum of the rows: one order passed over for two reasons is counted
                            in both rows and is still one order.
                        </Typography>

                        <Box sx={{overflowX: "auto"}}>
                            <Table size="small" sx={{minWidth: 620}} data-testid="skip-reason-table">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{fontWeight: 600}}>Reason</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Orders</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Skips</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Skips / order</TableCell>
                                        <TableCell sx={{fontWeight: 600}} align="right">Riders</TableCell>
                                        <TableCell sx={{fontWeight: 600}}>Points to</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((bucket) => (
                                        <TableRow key={bucket.reason} data-testid={`skip-row-${bucket.reason}`}>
                                            <TableCell>
                                                {noOfferReasonLabel(bucket.reason)}
                                                {bucket.reason === worst && (
                                                    <Chip
                                                        size="small"
                                                        label="most orders"
                                                        sx={{ml: 1, height: 20, fontSize: 11}}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell align="right" sx={{fontWeight: 700}}>
                                                {bucket.ordersAffected}
                                            </TableCell>
                                            <TableCell align="right">{bucket.skips}</TableCell>
                                            <TableCell align="right">
                                                {formatSkipsPerOrder(bucket.skips, bucket.ordersAffected)}
                                            </TableCell>
                                            <TableCell align="right">{bucket.couriersAffected}</TableCell>
                                            <TableCell>
                                                <Typography variant="caption" color="text.secondary">
                                                    {POINTS_TO[bucket.reason] ?? ""}
                                                </Typography>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
