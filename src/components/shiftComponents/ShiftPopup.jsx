import {useEffect, useState} from "react";
import {
    TextField, Button,
    FormGroup, Checkbox, Typography, Card, Drawer, Box
} from "@mui/material";
import {sendShiftEvent} from "../../api/api";


const CHECKLISTS = {
    OPENING: [
        "1. Visually Inspect the entrance and customer area for dirty or damaged spots (If there are clean it up after step 4,5,6 are done)",
        "2. Turn on the lower deck (380 degrees Celsius) wait 30 seconds to make sure gas is flowing",
        "3. Turn On the Jahez Device, Talabat Device & Our POS (make sure menu items are on)",
        "4. Change to work uniform",
        "5. Make sure refrigerators temperature are in the safe zone (1-4 degrees) before opening",
        "6. Start executing prep list"
    ],
    CLOSING: [
        "1. Shift Manager needs to start drafting prep list for the next shift 2 hours before closing (see the reference in SOP doc)",
        "2. Update prep list for tomorrow & draft purchase list if needed, place water bottles outside",
        "3. 30 minutes before closing start cleaning processes:\n- Place the ingredients inside the refrigerator\n- Wash The dishes\n- Clean up the surfaces (tables, tiles, refrigerators, oven exterior, shelves, devices, door handles)\n***TURN OFF THE SIGBOARD ONCE CLOSED***",
        "4. Sweep & mop the floor",
        "5. Throw the trash out",
        "6. Turn off the lights & hall AC"
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
                        setStage("CLOSE_SHIFT_EVENT");
                        break;
                    case "CLOSE_SHIFT_EVENT":
                        setStage("CLOSE_SHIFT_CASH_CHECK");
                        break;
                    case "CLOSE_SHIFT_CASH_CHECK":
                        setStage("OPEN_SHIFT_CASH_CHECK");
                        break;
                    default:
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
                return "Start Cash Balance";
            case "OPEN_SHIFT_EVENT":
                return (
                    <>
                        Opening Checklist
                        <Typography variant="caption" sx={{ display: "block", fontSize: "0.875rem", fontWeight: "bold", mt: 0.5 }}>
                            Responsible: Omar
                        </Typography>
                    </>
                );
            case "CLOSE_SHIFT_CASH_CHECK":
                return "End Cash Balance";
            case "CLOSE_SHIFT_EVENT":
                return (
                    <>
                        Closing Checklist
                        <Typography variant="caption" sx={{ display: "block", fontSize: "0.875rem", fontWeight: "bold", mt: 0.5 }}>
                            Responsible: Omar
                        </Typography>
                    </>
                );
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
                                    borderRadius: 3,
                                    display: "flex",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    backgroundColor: item.done ? "#f9f9f9" : "white",
                                    borderColor: item.done ? "#E44B4C" : "#ccc",
                                    boxShadow: "none",
                                    px: 2,
                                    py: 2,
                                }}
                            >
                                <Checkbox
                                    checked={item.done}
                                    tabIndex={-1}
                                    disableRipple
                                    sx={{
                                        color: "#E44B4C",
                                        "&.Mui-checked": { color: "#E44B4C" },
                                        mr: 2,
                                    }}
                                />
                                <Typography
                                    variant="body2"
                                    sx=
                                        {{
                                        whiteSpace: "pre-line",
                                        lineHeight: 1.4,
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

