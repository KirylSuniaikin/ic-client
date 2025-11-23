import {BaseShiftResponse} from "../types/shiftTypes";
import {Button, Card, CardHeader, Typography} from "@mui/material";

type Props = {
    report: BaseShiftResponse
    onEditClick: (shift: BaseShiftResponse) => void
}

const BRAND = "#E44B4C";

export function ShiftCard({report, onEditClick}: Props) {
    return (
        <Card key={report.id} variant="outlined" sx={{ borderRadius: 4, borderColor: "snow" }}>
            <CardHeader
                title={
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {report.title}
                    </Typography>
                }
                subheader={`Total hours: ${report.totalHours.toFixed(3)} h`}
                action={
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onEditClick(report)}
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