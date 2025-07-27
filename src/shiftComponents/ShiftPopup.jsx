import {useEffect, useState} from "react";
import {
    TextField, Button,
    FormGroup, Checkbox, Typography, Card, Drawer, Box
} from "@mui/material";
import {sendShiftEvent} from "../api/api";


const CHECKLISTS = {
    OPENING: [
        "Open the Entrance Door",
        "Visually Inspect the entrance and customer area for dirty or damaged spots (If there are clean it up after step 4,5,6 are done)",
        "Turn on the lower deck (380 degrees Celsius) wait 30 seconds to make sure gas is flowing",
        "Turn On the Jahez Device, Talabat Device & Our POS (make sure menu items are on)",
        "Change to work uniform",
        "Make sure refrigerators temperature are in the safe zone (1-4 degrees) before opening",
        "Start executing prep list"
    ],
    CLOSING: [
        "Shift Manager needs to start drafting prep list for the next shift 2 hours before closing (see the reference in SOP doc)",
        "Update prep list for tomorrow & draft purchase list if needed, place water bottles outside",
        "30 minutes before closing start cleaning processes:\n- Place the ingredients inside the refrigerator\n- Wash The dishes\n- Clean up the surfaces (tables, tiles, refrigerators, oven exterior, shelves, devices, door handles)\n***TURN OFF THE SIGBOARD ONCE CLOSED***",
        "Sweep & mop the floor",
        "Throw the trash out",
        "Turn off the lights & hall AC",
        "Close the entrance door"
    ]
};

export default function ShiftPopup({isOpen, onClose, stage, setStage, branchId, onCashWarning}) {
    const [cash, setCash] = useState();
    const [checklist, setChecklist] = useState([]);

    const handleCheck = index => {
        const updated = [...checklist];
        updated[index].done = !updated[index].done;
        setChecklist(updated);
    };

    const mapToChecklistItems = (list) => {
        return list.map((text) => ({
            text,
            done: false
        }));
    };

    useEffect(() => {
        if (stage === "OPEN_SHIFT_EVENT") {
            setChecklist(mapToChecklistItems(CHECKLISTS.OPENING));
        } else if (stage === "CLOSE_SHIFT_EVENT") {
            setChecklist(mapToChecklistItems(CHECKLISTS.CLOSING));
        } else {
            setChecklist([]);
        }
    }, [stage]);

    const allChecked = Array.isArray(checklist) && checklist.every(item => item.done);

    const handleSubmit = async () => {
        try {
            onClose();

            const data = await sendShiftEvent({
                type: stage,
                datetime: new Date().toISOString(),
                branch_id: branchId,
                cash_amount: isCashStage ? parseFloat(cash) : null,
                prep_plan: null,
            });

                switch (stage) {
                    case "OPEN_SHIFT_CASH_CHECK":
                        setStage("OPEN_SHIFT_EVENT");
                        break;
                    case "OPEN_SHIFT_EVENT":
                        setStage("CLOSE_SHIFT_CASH_CHECK");
                        break;
                    case "CLOSE_SHIFT_CASH_CHECK":
                        setStage("CLOSE_SHIFT_EVENT");
                        break;
                    case "CLOSE_SHIFT_EVENT":
                        setStage("OPEN_SHIFT_CASH_CHECK");
                        break;
                }

            if (data?.cashWarning) {
                onCashWarning(data.cashWarning);
                setTimeout(() => onCashWarning(null), 5000);
            } else {
                onCashWarning(null);
            }

            setCash('');
                setChecklist([]);

        } catch (error) {
            console.error('Error occurred while sending an shift event:', error);
        }
    };

    const isCashStage = stage === "OPEN_SHIFT_CASH_CHECK" || stage === "CLOSE_SHIFT_CASH_CHECK";

    const getStageTitle = (stage) => {
        switch (stage) {
            case "OPEN_SHIFT_CASH_CHECK":
                return "Open Shift Cash Check";
            case "OPEN_SHIFT_EVENT":
                return "Opening Checklist";
            case "CLOSE_SHIFT_CASH_CHECK":
                return "Close Shift Cash Check";
            case "CLOSE_SHIFT_EVENT":
                return "Closing Checklist";
            default:
                return "Shift Step";
        }
    };

    return (

        <Drawer
            anchor="bottom"
            open={isOpen}
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    p: 3,
                    backgroundColor: "#fff",
                    boxShadow: 6,
                    maxHeight: "85vh",
                    overflowY: "auto",
                },
            }}
        >
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 ,  textAlign: "center" }}>
                {getStageTitle(stage)}
            </Typography>

            {isCashStage ? (
                <>
                <Box sx={{ pb: 7 }}>

                <TextField
                        label="Cash Amount"
                        type="number"
                        inputMode="decimal"
                        value={cash}
                        onChange={e => setCash(e.target.value)}
                        fullWidth
                        placeholder="Cash Amount"
                        sx={{
                            borderRadius: 2,
                            backgroundColor: "#fff",
                            border: "1px solid #ddd",
                            mb: 2,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: 2,
                            },
                        }}
                        InputProps={{ sx: { px: 2, py: 1.5 } }}
                    />
                </Box>
                    <Box
                        sx={{
                            position: "fixed",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            p: 2,
                            backgroundColor: "#fff",
                            borderTop: "1px solid #eee",
                            zIndex: 1301,
                        }}
                    >
                        <Button
                            onClick={handleSubmit}
                            variant="contained"
                            fullWidth
                            disabled={!cash}
                            sx={{
                                backgroundColor: "#E44B4C",
                                borderRadius: "999px",
                                textTransform: "none",
                                fontWeight: "bold",
                                py: 1.25,
                                fontSize: "1rem",
                                '&:hover': {
                                    backgroundColor: '#c63b3c',
                                },
                            }}
                        >
                            Submit
                        </Button>
                    </Box>


                </>
            ) : (
                <>
                <Box sx={{ pb: 10 }}>
                    <FormGroup sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {checklist.map((item, idx) => (
                            <Card
                                key={idx}
                                variant="outlined"
                                onClick={() => handleCheck(idx)}
                                sx={{
                                    borderRadius: 3, // ← важно
                                    display: "flex",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    backgroundColor: item.done ? "#f9f9f9" : "white",
                                    borderColor: item.done ? "#E44B4C" : "#ccc",
                                    boxShadow: "none",
                                    px: 2,
                                    py: 1.5,
                                }}
                            >
                                <Checkbox
                                    checked={item.done}
                                    onChange={() => handleCheck(idx)}
                                    sx={{
                                        color: "#E44B4C",
                                        "&.Mui-checked": { color: "#E44B4C" },
                                        mr: 2,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    sx={{
                                        whiteSpace: "pre-line",
                                    }}
                                >
                                    {item.text}
                                </Typography>
                            </Card>
                        ))}
                    </FormGroup>
                </Box>


                <Box
                    sx={{
                        position: "fixed",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        backgroundColor: "#fff",
                        borderTop: "1px solid #eee",
                        zIndex: 1301, // выше Drawer
                    }}
                >
                    <Button
                        onClick={handleSubmit}
                        variant="contained"
                        fullWidth
                        disabled={!allChecked}
                        sx={{
                            backgroundColor: "#E44B4C",
                            borderRadius: "999px",
                            textTransform: "none",
                            fontWeight: "bold",
                            py: 1.25,
                            fontSize: "1rem",
                            '&:hover': {
                                backgroundColor: '#c63b3c',
                            },
                        }}>
                        Submit
                    </Button>
                </Box>

                </>
            )}
        </Drawer>
    );
}

