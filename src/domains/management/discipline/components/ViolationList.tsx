import React from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import type { ViolationTO } from "../types";
import { formatDate, formatDateTime, formatHours } from "../format";
import { violationClassLabel } from "../labels";
import { isExplanationWindowOpen } from "../violations";

export type ViolationListProps = {
    violations: ReadonlyArray<ViolationTO>;
    emptyText: string;
    testIdPrefix: string;
    onViewPhoto?: (v: ViolationTO) => void; // "View photo" only when provided AND v.hasPhoto
    renderActions?: (v: ViolationTO) => React.ReactNode;
};

function statusLabel(v: ViolationTO): string {
    if (v.status === "PENDING_EXPLANATION") return "Awaiting explanation";
    if (v.status === "CANCELLED") return "Cancelled";
    return v.expired ? "Expired" : "Active";
}

function daysText(days: number): string {
    return days === 1 ? "Returns in 1 day" : `Returns in ${days} days`;
}

function disputeText(v: ViolationTO): string | null {
    if (v.dispute === null) return null;
    if (v.dispute.outcome === null) return `Dispute open: ${v.dispute.reason}`;
    if (v.dispute.outcome === "UPHELD") return "Dispute rejected — violation stands";
    return "Dispute accepted — violation cancelled";
}

const ViolationRow: React.FC<{
    v: ViolationTO;
    testId: string;
    onViewPhoto?: (v: ViolationTO) => void;
    renderActions?: (v: ViolationTO) => React.ReactNode;
}> = ({ v, testId, onViewPhoto, renderActions }) => {
    const dispute = disputeText(v);
    return (
        <Box
            data-testid={testId}
            sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 3, p: 1.5, mb: 1.5 }}
        >
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{`${v.code} — ${v.title}`}</Typography>
                <Chip size="small" label={violationClassLabel(v.violationClass)} />
                <Chip size="small" label={statusLabel(v)} variant="outlined" />
            </Box>
            {v.points > 0 && <Typography variant="body2">{`Points: -${v.points}`}</Typography>}
            {v.penaltyHours !== null && v.penaltyHours > 0 && (
                <Typography variant="body2">{`Penalty hours: ${formatHours(v.penaltyHours)} h`}</Typography>
            )}
            {v.daysUntilExpiry !== null && (
                <Typography variant="body2">{daysText(v.daysUntilExpiry)}</Typography>
            )}
            {v.status === "PENDING_EXPLANATION" && v.explanationDueAt !== null && (
                <Typography variant="body2">
                    {isExplanationWindowOpen(v, Date.now())
                        ? `Explanation due ${formatDateTime(v.explanationDueAt)}`
                        : "Explanation window closed — awaiting GM"}
                </Typography>
            )}
            <Typography variant="body2" color="text.secondary">
                {`Occurred ${formatDate(v.occurredOn)} · Discovered ${formatDate(v.discoveredOn)}`}
            </Typography>
            <Typography variant="body2" color="text.secondary">{`Issued by ${v.issuedByName}`}</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>{v.issuerComment}</Typography>
            {v.employeeExplanation !== null && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {`Employee's explanation: ${v.employeeExplanation}`}
                </Typography>
            )}
            {v.status === "CANCELLED" && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {`Cancelled by ${v.cancelledByName ?? ""}: ${v.cancelReason ?? ""}`}
                </Typography>
            )}
            {v.confirmedAutomatically && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>Confirmed automatically</Typography>
            )}
            {dispute !== null && <Typography variant="body2" sx={{ mt: 0.5 }}>{dispute}</Typography>}
            {onViewPhoto && v.hasPhoto && (
                <Button size="small" onClick={() => onViewPhoto(v)} sx={{ mt: 0.5 }}>
                    View photo
                </Button>
            )}
            {renderActions?.(v)}
        </Box>
    );
};

const ViolationList: React.FC<ViolationListProps> = ({
    violations, emptyText, testIdPrefix, onViewPhoto, renderActions,
}) => {
    if (violations.length === 0) {
        return <Typography variant="body2" color="text.secondary">{emptyText}</Typography>;
    }
    return (
        <Box>
            {violations.map((v) => (
                <ViolationRow
                    key={v.id}
                    v={v}
                    testId={`${testIdPrefix}-${v.id}`}
                    onViewPhoto={onViewPhoto}
                    renderActions={renderActions}
                />
            ))}
        </Box>
    );
};

export default ViolationList;
