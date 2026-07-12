// Copy comes from the customerAuth i18n namespace; brand-red styling mirrors
// ClientInfoPopup/PickUpReminderPopup.
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Button, CircularProgress, Drawer, IconButton, InputAdornment, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import SmartphoneRoundedIcon from "@mui/icons-material/SmartphoneRounded";
import SmsRoundedIcon from "@mui/icons-material/SmsRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { motion } from "framer-motion";
import { registerCustomerName, requestOtp } from "../../../shared/api/customerAuth";
import { useCustomerAuth } from "../context/CustomerAuthProvider";
import { CustomerAuthApiError } from "../types";
import { countries, localizedCountryName } from "../../../shared/utils/countries";
import { usePreciseCountdown } from "../../../shared/hooks/usePreciseCountdown";

const brandRed = "#E44B4C";
const brandRedTint = "#FCE9E9";
const CODE_LENGTH = 4;
const RESEND_COOLDOWN_MS = 45_000;

type Step = "phone" | "code";

type Props = {
    open: boolean;
    onClose: () => void;
    prefillPhone?: string; // full phone string, e.g. "97333607710" — see task-spec.md §5.5
    prefillName?: string; // task-spec.md §5.5a — post-order "create an account" name prefill
    // task-spec.md §1 — this login is part of a mandatory checkout verification: the code is
    // sent automatically and the phone-entry step is skipped (the phone was already collected
    // by ClientInfoPopup), and the code step's copy switches to checkout-specific wording.
    checkoutMode?: boolean;
};

// Maps a failed request/verify attempt to a user-facing message. A plain rate
// limit uses the localized rate-limit copy; anything else falls back to the
// server-provided message, then to the localized fallback.
function resolveErrorMessage(error: unknown, fallback: string, rateLimitMessage: string): string {
    if (error instanceof CustomerAuthApiError) {
        if (error.status === 429) {
            return rateLimitMessage;
        }
        return error.message || fallback;
    }
    return fallback;
}

