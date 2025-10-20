import {Button, Card, CardHeader, Typography} from "@mui/material";
import {IManagementResponse} from "./types.ts";

export type ReportCardProps = {
    report: IManagementResponse;
    onEditClick: () => void;
};

const BRAND = "#E44B4C";

export default function ReportCard({ report, onEditClick }: ReportCardProps) {
    return (
    <Card key={report.id} variant="outlined" sx={{ borderRadius: 2 }}>
        <CardHeader
            title={
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {report.title}
                </Typography>
            }
            subheader={`${report.type} • ${new Date(report.createdAt).toLocaleString()} • Branch ${report.branchNo}`}
            action={
                <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onEditClick()}
                    sx={{
                        borderRadius: 4,
                        borderWidth: 2,
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