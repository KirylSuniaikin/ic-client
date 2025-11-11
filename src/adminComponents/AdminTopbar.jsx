import {
    Box,
    Button,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Popover,
    Select,
    Typography
} from "@mui/material";
import {useState} from "react";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import StackedLineChartIcon from "@mui/icons-material/StackedLineChart";
import {updateWorkload} from "../api/api";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";


export default function AdminTopbar({   stage,
                                        onClick,
                                        onOpenHistory,
                                        onOpenStatistics,
                                        onOpenConfig,
                                        onGoToMenu,
                                        branchNumber,
                                        workloadLevel,
                                        onWorkloadChange,
                                        adminId,
                                        onPurchaseOpen,
                                        onManagementPageOpen
                                    }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const colorRed = '#E44B4C';


    const getStageData = (stage) => {
        switch (stage) {
            case "OPEN_SHIFT_CASH_CHECK":
                return "Open Cash"
            case "CLOSE_SHIFT_CASH_CHECK":
                return "Close Cash";
            case "OPEN_SHIFT_EVENT":
                return "Open Shift";
            case "CLOSE_SHIFT_EVENT":
                return "Close Shift";
            default:
                return "";
        }
    };

    const items = [
        { label: "New Order" , icon: <AddIcon fontSize="small" />, onClick: onGoToMenu },
        { label: "Order History", icon: <HistoryIcon fontSize="small" />, onClick: onOpenHistory },
        { label: "Statistics", icon: <StackedLineChartIcon fontSize="small"/>, onClick: onOpenStatistics },
        { label: "Config", icon: <SettingsIcon fontSize="small"/>, onClick: onOpenConfig },
        {label: "Inventory", icon: <Inventory2OutlinedIcon fontSize="small" />, onClick: onManagementPageOpen },
        {label: "Purchase", icon: <ShoppingCartOutlinedIcon fontSize="small"/>, onClick: onPurchaseOpen }
    ]

    const levels = ["IDLE", "BUSY", "CROWDED", "OVERLOADED"];

    const getWorkloadData = (workload) => {
        switch (workload) {
            case "IDLE": return "Idle(+0 min)"
            case "BUSY": return "Busy(+10 min)"
            case "CROWDED": return "Crowded(+20 min)"
            case "OVERLOADED": return "Overloaded(+30 min)"
            default: return ""
        }
    }

    async function handleChangeWorkloadLevel(event) {
        const newLevel = event.target.value;
        onWorkloadChange?.(newLevel);
        try {
            await updateWorkload({branchNumber, newLevel});
        } catch (err) {
            console.error("Failed to update workload:", err);
        }
    }

    const label = getStageData(stage);

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                backgroundColor: "#fff",
                gap: 1,
                px: 1,
                py: 1,
                borderBottom: "1px solid #ddd",
                position: "sticky",
                top: 0,
                zIndex: 10,
            }}
        >
            <Box sx={{ flexGrow: 1 }} />

            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <FormControl size="small" sx={{ minWidth: 160, borderColor: colorRed }}>
                    <InputLabel>Workload</InputLabel>
                    <Select
                        value={workloadLevel ?? "IDLE"}
                        onChange={handleChangeWorkloadLevel}
                        label="Workload"
                        sx={{
                            borderRadius: "9999px",
                            border: colorRed,
                            fontWeight: 500,
                            textTransform: "capitalize",
                        }}
                    >
                        {levels.map((lvl) => (
                            <MenuItem key={lvl} value={lvl}>
                                {getWorkloadData(lvl)}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>

                <Button
                    onClick={onClick}
                    variant="outlined"
                    size="small"
                    sx={{
                        textTransform: "none",
                        borderRadius: "999px",
                        fontWeight: 500,
                        fontSize: "0.8rem",
                        px: 2,
                        height: "40px",
                        py: 0.5,
                        color: colorRed,
                        borderColor: colorRed,
                        '&:hover': {
                            backgroundColor: "#fff5f5",
                            borderColor: colorRed,
                        },
                    }}
                >
                    {label}
                </Button>

                <IconButton
                    onClick={handleMenuOpen}
                    size="small"
                    sx={{
                        border: "1px solid #E44B4C",
                        borderRadius: "999px",
                        padding: "4px 10px",
                        color: colorRed,
                        height: "40px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        '&:hover': {
                            backgroundColor: "#fff5f5",
                            borderColor: colorRed,
                        }
                    }}
                >
                    <MoreHorizIcon sx={{ fontSize: "16px" }} />
                </IconButton>

                <Popover
                    open={open}
                    anchorEl={anchorEl}
                    onClose={handleMenuClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    PaperProps={{
                        sx: {
                            borderRadius: "12px",
                            overflow: "hidden",
                            minWidth: 160,
                            p: 0.5,
                        },
                    }}
                >
                    {items.map((item, i) => (
                        <Box
                            key={item.label}
                            onClick={() => {
                                handleMenuClose();
                                item.onClick();
                            }}
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                px: 0.6,
                                py: 1.2,
                                fontSize: "0.9rem",
                                fontWeight: 500,
                                fontFamily: "Baloo Bhaijaan 2",
                                color: "#333",
                                borderBottom: i < items.length - 1 ? "1px solid #f0f0f0" : "none",
                                cursor: "pointer",
                                "&:hover": {
                                    backgroundColor: "#fff5f5",
                                }
                            }}
                        >
                            <Typography sx={{ fontSize: "0.9rem" }}>{item.label}</Typography>
                            <Box sx={{ display: "flex", alignItems: "center" }}>{item.icon}</Box>
                        </Box>
                    ))}
                </Popover>
            </Box>
        </Box>
    );
}
