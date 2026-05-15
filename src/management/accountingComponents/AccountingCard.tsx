import { AccountingReportSummary } from "../types/accountingTypes";
import { Button, Card, CardHeader, Stack, Typography } from "@mui/material";

const BRAND = "#E44B4C";

export type AccountingCardProps = {
    report: AccountingReportSummary;
    onEditClick: () => void;
};

export function AccountingCard({ report, onEditClick }: AccountingCardProps): JSX.Element {
    const created = new Date(report.createdAt).toLocaleDateString();

    return (
        <Card key={report.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "snow" }}>
            <CardHeader
                title={
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {report.title}
                    </Typography>
                }
                subheader={
                    <Stack direction="column" gap={0.25}>
                        <Typography variant="body2" color="text.secondary">
                            {created}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Income: {report.totalIncome} BHD · Expense: {report.totalExpense} BHD
                        </Typography>
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
    );
}
