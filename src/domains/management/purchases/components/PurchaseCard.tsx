import {BasePurchaseResponse} from "../types";
import {Button, Card, CardHeader, Chip, Stack, Typography} from "@mui/material";

const BRAND = "#E44B4C";

export type PurchaseCardProps = {
    report: BasePurchaseResponse;
    onEditClick: () => void;
};

export function PurchaseCard({ report, onEditClick }: PurchaseCardProps) {
    const unpaidCount = report.unpaidCount ?? 0;

    return (
        <Card key={report.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "snow" }}>
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
                subheader={`Total: ${report.finalPrice} BHD`}
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