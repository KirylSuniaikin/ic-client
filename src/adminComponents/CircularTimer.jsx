import {Box} from "@mui/material";

const colorRed = "#E44B4C";
const colorYellow = "#F2C94C";
const colorGreen = "#27AE60";
const colorTrack = "#e9edf3";

const coerceFinite = (v, fallback = 0) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const formatMmSsSigned = (secondsLike) => {
    const s = Math.trunc(coerceFinite(secondsLike, 0));
    const sign = s < 0 ? "-" : "";
    const abs = Math.abs(s);
    const mm = String(Math.floor(abs / 60)).padStart(2, "0");
    const ss = String(abs % 60).padStart(2, "0");
    return `${sign}${mm}:${ss}`;
};

export function CircularTimer({
                                  timeLeft,
                                  totalSec,
                                  size = 64,
                                  stroke = 6,
                                  onClick,
                              }) {
    const labelSeconds = Math.trunc(coerceFinite(timeLeft, 0));
    const total = Math.max(1, Math.trunc(coerceFinite(totalSec, 1)));

    const left = Math.max(0, Math.min(labelSeconds, total));

    const r = (size - stroke) / 2;
    const C = 2 * Math.PI * r;

    const p = Math.max(0, Math.min(1, left / total));
    const dash = C * p;
    const gap = C - dash;

    const color = left < 60 ? colorRed : left < 300 ? colorYellow : colorGreen;

    return (
        <Box
            sx={{ position: "relative", width: size, height: size, cursor: onClick ? "pointer" : "default" }}
            onClick={onClick}
        >
            <svg width={size} height={size}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={colorTrack}
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${gap}`}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>

            <Box
                sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                }}
            >
                {formatMmSsSigned(labelSeconds)}
            </Box>
        </Box>
    );
}