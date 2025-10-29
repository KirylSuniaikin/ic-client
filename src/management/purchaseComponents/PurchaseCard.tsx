import {BasePurchaseResponse} from "../types/purchaseTypes";
import {Button, Card, CardHeader, Typography} from "@mui/material";

const BRAND = "#E44B4C";

export type PurchaseCardProps = {
    report: BasePurchaseResponse;
    onEditClick: () => void;
};

export function PurchaseCard({ report, onEditClick }: PurchaseCardProps) {
    return (
        <Card key={report.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "snow" }}>
            <CardHeader
                title={
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {report.title}
                    </Typography>
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