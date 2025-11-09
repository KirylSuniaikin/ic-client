import {Box} from "@mui/material";

const colorRed = "#E44B4C";
const colorYellow = "#F2C94C";
const colorGreen = "#27AE60";
const colorTrack = "#e9edf3";

const coerceSeconds = (v) => {
    if (v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);

    const s = String(v).trim();

    const mmss = /^(-)?(\d{1,3}):(\d{2})$/;
    const m = s.match(mmss);
    if (m) {
        const sign = m[1] ? -1 : 1;
        const mm = parseInt(m[2], 10);
        const ss = Math.min(59, parseInt(m[3], 10));
        return sign * (mm * 60 + ss);
    }

    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const formatMmSs = (secondsLike) => {
    const s = coerceSeconds(secondsLike);
    const sign = s < 0 ? "-" : "";
    const abs = Math.abs(s);
    const mm = String(Math.floor(abs / 60)).padStart(2, "0");
    const ss = String(abs % 60).padStart(2, "0");
    return `${sign}${mm}:${ss}`;
};

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
    const labelSeconds = Math.trunc(coerceFinite(timeLeft, 0)); // может быть < 0
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