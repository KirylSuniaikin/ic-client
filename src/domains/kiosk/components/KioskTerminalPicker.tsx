import { useCallback, useEffect, useState } from "react";
import { Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import { logger } from "../../../shared/utils/logger";
import { fetchPairingOptions, PairingUnavailableError } from "../../../shared/api/kiosk";
import type { PairingKiosk } from "../../../shared/api/kiosk";
import { setKioskDeviceName } from "../services/kioskIdentity";

interface KioskTerminalPickerProps {
    /** The branch already chosen by KioskBranchSelector; the list is filtered to it. */
    selectedBranchId: string | null;
    onSelect: (kiosk: PairingKiosk) => void;
}

/**
 * Second half of kiosk setup: which card terminal in this branch is this screen bolted next to.
 *
 * Staff-facing setup screen, so deliberately English-only — same convention as
 * `KioskBranchSelector`, which this deliberately mirrors visually (full-screen blurred overlay at
 * z-index 99999, so a device without a pairing can never be used to order).
 *
 * The backend's pairing endpoint is not branch-filtered, so the filtering happens here.
 */
export function KioskTerminalPicker({ selectedBranchId, onSelect }: KioskTerminalPickerProps): JSX.Element {
    const [options, setOptions] = useState<PairingKiosk[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        setError(null);
        setOptions(null);
        try {
            setOptions(await fetchPairingOptions());
        } catch (e) {
            // Diagnosable on-screen rather than a blank list: the overwhelmingly likely cause is a
            // backend that doesn't serve /api/kiosk yet, which staff can act on.
            logger.error("Error loading kiosk pairing options:", e);
            setError(
                e instanceof PairingUnavailableError
                    ? "Kiosk pairing is unavailable on this server. Check that the backend supports kiosks."
                    : "Could not load the list of kiosks. Check the connection and try again.",
            );
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    function handleSelect(kiosk: PairingKiosk): void {
        setKioskDeviceName(kiosk.deviceName);
        onSelect(kiosk);
    }

    const visible = (options ?? []).filter(
        (option) => selectedBranchId === null || option.branchId === selectedBranchId,
    );

    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100vw",
                height: "100vh",
                zIndex: 99999,
                backgroundColor: "rgba(0, 0, 0, 0.6)",
                backdropFilter: "blur(15px)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <Box
                sx={{
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    p: 4,
                    borderRadius: 4,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                    maxWidth: 500,
                    width: "90%",
                    maxHeight: "80vh",
                    overflowY: "auto",
                    textAlign: "center",
                }}
            >
                <PointOfSaleIcon sx={{ fontSize: 60, color: "#E44B4C", mb: 2 }} />

                <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ color: "#000" }}>
                    Select This Kiosk
                </Typography>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                    Choose the card terminal this screen is paired with.<br />
                    This setting will be saved automatically.
                </Typography>

                {options === null && error === null && <CircularProgress sx={{ color: "#E44B4C" }} />}

                {error !== null && (
                    <Stack spacing={2}>
                        <Typography variant="body2" sx={{ color: "#E44B4C" }}>{error}</Typography>
                        <Button variant="outlined" onClick={() => void load()} sx={{ borderRadius: 3, py: 1.5 }}>
                            Try again
                        </Button>
                    </Stack>
                )}

                {options !== null && error === null && visible.length === 0 && (
                    <Stack spacing={2}>
                        <Typography variant="body2" color="text.secondary">
                            No kiosks are registered for this branch yet.
                        </Typography>
                        <Button variant="outlined" onClick={() => void load()} sx={{ borderRadius: 3, py: 1.5 }}>
                            Refresh
                        </Button>
                    </Stack>
                )}

                <Stack spacing={2}>
                    {visible.map((kiosk) => (
                        <Button
                            key={kiosk.deviceName}
                            variant="contained"
                            size="large"
                            onClick={() => handleSelect(kiosk)}
                            sx={{
                                py: 2,
                                fontSize: "1.2rem",
                                borderRadius: 3,
                                backgroundColor: "#fff",
                                color: "#000",
                                border: "2px solid #eee",
                                boxShadow: "none",
                                display: "flex",
                                flexDirection: "column",
                                textTransform: "none",
                                "&:hover": {
                                    backgroundColor: "#E44B4C",
                                    color: "#fff",
                                    border: "2px solid #E44B4C",
                                },
                            }}
                        >
                            <Box component="span" sx={{ fontWeight: "bold" }}>{kiosk.deviceName}</Box>
                            <Box component="span" sx={{ fontSize: "0.85rem", opacity: 0.7 }}>
                                Terminal {kiosk.terminalId} · {kiosk.branchName}
                            </Box>
                        </Button>
                    ))}
                </Stack>
            </Box>
        </Box>
    );
}

export default KioskTerminalPicker;
