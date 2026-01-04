import {Box, Button, Card, CardContent, CircularProgress, Grid, Typography} from "@mui/material";
import React, {useState} from "react";
import PrintIcon from '@mui/icons-material/Print';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import {getVatStats} from "../management/api/api";
import BluetoorhPrinterService from '../services/BluetoorhPrinterService';


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

            const reportText =
                `\n` +
                `IC PIZZA VAT REPORT\n` +
                `--------------------\n` +
                `220026867000002\n` +
                `Flat/Shop No. 0,\n` +
                `Building 1284,\n` +
                `Road/Street 114, HIDD\n` +
                `Block 101, Bahrain,\n`  +
                `--------------------\n` +
                `${startDate} - ${endDate}\n` +
                `--------------------\n` +
                `Branch Name: ${stats.branchName}\n` +
                `Total Orders: ${stats.totalOrders}\n` +
                `Total: ${(stats.totalRevenue * 0.9).toFixed(3)} BD\n` +
                `Grand Total: ${stats.totalRevenue.toFixed(3)} BD\n` +
                `Total VAT: ${(stats.totalRevenue * 0.1).toFixed(3)} BD\n` +
                `--------------------\n` +
                `Generated at: ${new Date().toLocaleDateString()}\n` +
                `\n\n\n`;

            console.log(reportText);
            await BluetoorhPrinterService.printVatReport(reportText);

        } catch (error) {
            console.error("Failed to generate report:", error);
            alert("Error generating report. Check console.");
        } finally {
            setLoading(false);
        }
    };

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
                            {loading ? "Printing..." : "Print"}
                        </Button>
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    )
}