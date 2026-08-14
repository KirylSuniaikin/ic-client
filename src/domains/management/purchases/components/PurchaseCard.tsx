import {BasePurchaseResponse} from "../types";
import {Button, Card, CardHeader, Chip, Stack, Typography} from "@mui/material";
import dayjs from "dayjs";

const BRAND = "#E44B4C";

export type PurchaseCardProps = {
    report: BasePurchaseResponse;
    onEditClick: () => void;
};

export function PurchaseCard({ report, onEditClick }: PurchaseCardProps) {
    const unpaidCount = report.unpaidCount ?? 0;

    const created = report.createdAt ? dayjs(report.createdAt) : null;
    const createdLabel = created && created.isValid() ? created.format("DD.MM.YYYY") : null;

    return (
        <Card key={report.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "divider" }}>
            <CardHeader
                title={
                    <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {report.title}
                        </Typography>
                        {/* Nothing is rendered at zero — a permanent "Unpaid 0" would train
                            everyone to stop reading the badge. */}
                        {unpaidCount > 0 && (
                            <Chip
                                size="small"
                                color="warning"
                                variant="outlined"
                                data-testid={`unpaid-badge-${report.id}`}
                                label={`Unpaid ${unpaidCount} · ${Number(report.unpaidAmount ?? 0).toFixed(3)}`}
                                sx={{ fontWeight: 700 }}
                            />
                        )}
                    </Stack>
                }
                subheader={
                    // 3dp, because the unpaid chip directly above it is 3dp — two different
                    // precisions on one card read as two different kinds of number.
                    <Stack direction="row" alignItems="baseline" gap={1} flexWrap="wrap">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
                            {Number(report.finalPrice ?? 0).toFixed(3)} BHD
                        </Typography>
                        {createdLabel && (
                            <Typography variant="caption" color="text.secondary">
                                {createdLabel}
                            </Typography>
                        )}
                    </Stack>
                }
                action={
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onEditClick()}
                        sx={{
                            borderRadius: 4,
                            borderWidth: 1,
                            textTransform: "none",
                            fontWeight: 700,
                            px: 2,
                            borderColor: BRAND,
                            color: BRAND,
                            "&:hover": { borderColor: BRAND, backgroundColor: `${BRAND}14` },
                        }}
                    >
                        Edit
                    </Button>
                }
                sx={{
                    alignItems: "center",
                    "& .MuiCardHeader-action": { alignSelf: "center" },
                }}
            />
        </Card>
    )
}