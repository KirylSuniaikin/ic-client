import {Box, Button, Card, CardContent, CircularProgress, Divider, Grid, Paper, Typography} from "@mui/material";
import React, {useState} from "react";
import PrintIcon from '@mui/icons-material/Print';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {getVatStats} from "../management/api/api";


type Stats = {
    totalOrders: number;
    totalRevenue: number;
    branchName: string;
}

const inputStyle: React.CSSProperties = {
    padding: "10px",
    fontSize: "16px",
    width: "100%",
    border: "1px solid #c4c4c4",
    borderRadius: "4px",
    fontFamily: "inherit",
    outline: "none"
};

export function VatReportCard({branchId}: { branchId: string }) {
    const getToday = () => new Date().toISOString().split('T')[0];

    const getFirstOfMonth = () => {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    };

    const [startDate, setStartDate] = useState(getFirstOfMonth());
    const [endDate, setEndDate] = useState(getToday());
    const [loading, setLoading] = useState(false);
    const [reportStats, setReportStats] = useState<Stats | null>(null);

    const handleGenerateReport = async () => {
        if (!branchId) return;
        setLoading(true);

        try {
            const stats: Stats = await getVatStats(
                {
                    branchId: branchId,
                    fromDate: startDate,
                    toDate: endDate
                });

            console.log("Report Data:", stats);
            setReportStats(stats);

        } catch (error) {
            console.error("Failed to generate report:", error);
            alert("Error generating report. Check console.");
        } finally {
            setLoading(false);
        }
    };

    const StatRow = ({label, value, bold = false}: {label: string, value: string, bold?: boolean}) => (
        <Box sx={{display: 'flex', justifyContent: 'space-between', mb: 1}}>
            <Typography variant="body2" color={bold ? "text.primary" : "text.secondary"} fontWeight={bold ? 600 : 400}>
                {label}
            </Typography>
            <Typography variant="body2" fontWeight={bold ? 700 : 500}>
                {value}
            </Typography>
        </Box>
    );

    return (
        <Card variant="outlined"
              sx={{mb: 2, borderRadius: 3, borderColor: '#eee', backgroundColor: '#fff', boxShadow: 3, mt: 1}}>
            <CardContent sx={{pb: 2, "&:last-child": {pb: 2}}}>
                <Box sx={{display: "flex", alignItems: "center", gap: 1, mb: 2}}>
                    <Typography variant="subtitle1" fontWeight="bold">
                        📊 VAT Report
                    </Typography>
                </Box>


                <Grid container spacing={2} alignItems="flex-end">

                    <Grid size={{xs: 12, sm: 4}}>
                        <Typography variant="caption"
                                    sx={{ml: 0.5, mb: 0.5, display: "block", fontWeight: 600, color: "text.secondary"}}>
                            From Date
                        </Typography>
                        <input
                            type="date"
                            value={startDate}
                            max={endDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={inputStyle}
                        />
                    </Grid>

                    {/* ARROW ICON */}
                    <Grid size={{xs: 12, sm: 0.5}}
                          sx={{display: {xs: 'none', sm: 'flex'}, justifyContent: "center", pb: 1.5}}>
                        <ArrowForwardIcon color="action"/>
                    </Grid>

                    {/* END DATE */}
                    <Grid size={{xs: 12, sm: 4}}>
                        <Typography variant="caption"
                                    sx={{ml: 0.5, mb: 0.5, display: "block", fontWeight: 600, color: "text.secondary"}}>
                            To Date
                        </Typography>
                        <input
                            type="date"
                            value={endDate}
                            min={startDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={inputStyle}
                        />
                    </Grid>

                    {/* BUTTON */}
                    <Grid size={{xs: 12, sm: 3.5}}> {/* sm: 3.5 так как 4+0.5+4 = 8.5, остается 3.5 до 12 */}
                        <Typography variant="caption" sx={{display: "block", mb: "2px"}}>&nbsp;</Typography>
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleGenerateReport}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} color="inherit"/> : <PrintIcon/>}
                            sx={{
                                backgroundColor: '#E44B4C',
                                color: '#fff',
                                py: 1.2,
                                borderRadius: 2,
                                textTransform: 'none',
                                fontWeight: 'bold',
                                boxShadow: "none",
                                '&:hover': {
                                    backgroundColor: '#c73c3d',
                                    boxShadow: "0 4px 12px rgba(228, 75, 76, 0.2)"
                                },
                            }}
                        >
                            Get Report
                        </Button>
                    </Grid>

                    {reportStats && (
                        <Box sx={{mt: 3, pt: 2, borderTop: '1px dashed #ddd'}}>
                            <Typography variant="subtitle2" sx={{mb: 2, textAlign: 'center', color: '#E44B4C', fontWeight: 'bold'}}>
                                REPORT PREVIEW
                            </Typography>

                            <Paper variant="outlined" sx={{p: 2, bgcolor: '#f9f9f9', borderRadius: 2}}>
                                <StatRow label="Branch" value={reportStats.branchName} />
                                <StatRow label="Period" value={`${startDate} — ${endDate}`} />
                                <StatRow label="Total Orders" value={String(reportStats.totalOrders)} />

                                <Divider sx={{my: 1.5}} />

                                <StatRow label="Net Amount (Total)" value={`${(reportStats.totalRevenue * 0.9).toFixed(3)} BD`} />
                                <StatRow label="VAT (10%)" value={`${(reportStats.totalRevenue * 0.1).toFixed(3)} BD`} />

                                <Divider sx={{my: 1.5}} />

                                <Box sx={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <Typography variant="h6" fontWeight="bold">Grand Total:  </Typography>
                                    <Typography variant="h6" fontWeight="bold" color="primary">
                                        {reportStats.totalRevenue.toFixed(3)} BD
                                    </Typography>
                                </Box>
                            </Paper>


                        </Box>
                    )}
                </Grid>
            </CardContent>
        </Card>
    )
}