import * as React from "react";
import {useEffect, useMemo, useState} from "react";
import {Alert, Box, Button, Divider, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import RestartAltRoundedIcon from "@mui/icons-material/RestartAltRounded";
import ResponsiveSheet from "../../_shared/components/ResponsiveSheet";
import {BRAND_BUTTON_SX, NEUTRAL_BUTTON_SX, ROUNDED_FIELD_SX} from "../../_shared/components/roundedSelect";
import type {SalarySlipDeduction, SalarySlipForm} from "../types";

// Mirrors the backend's one-page budget (SalarySlipPdfGenerator.fitsOnOnePage). Conservative on
// purpose: the server does the exact check and rejects an over-full slip, but hitting that only
// after pressing Confirm would be a poor way to find out. The page fits roughly one deduction row
// alongside the default notes, or a second at the cost of a note line.
const MAX_DEDUCTIONS = 3;
const MAX_NOTES = 9;

export interface SalarySlipPopupProps {
    open: boolean;
    /** Null while the preview is still loading. */
    form: SalarySlipForm | null;
    employeeLabel: string;
    loading: boolean;
    submitting: boolean;
    error: string | null;
    onConfirm: (form: SalarySlipForm) => void;
    onClose: () => void;
}

function toAmount(value: string): number | null {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

function amountToField(value: number | null): string {
    return value === null || value === undefined ? "" : String(value);
}

function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

// Same wording the backend's BhdAmountInWords produces, so the auto-filled sentence matches what
// an un-edited slip would have printed. Kept here rather than round-tripping to the server on
// every keystroke.
const UNITS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function spellInteger(value: number): string {
    if (value === 0) return "Zero";
    if (value < 20) return UNITS[value];
    if (value < 100) {
        const rest = value % 10;
        return TENS[Math.floor(value / 10)] + (rest ? " " + UNITS[rest] : "");
    }
    if (value < 1000) {
        const rest = value % 100;
        // "Three Hundred And Ten", not "Three Hundred Ten" -- the "And" belongs INSIDE a hundreds
        // group and nowhere else, which is what the reference slips print and what the backend's
        // BhdAmountInWords produces. Between thousands and the remainder there is no "And"
        // ("One Thousand Five"), so this must not be hoisted into the branch below.
        return UNITS[Math.floor(value / 100)] + " Hundred" + (rest ? " And " + spellInteger(rest) : "");
    }
    const rest = value % 1000;
    return spellInteger(Math.floor(value / 1000)) + " Thousand" + (rest ? " " + spellInteger(rest) : "");
}

export function amountInWords(net: number): string {
    const safe = Math.max(0, round3(net));
    const dinars = Math.floor(safe);
    const fils = Math.round((safe - dinars) * 1000);
    const head = `Bahraini Dinars ${spellInteger(dinars)}`;
    return fils === 0 ? `${head} Only` : `${head} and Fils ${spellInteger(fils)} Only`;
}

export default function SalarySlipPopup({
    open,
    form,
    employeeLabel,
    loading,
    submitting,
    error,
    onConfirm,
    onClose,
}: SalarySlipPopupProps): React.JSX.Element {
    // Amounts live as strings so a half-typed "24." is not destroyed mid-keystroke.
    const [employeeName, setEmployeeName] = useState("");
    const [position, setPosition] = useState("");
    const [cprNumber, setCprNumber] = useState("");
    const [payPeriodLabel, setPayPeriodLabel] = useState("");
    const [paymentDate, setPaymentDate] = useState("");
    const [basicSalary, setBasicSalary] = useState("");
    const [housingAllowance, setHousingAllowance] = useState("");
    const [transportAllowance, setTransportAllowance] = useState("");
    const [overtimeHours, setOvertimeHours] = useState("");
    const [overtimeRate, setOvertimeRate] = useState("");
    const [overtimeAmount, setOvertimeAmount] = useState("");
    // The overtime amount follows hours x rate as either is edited. It is seeded from the server's
    // own figure rather than recomputed on open: the shift aggregation rounds hours and rate
    // separately, so multiplying the two rounded values back together can differ from the amount
    // it actually computed. Typing directly into the amount pins it and stops it following.
    const [overtimeAmountManual, setOvertimeAmountManual] = useState(false);
    const [deductions, setDeductions] = useState<{description: string; amount: string}[]>([]);
    const [notes, setNotes] = useState<string[]>([]);

    // Totals are computed from the rows until the owner types into them, at which point the manual
    // value is kept and the mismatch is shown rather than silently corrected. Both behaviours were
    // asked for: every field verifiable, and every field editable.
    const [grossOverride, setGrossOverride] = useState<string | null>(null);
    const [deductionsOverride, setDeductionsOverride] = useState<string | null>(null);
    const [netOverride, setNetOverride] = useState<string | null>(null);
    const [wordsOverride, setWordsOverride] = useState<string | null>(null);

    useEffect(() => {
        if (!open || form === null) return;
        setEmployeeName(form.employeeName ?? "");
        setPosition(form.position ?? "");
        setCprNumber(form.cprNumber ?? "");
        setPayPeriodLabel(form.payPeriodLabel ?? "");
        setPaymentDate(form.paymentDate ?? "");
        setBasicSalary(amountToField(form.basicSalary));
        setHousingAllowance(amountToField(form.housingAllowance));
        setTransportAllowance(amountToField(form.transportAllowance));
        setOvertimeHours(amountToField(form.overtimeHours));
        setOvertimeRate(amountToField(form.overtimeRate));
        setOvertimeAmount(amountToField(form.overtimeAmount));
        setOvertimeAmountManual(false);
        setDeductions((form.deductions ?? []).map(d => ({
            description: d.description,
            amount: amountToField(d.amount),
        })));
        setNotes(form.notes ?? []);
        setGrossOverride(null);
        setDeductionsOverride(null);
        setNetOverride(null);
        setWordsOverride(null);
    }, [open, form]);

    function recomputeOvertime(hours: string, rate: string): void {
        if (overtimeAmountManual) return;
        const h = toAmount(hours);
        const r = toAmount(rate);
        setOvertimeAmount(h === null || r === null ? "" : String(round3(h * r)));
    }

    const computedGross = useMemo(() => round3(
        (toAmount(basicSalary) ?? 0)
        + (toAmount(housingAllowance) ?? 0)
        + (toAmount(transportAllowance) ?? 0)
        + (toAmount(overtimeAmount) ?? 0),
    ), [basicSalary, housingAllowance, transportAllowance, overtimeAmount]);

    const computedDeductions = useMemo(
        () => round3(deductions.reduce((sum, d) => sum + (toAmount(d.amount) ?? 0), 0)),
        [deductions],
    );

    const gross = grossOverride === null ? computedGross : (toAmount(grossOverride) ?? 0);
    const totalDeductions = deductionsOverride === null
        ? computedDeductions : (toAmount(deductionsOverride) ?? 0);
    const computedNet = round3(gross - totalDeductions);
    const net = netOverride === null ? computedNet : (toAmount(netOverride) ?? 0);
    const computedWords = amountInWords(net);
    const words = wordsOverride === null ? computedWords : wordsOverride;

    const grossMismatch = grossOverride !== null && round3(gross) !== computedGross;
    const deductionsMismatch = deductionsOverride !== null && round3(totalDeductions) !== computedDeductions;
    const netMismatch = netOverride !== null && round3(net) !== computedNet;
    const wordsMismatch = wordsOverride !== null && words.trim() !== computedWords;

    const negativeAmount = [basicSalary, housingAllowance, transportAllowance, overtimeAmount,
        ...deductions.map(d => d.amount)].some(v => (toAmount(v) ?? 0) < 0);
    const missingRequired = employeeName.trim() === "" || position.trim() === ""
        || payPeriodLabel.trim() === "" || paymentDate.trim() === "" || words.trim() === "";
    const emptyDeduction = deductions.some(d => d.description.trim() === "");

    const blocker = negativeAmount ? "Amounts cannot be negative."
        : missingRequired ? "Name, position, pay period, payment date and the amount in words are all required."
        : emptyDeduction ? "Every deduction needs a description."
        : null;

    const handleConfirm = (): void => {
        if (blocker !== null || form === null) return;
        const cleanDeductions: SalarySlipDeduction[] = deductions.map(d => ({
            description: d.description.trim(),
            amount: toAmount(d.amount) ?? 0,
        }));
        onConfirm({
            employeeName: employeeName.trim(),
            position: position.trim(),
            cprNumber: cprNumber.trim() === "" ? null : cprNumber.trim(),
            payPeriodLabel: payPeriodLabel.trim(),
            paymentDate,
            basicSalary: toAmount(basicSalary),
            housingAllowance: toAmount(housingAllowance),
            transportAllowance: toAmount(transportAllowance),
            overtimeHours: toAmount(overtimeHours),
            overtimeRate: toAmount(overtimeRate),
            overtimeAmount: toAmount(overtimeAmount),
            deductions: cleanDeductions,
            grossEarnings: round3(gross),
            totalDeductions: round3(totalDeductions),
            netPay: round3(net),
            amountInWords: words.trim(),
            notes: notes.map(n => n.trim()).filter(n => n !== ""),
        });
    };

    const amountProps = {
        fullWidth: true as const,
        type: "number" as const,
        inputProps: {step: "0.001", min: "0"},
        InputProps: {startAdornment: <InputAdornment position="start">BD</InputAdornment>},
        sx: {...ROUNDED_FIELD_SX},
    };

    const sectionSx = {fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em",
        color: "text.secondary", textTransform: "uppercase" as const, mt: 2.5, mb: 1.25};

    return (
        <ResponsiveSheet
            open={open}
            onClose={onClose}
            title="Check the salary slip"
            subtitle={employeeLabel}
            maxWidth={620}
            testId="salary-slip-popup"
        >
            <Box>
                {loading && (
                    <Typography variant="body2" sx={{color: "text.secondary"}} data-testid="salary-slip-loading">
                        Loading…
                    </Typography>
                )}

                {!loading && error !== null && (
                    <Alert severity="error" sx={{mb: 2}} data-testid="salary-slip-error">{error}</Alert>
                )}

                {!loading && form !== null && (
                    <>
                        <Alert severity="info" sx={{mb: 2}}>
                            Anything you change here affects this PDF only — the employee's saved payroll
                            is left as it is.
                        </Alert>

                        <Typography sx={sectionSx}>Employee</Typography>
                        <Stack spacing={2}>
                            <TextField label="Employee name" fullWidth value={employeeName}
                                       onChange={e => setEmployeeName(e.target.value)}
                                       sx={ROUNDED_FIELD_SX} data-testid="slip-employee-name"/>
                            <TextField label="Position" fullWidth value={position}
                                       onChange={e => setPosition(e.target.value)}
                                       sx={ROUNDED_FIELD_SX} data-testid="slip-position"/>
                            <TextField label="CPR No." fullWidth value={cprNumber}
                                       onChange={e => setCprNumber(e.target.value)}
                                       sx={ROUNDED_FIELD_SX} data-testid="slip-cpr"/>
                            <TextField label="Pay period" fullWidth value={payPeriodLabel}
                                       onChange={e => setPayPeriodLabel(e.target.value)}
                                       sx={ROUNDED_FIELD_SX} data-testid="slip-pay-period"/>
                            <TextField label="Payment date" type="date" fullWidth value={paymentDate}
                                       onChange={e => setPaymentDate(e.target.value)}
                                       InputLabelProps={{shrink: true}}
                                       sx={ROUNDED_FIELD_SX} data-testid="slip-payment-date"/>
                        </Stack>

                        <Typography sx={sectionSx}>Earnings</Typography>
                        <Stack spacing={2}>
                            <TextField {...amountProps} label="Basic salary" value={basicSalary}
                                       onChange={e => setBasicSalary(e.target.value)}
                                       data-testid="slip-basic"/>
                            <TextField {...amountProps} label="Housing allowance" value={housingAllowance}
                                       onChange={e => setHousingAllowance(e.target.value)}
                                       data-testid="slip-housing"/>
                            <TextField {...amountProps} label="Transportation allowance" value={transportAllowance}
                                       onChange={e => setTransportAllowance(e.target.value)}
                                       data-testid="slip-transport"/>
                            <Stack direction="row" spacing={1}>
                                <TextField label="OT hours" type="number" fullWidth value={overtimeHours}
                                           onChange={e => {
                                               setOvertimeHours(e.target.value);
                                               recomputeOvertime(e.target.value, overtimeRate);
                                           }}
                                           inputProps={{step: "0.01", min: "0"}}
                                           sx={ROUNDED_FIELD_SX} data-testid="slip-ot-hours"/>
                                <TextField label="OT rate" type="number" fullWidth value={overtimeRate}
                                           onChange={e => {
                                               setOvertimeRate(e.target.value);
                                               recomputeOvertime(overtimeHours, e.target.value);
                                           }}
                                           inputProps={{step: "0.001", min: "0"}}
                                           sx={ROUNDED_FIELD_SX} data-testid="slip-ot-rate"/>
                            </Stack>
                            <TextField {...amountProps} label="Overtime amount" value={overtimeAmount}
                                       onChange={e => {
                                           setOvertimeAmount(e.target.value);
                                           setOvertimeAmountManual(true);
                                       }}
                                       helperText={overtimeAmountManual
                                           ? "Pinned — no longer follows hours × rate"
                                           : "Follows hours × rate"}
                                       InputProps={{
                                           ...amountProps.InputProps,
                                           endAdornment: overtimeAmountManual ? (
                                               <Tooltip title="Resume following hours × rate">
                                                   <IconButton size="small" aria-label="Reset overtime amount"
                                                               onClick={() => {
                                                                   setOvertimeAmountManual(false);
                                                                   const h = toAmount(overtimeHours);
                                                                   const r = toAmount(overtimeRate);
                                                                   setOvertimeAmount(h === null || r === null
                                                                       ? "" : String(round3(h * r)));
                                                               }}
                                                               data-testid="slip-ot-amount-reset">
                                                       <RestartAltRoundedIcon fontSize="small"/>
                                                   </IconButton>
                                               </Tooltip>
                                           ) : undefined,
                                       }}
                                       data-testid="slip-ot-amount"/>
                        </Stack>

                        <Typography sx={sectionSx}>Deductions</Typography>
                        {deductions.length === 0 && (
                            <Typography variant="body2" sx={{color: "text.secondary", mb: 1}}>
                                None — the slip will print “No deductions applicable this period”.
                            </Typography>
                        )}
                        <Stack spacing={1.5}>
                            {deductions.map((d, i) => (
                                <Stack direction="row" spacing={1} alignItems="center" key={i}>
                                    <TextField label="Description" fullWidth value={d.description}
                                               onChange={e => setDeductions(prev => prev.map((row, j) =>
                                                   j === i ? {...row, description: e.target.value} : row))}
                                               sx={ROUNDED_FIELD_SX} data-testid={`slip-deduction-desc-${i}`}/>
                                    <TextField label="Amount" type="number" value={d.amount}
                                               onChange={e => setDeductions(prev => prev.map((row, j) =>
                                                   j === i ? {...row, amount: e.target.value} : row))}
                                               inputProps={{step: "0.001", min: "0"}}
                                               sx={{width: 150, ...ROUNDED_FIELD_SX}}
                                               data-testid={`slip-deduction-amount-${i}`}/>
                                    <Tooltip title="Remove">
                                        <IconButton aria-label="Remove deduction"
                                                    onClick={() => setDeductions(prev => prev.filter((_, j) => j !== i))}
                                                    data-testid={`slip-deduction-remove-${i}`}>
                                            <DeleteOutlineRoundedIcon fontSize="small"/>
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            ))}
                        </Stack>
                        <Button startIcon={<AddRoundedIcon/>} sx={{mt: 1, ...NEUTRAL_BUTTON_SX}}
                                disabled={deductions.length >= MAX_DEDUCTIONS}
                                onClick={() => setDeductions(prev => [...prev, {description: "", amount: ""}])}
                                data-testid="slip-add-deduction">
                            Add deduction
                        </Button>

                        <Typography sx={sectionSx}>Totals</Typography>
                        <Stack spacing={2}>
                            <TotalField label="Gross earnings" testId="slip-gross"
                                        value={grossOverride === null ? String(computedGross) : grossOverride}
                                        onChange={v => setGrossOverride(v)}
                                        onReset={() => setGrossOverride(null)}
                                        overridden={grossOverride !== null}
                                        mismatch={grossMismatch} computed={computedGross}/>
                            <TotalField label="Total deductions" testId="slip-total-deductions"
                                        value={deductionsOverride === null ? String(computedDeductions) : deductionsOverride}
                                        onChange={v => setDeductionsOverride(v)}
                                        onReset={() => setDeductionsOverride(null)}
                                        overridden={deductionsOverride !== null}
                                        mismatch={deductionsMismatch} computed={computedDeductions}/>
                            <TotalField label="Net pay" testId="slip-net"
                                        value={netOverride === null ? String(computedNet) : netOverride}
                                        onChange={v => setNetOverride(v)}
                                        onReset={() => setNetOverride(null)}
                                        overridden={netOverride !== null}
                                        mismatch={netMismatch} computed={computedNet}/>
                            <Box>
                                <TextField label="Amount in words" fullWidth multiline value={words}
                                           onChange={e => setWordsOverride(e.target.value)}
                                           sx={ROUNDED_FIELD_SX} data-testid="slip-words"
                                           InputProps={{endAdornment: wordsOverride !== null ? (
                                               <Tooltip title="Reset to the calculated wording">
                                                   <IconButton size="small" aria-label="Reset amount in words"
                                                               onClick={() => setWordsOverride(null)}
                                                               data-testid="slip-words-reset">
                                                       <RestartAltRoundedIcon fontSize="small"/>
                                                   </IconButton>
                                               </Tooltip>
                                           ) : undefined}}/>
                                {wordsMismatch && (
                                    <Typography variant="caption" sx={{color: "warning.main"}}
                                                data-testid="slip-words-mismatch">
                                        Doesn’t match the net pay: “{computedWords}”
                                    </Typography>
                                )}
                            </Box>
                        </Stack>

                        <Typography sx={sectionSx}>Notes</Typography>
                        <Stack spacing={1.5}>
                            {notes.map((note, i) => (
                                <Stack direction="row" spacing={1} alignItems="center" key={i}>
                                    <TextField fullWidth value={note} label={`Line ${i + 1}`}
                                               onChange={e => setNotes(prev => prev.map((n, j) => j === i ? e.target.value : n))}
                                               sx={ROUNDED_FIELD_SX} data-testid={`slip-note-${i}`}/>
                                    <Tooltip title="Remove">
                                        <IconButton aria-label="Remove note"
                                                    onClick={() => setNotes(prev => prev.filter((_, j) => j !== i))}
                                                    data-testid={`slip-note-remove-${i}`}>
                                            <DeleteOutlineRoundedIcon fontSize="small"/>
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            ))}
                        </Stack>
                        <Button startIcon={<AddRoundedIcon/>} sx={{mt: 1, ...NEUTRAL_BUTTON_SX}}
                                disabled={notes.length >= MAX_NOTES}
                                onClick={() => setNotes(prev => [...prev, ""])}
                                data-testid="slip-add-note">
                            Add note line
                        </Button>

                        <Divider sx={{my: 2.5}}/>

                        {blocker !== null && (
                            <Alert severity="error" sx={{mb: 2}} data-testid="slip-blocker">{blocker}</Alert>
                        )}

                        <Button fullWidth variant="contained" disableElevation
                                disabled={submitting || blocker !== null}
                                onClick={handleConfirm}
                                sx={{...BRAND_BUTTON_SX, mb: 1}}
                                data-testid="slip-confirm">
                            {submitting ? "Generating…" : "Confirm and download"}
                        </Button>
                        <Button fullWidth variant="outlined" onClick={onClose} disabled={submitting}
                                sx={NEUTRAL_BUTTON_SX}>
                            Cancel
                        </Button>
                    </>
                )}
            </Box>
        </ResponsiveSheet>
    );
}

// A total: recalculated from the rows until it is typed into, then kept as typed with the
// calculated figure shown alongside. Never silently corrected -- an override has to be visible.
function TotalField({label, value, computed, overridden, mismatch, onChange, onReset, testId}: {
    label: string;
    value: string;
    computed: number;
    overridden: boolean;
    mismatch: boolean;
    onChange: (value: string) => void;
    onReset: () => void;
    testId: string;
}): React.JSX.Element {
    return (
        <Box>
            <TextField
                label={label}
                type="number"
                fullWidth
                value={value}
                onChange={e => onChange(e.target.value)}
                inputProps={{step: "0.001"}}
                sx={ROUNDED_FIELD_SX}
                data-testid={testId}
                InputProps={{
                    startAdornment: <InputAdornment position="start">BD</InputAdornment>,
                    endAdornment: overridden ? (
                        <Tooltip title="Reset to the calculated total">
                            <IconButton size="small" aria-label={`Reset ${label}`} onClick={onReset}
                                        data-testid={`${testId}-reset`}>
                                <RestartAltRoundedIcon fontSize="small"/>
                            </IconButton>
                        </Tooltip>
                    ) : undefined,
                }}
            />
            {mismatch && (
                <Typography variant="caption" sx={{color: "warning.main"}} data-testid={`${testId}-mismatch`}>
                    Doesn’t match the rows, which add up to BD {computed.toFixed(3)}
                </Typography>
            )}
        </Box>
    );
}