// Formats a remaining-seconds count as M:SS (no leading zero on minutes) for
// the resend countdown label, e.g. 45 -> "0:45".
function formatCountdown(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CustomerLoginPopup({ open, onClose, prefillPhone, prefillName, checkoutMode }: Props): React.JSX.Element {
    const { t, i18n } = useTranslation("customerAuth");
    const { login } = useCustomerAuth();
    const [step, setStep] = useState<Step>("phone");
    const [selectedCountry, setSelectedCountry] = useState(countries[0].name);
    const [nationalDigits, setNationalDigits] = useState("");
    const [fullPhone, setFullPhone] = useState("");
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    // True once a brand-new, cold (no prefill) customer's code has been accepted —
    // task-spec.md §5.5a requirement 6. Login already succeeded (token issued); the
    // popup stays open, showing a mandatory name prompt in place of the code step's
    // digit boxes, until the name is submitted.
    const [awaitingName, setAwaitingName] = useState(false);
    // The access token returned by the login() call that triggered awaitingName —
    // needed to call registerCustomerName (an authenticated endpoint) immediately,
    // without depending on a context re-render.
    const [pendingAccessToken, setPendingAccessToken] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Epoch ms of the most recent successful requestOtp call; drives the 45s
    // resend cooldown. Reset to null on popup open so a stale countdown never
    // carries over into a fresh session.
    const [codeSentAt, setCodeSentAt] = useState<number | null>(null);

    // Refs to the 4 segmented OTP boxes — used only for focus movement. The
    // code value itself stays the single `code` string; each box derives its
    // displayed char from code[i].
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const countryObj = countries.find((c) => c.name === selectedCountry) ?? countries[0];

    // Reset all local state whenever the popup is (re)opened, so a previous
    // session's phone/code/error doesn't leak into the next one. When a
    // prefillPhone is provided (task-spec.md §6.2), split it into country +
    // national digits using the same lookup ClientInfoPopup.tsx:46 uses,
    // instead of inventing a new normalization pattern.
    useEffect(() => {
        if (open) {
            setStep("phone");
            setFullPhone("");
            setCode("");
            setName(prefillName ?? "");
            setAwaitingName(false);
            setPendingAccessToken(null);
            setError(null);
            setIsSubmitting(false);
            setCodeSentAt(null);

            const matchedCountry = prefillPhone ? countries.find((c) => prefillPhone.startsWith(c.code)) : undefined;
            if (prefillPhone && matchedCountry) {
                setSelectedCountry(matchedCountry.name);
                setNationalDigits(prefillPhone.slice(matchedCountry.code.length));
            } else {
                setSelectedCountry(countries[0].name);
                setNationalDigits("");
            }
        }
    }, [open, prefillPhone, prefillName]);

    const isPhoneValid = /^\d+$/.test(nationalDigits) && nationalDigits.length === countryObj.digits;
    const isCodeValid = /^\d{4}$/.test(code);

    const resendRemainingMs = usePreciseCountdown(
        codeSentAt !== null ? codeSentAt + RESEND_COOLDOWN_MS : Date.now(),
        1000
    );
    const resendRemainingSeconds = Math.max(0, Math.floor(resendRemainingMs / 1000));
    const isResendReady = resendRemainingSeconds <= 0;

    // The send half of the old handleGetCode, extracted so checkoutMode's auto-send
    // effect (below) can trigger it directly with a phone that is already known --
    // ClientInfoPopup already collected and validated it, so there is no separate
    // phone-step submission here. A failed send drops back to the phone step with the
    // error, a real fallback rather than a dead end.
    async function sendCode(candidatePhone: string): Promise<void> {
        setFullPhone(candidatePhone);
        setIsSubmitting(true);
        try {
            await requestOtp({ phone: candidatePhone });
            setStep("code");
            setCodeSentAt(Date.now());
        } catch (err) {
            setError(resolveErrorMessage(err, t("errors.sendFailed"), t("errors.tooManyAttempts")));
            setStep("phone");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleGetCode(): Promise<void> {
        if (!isPhoneValid) {
            setError(t("errors.invalidPhone", {
                digits: countryObj.digits,
                country: localizedCountryName(countryObj, i18n.language),
            }));
            return;
        }
        setError(null);
        await sendCode(countryObj.code + nationalDigits);
    }

    // Routed through a ref so the checkoutMode auto-send effect below can call the
    // latest sendCode without listing it in the effect dependency array (its identity
    // changes every render) -- mirrors the loadProfileRef/loadOrdersRef pattern in
    // CustomerProfilePopup.tsx.
    const sendCodeRef = useRef(sendCode);
    sendCodeRef.current = sendCode;

    // A checkout customer already gave us their phone via ClientInfoPopup, so send the OTP
    // immediately and open straight on the code step; the phone-entry step is never shown.
    // Declared after the open-reset effect above
    // so it wins within the same commit (a successful open both resets to the phone
    // step and, here, optimistically re-sets to the code step before the request
    // settles -- isSubmitting already renders the CTA button's spinner, so there is no
    // flash of the phone input while the request is in flight).
    useEffect(() => {
        if (!open || !checkoutMode || !prefillPhone) return;
        const matched = countries.find((c) => prefillPhone.startsWith(c.code));
        if (!matched || prefillPhone.slice(matched.code.length).length !== matched.digits) return;
        setStep("code");
        void sendCodeRef.current(prefillPhone);
    }, [open, checkoutMode, prefillPhone]);

    async function handleResend(): Promise<void> {
        if (!isResendReady || isSubmitting) return;
        setError(null);
        setIsSubmitting(true);
        try {
            await requestOtp({ phone: fullPhone });
            setCode("");
            setCodeSentAt(Date.now());
        } catch (err) {
            setError(resolveErrorMessage(err, t("errors.sendFailed"), t("errors.tooManyAttempts")));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleVerifyCode(): Promise<void> {
        if (!isCodeValid) {
            setError(t("errors.enterCode"));
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            const result = await login(fullPhone, code, undefined, name.trim() || undefined);
            // A brand-new account with no name sent yet (no prefill was available) must be
            // asked before login completes (task-spec.md §5.5a requirement 6); any other case
            // (returning customer, or a new customer whose name was already sent via prefill)
            // closes exactly as today.
            if (result.isNewAccount && name.trim() === "") {
                setPendingAccessToken(result.accessToken);
                setAwaitingName(true);
            } else {
                onClose();
            }
        } catch (err) {
            setError(resolveErrorMessage(err, t("errors.invalidCode"), t("errors.tooManyAttempts")));
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleContinueName(): Promise<void> {
        if (name.trim() === "") {
            setError(t("errors.nameRequired"));
            return;
        }
        if (!pendingAccessToken) {
            setError(t("errors.nameSaveFailed"));
            return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            await registerCustomerName(pendingAccessToken, name.trim());
            onClose();
        } catch (err) {
            // Retryable — the user stays on the name prompt with their entered name intact
            // and remains logged in (token already issued).
            setError(resolveErrorMessage(err, t("errors.nameSaveFailed"), t("errors.tooManyAttempts")));
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleChangeNumber(): void {
        setStep("phone");
        setCode("");
        setError(null);
    }

    function focusBox(index: number): void {
        const el = inputRefs.current[index];
        if (el) {
            el.focus();
            el.select();
        }
    }

    // Segmented OTP — all three handlers mutate only the single `code` string,
    // preserving the digits-only / max-4 / /^\d{4}$/ semantics of the old field.
    function handleDigitChange(index: number, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void {
        const digits = e.target.value.replace(/\D/g, "");
        if (!digits) return;
        const digit = digits.slice(-1);
        setError(null);
        setCode((prev) => {
            const chars = prev.split("");
            chars[index] = digit;
            return chars.join("").slice(0, CODE_LENGTH);
        });
        if (index < CODE_LENGTH - 1) focusBox(index + 1);
    }

    function handleDigitKeyDown(index: number, e: React.KeyboardEvent): void {
        if (e.key === "Backspace") {
            e.preventDefault();
            setError(null);
            setCode((prev) => {
                const chars = prev.split("");
                if (chars[index]) {
                    chars[index] = "";
                } else if (index > 0) {
                    chars[index - 1] = "";
                }
                return chars.join("");
            });
            if (!code[index] && index > 0) focusBox(index - 1);
        } else if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            focusBox(index - 1);
        } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
            e.preventDefault();
            focusBox(index + 1);
        }
    }

    function handleDigitPaste(index: number, e: React.ClipboardEvent): void {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
        if (!pasted) return;
        setError(null);
        setCode((prev) => {
            const chars = prev.split("");
            for (let k = 0; k < pasted.length && index + k < CODE_LENGTH; k++) {
                chars[index + k] = pasted[k];
            }
            return chars.join("").slice(0, CODE_LENGTH);
        });
        focusBox(Math.min(index + pasted.length, CODE_LENGTH - 1));
    }

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    height: "100dvh",
                    "@supports not (height: 100dvh)": { height: "100vh" },
                    width: "100%",
                    maxWidth: { sm: 480 },
                    mx: { sm: "auto" },
                    borderTopLeftRadius: { xs: 20, sm: 28 },
                    borderTopRightRadius: { xs: 20, sm: 28 },
                    overflow: "hidden",
                    background: "linear-gradient(170deg, #FFFBFA 0%, #FFF2F1 45%, #FBE3E3 100%)",
                },
            }}
        >
            <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                {/* A full-screen sheet needs an explicit way out: on the code step
                    the back chevron returns to the phone step, otherwise it closes.
                    While awaitingName, going back to the phone step would let a new
                    customer re-verify without ever being asked for a name again (their
                    account already exists by then) — so this closes instead, same as
                    the tolerated "dismiss while awaitingName" edge case. */}
                <Box sx={{ display: "flex", alignItems: "center", minHeight: 56, px: 1 }}>
                    <IconButton
                        aria-label={step === "code" && !awaitingName ? t("login.back") : t("login.close")}
                        onClick={step === "code" && !awaitingName ? handleChangeNumber : onClose}
                        sx={{ color: "#333" }}
                    >
                        <ArrowBackIosNewRoundedIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Box>

                <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 3, sm: 4 }, pt: { xs: 3, sm: 5 } }}>
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                    >
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", mb: 4 }}>
                            <Box
                                sx={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: "50%",
                                    bgcolor: brandRedTint,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    mb: 2.5,
                                    boxShadow: "0 8px 24px rgba(228,75,76,0.18)",
                                }}
                            >
                                {step === "phone" ? (
                                    <SmartphoneRoundedIcon sx={{ fontSize: 36, color: brandRed }} />
                                ) : (
                                    <SmsRoundedIcon sx={{ fontSize: 36, color: brandRed }} />
                                )}
                            </Box>
                            {/* Assumed: swapping the copy for the mandatory name prompt (still
                                the "code" step, no new Step value) so it doesn't keep showing
                                stale "Enter your code" text once the code has already been
                                accepted — task-spec.md §5.5a requirement 6. */}
                            <Typography sx={{ fontWeight: 800, fontSize: 24, letterSpacing: "-0.01em" }}>
                                {step === "phone"
                                    ? t("login.phoneTitle")
                                    : awaitingName
                                        ? t("login.nameTitle")
                                        : checkoutMode
                                            ? t("login.checkoutCodeTitle")
                                            : t("login.codeTitle")}
                            </Typography>
                            <Typography sx={{ mt: 1, color: "#6b6b6b", fontSize: 15, lineHeight: 1.45, maxWidth: 320 }}>
                                {step === "phone"
                                    ? t("login.phoneSubtitle")
                                    : awaitingName
                                        ? t("login.nameSubtitle")
                                        : checkoutMode
                                            ? t("login.checkoutCodeSubtitle", { phone: fullPhone })
                                            : t("login.codeSubtitle", { phone: fullPhone })}
                            </Typography>
                        </Box>

                        {step === "phone" && (
                            <TextField
                                label={t("login.phoneLabel")}
                                placeholder={t("login.phonePlaceholder")}
                                fullWidth
                                value={nationalDigits}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    if (/^\d*$/.test(val)) {
                                        setNationalDigits(val);
                                        setError(null);
                                    }
                                }}
                                error={Boolean(error)}
                                inputProps={{ inputMode: "numeric" }}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    sx: {
                                        borderRadius: 3,
                                        fontSize: "1.05rem",
                                        bgcolor: "#fff",
                                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                                    },
                                    // Country-code selector lives INSIDE the phone field's start
                                    // adornment so the two read as a single unified input.
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Select
                                                value={selectedCountry}
                                                onChange={(e) => {
                                                    setSelectedCountry(e.target.value);
                                                    setError(null);
                                                }}
                                                variant="standard"
                                                disableUnderline
                                                inputProps={{ "aria-label": t("login.country") }}
                                                renderValue={() => `+${countryObj.code}`}
                                                MenuProps={{ PaperProps: { sx: { maxHeight: 320, borderRadius: 3 } } }}
                                                sx={{
                                                    fontSize: "1.05rem",
                                                    fontWeight: 700,
                                                    color: "#1c1c1c",
                                                    "& .MuiSelect-select": { py: 0, pr: "20px" },
                                                }}
                                            >
                                                {countries.map((option) => (
                                                    <MenuItem key={option.name} value={option.name}>
                                                        {localizedCountryName(option, i18n.language)} ({option.code})
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            <Box sx={{ width: "1px", height: 28, bgcolor: "grey.300", ml: 1, mr: 1.5 }} />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        )}

                        {step === "code" && !awaitingName && (
                            <Stack
                                direction="row"
                                spacing={1.5}
                                justifyContent="center"
                                role="group"
                                aria-label={t("login.codeGroup")}
                            >
                                {Array.from({ length: CODE_LENGTH }, (_, i) => (
                                    <TextField
                                        key={i}
                                        value={code[i] ?? ""}
                                        onChange={(e) => handleDigitChange(i, e)}
                                        onKeyDown={(e) => handleDigitKeyDown(i, e)}
                                        onPaste={(e) => handleDigitPaste(i, e)}
                                        onFocus={(e) => e.currentTarget.select()}
                                        error={Boolean(error)}
                                        autoFocus={i === 0}
                                        inputRef={(el: HTMLInputElement | null) => {
                                            inputRefs.current[i] = el;
                                        }}
                                        inputProps={{
                                            inputMode: "numeric",
                                            "aria-label": t("login.digit", { index: i + 1 }),
                                            autoComplete: i === 0 ? "one-time-code" : "off",
                                            style: {
                                                textAlign: "center",
                                                fontSize: "1.7rem",
                                                fontWeight: 700,
                                                padding: 0,
                                            },
                                        }}
                                        sx={{
                                            width: 60,
                                            "& .MuiOutlinedInput-root": {
                                                height: 64,
                                                borderRadius: 3,
                                                bgcolor: "#fff",
                                                boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                                                "& fieldset": { borderColor: "#ececec" },
                                                "&:hover fieldset": { borderColor: "#ddd" },
                                                "&.Mui-focused fieldset": { borderColor: brandRed, borderWidth: 2 },
                                            },
                                        }}
                                    />
                                ))}
                            </Stack>
                        )}

                        {step === "code" && !awaitingName && (
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}>
                                <Button
                                    variant="text"
                                    onClick={handleResend}
                                    disabled={isSubmitting || !isResendReady}
                                    sx={{ textTransform: "none", fontWeight: 700, color: brandRed }}
                                >
                                    {isResendReady
                                        ? t("login.resend")
                                        : t("login.resendIn", { time: formatCountdown(resendRemainingSeconds) })}
                                </Button>
                            </Box>
                        )}

                        {step === "code" && awaitingName && (
                            <TextField
                                label={t("login.nameLabel")}
                                placeholder={t("login.namePlaceholder")}
                                fullWidth
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setError(null);
                                }}
                                error={Boolean(error)}
                                InputLabelProps={{ shrink: true }}
                                InputProps={{
                                    sx: {
                                        borderRadius: 3,
                                        fontSize: "1.05rem",
                                        bgcolor: "#fff",
                                        boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                                    },
                                }}
                            />
                        )}

                        {error && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 0.75,
                                    mt: 2.5,
                                }}
                            >
                                <ErrorOutlineRoundedIcon sx={{ fontSize: 18, color: brandRed }} />
                                <Typography sx={{ color: brandRed, fontSize: 13.5, textAlign: "center" }}>
                                    {error}
                                </Typography>
                            </Box>
                        )}
                    </motion.div>
                </Box>

                <Box sx={{ px: { xs: 3, sm: 4 }, pt: 2, pb: { xs: 4, sm: 5 } }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={step === "phone" ? handleGetCode : awaitingName ? handleContinueName : handleVerifyCode}
                        // The name prompt intentionally does NOT pre-disable on a blank value —
                        // Continue is clickable and surfaces an inline validation error instead
                        // (task-spec.md §5.5a requirement 5/step 5), unlike the phone/code steps.
                        disabled={isSubmitting || (step === "phone" ? !isPhoneValid : awaitingName ? false : !isCodeValid)}
                        sx={{
                            py: 1.6,
                            color: "#fff",
                            textTransform: "none",
                            fontSize: "1.05rem",
                            fontWeight: 700,
                            borderRadius: 999,
                            background: "linear-gradient(135deg, #E44B4C 0%, #D0393A 100%)",
                            boxShadow: "0 10px 24px rgba(228,75,76,0.30)",
                            "&:hover": {
                                background: "linear-gradient(135deg, #d83f40 0%, #C33132 100%)",
                                boxShadow: "0 10px 24px rgba(228,75,76,0.34)",
                            },
                            "&.Mui-disabled": { background: "#f0c9ca", color: "#fff", boxShadow: "none" },
                        }}
                    >
                        {isSubmitting ? (
                            <CircularProgress size={24} sx={{ color: "#fff" }} />
                        ) : step === "phone" ? (
                            t("login.getCode")
                        ) : awaitingName ? (
                            t("login.continue")
                        ) : checkoutMode ? (
                            t("login.checkoutSubmit")
                        ) : (
                            t("login.submit")
                        )}
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
}

export default CustomerLoginPopup;
