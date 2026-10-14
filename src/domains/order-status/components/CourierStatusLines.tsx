// The lines under the courier map that say what is happening right now: who is riding, roughly
// how long until they are at the door, and how fresh the position on the map is. The freshness
// line ticks every second between polls, which is what tells the customer the map is live rather
// than a picture of where the rider was.
import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { TrackedCourier } from "../types";

const TICK_MS = 1_000;

/** Whole minutes to show for an ETA: rounded up, and never "0 min" while the rider is still out. */
function etaMinutesOf(courier: TrackedCourier): number | null {
    // `typeof` rather than `!== null`: a backend that predates the field omits it entirely.
    if (typeof courier.etaSeconds !== "number") return null;
    return Math.max(1, Math.ceil(courier.etaSeconds / 60));
}

function headlineOf(courier: TrackedCourier, split: boolean, t: TFunction): string {
    const minutes = etaMinutesOf(courier);
    if (split) {
        return minutes === null
            ? t("orderStatus.courierPartCaption", { index: courier.partIndex, name: courier.name })
            : t("orderStatus.courierPartOnTheWay", { index: courier.partIndex, name: courier.name, minutes });
    }
    return minutes === null
        ? t("orderStatus.courierOnTheWayNoEta", { name: courier.name })
        : t("orderStatus.courierOnTheWay", { name: courier.name, minutes });
}

function updatedAgoOf(ageSeconds: number, t: TFunction): string {
    return ageSeconds < 60
        ? t("orderStatus.courierUpdatedSecondsAgo", { seconds: ageSeconds })
        : t("orderStatus.courierUpdatedAgo", { minutes: Math.floor(ageSeconds / 60) });
}

/** The current time, re-read once per second — one timer for every line, not one per rider. */
function useNowEverySecond(): number {
    const [now, setNow] = useState<number>(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => clearInterval(id);
    }, []);
    return now;
}

type Landing = { couriers: TrackedCourier[]; atMs: number };

type CourierStatusLinesProps = {
    couriers: TrackedCourier[];
    /**
     * The order is split into parts (partsTotal > 1), whether or not more than one is riding.
     * While part 1 is out and part 2 is still in the kitchen only one rider is on the map, and
     * an unnumbered "~6 min" would read as the whole order arriving then.
     */
    split?: boolean;
};

export function CourierStatusLines({ couriers, split = false }: CourierStatusLinesProps): JSX.Element {
    const { t } = useTranslation("customerAuth");
    const now = useNowEverySecond();

    // When the poll carrying `couriers` landed. useCourierTracking hands over a new array on
    // every poll and the same one otherwise, so a new array IS a new landing — React's
    // "adjust state while rendering" pattern, rather than an effect that would paint one frame
    // with the new fix's age plus the old landing's elapsed time.
    // The phone's clock only ever measures this local interval; it is never compared with a
    // server time, which is why the backend sends ages rather than timestamps.
    const [landing, setLanding] = useState<Landing>(() => ({ couriers, atMs: Date.now() }));
    let landedAtMs = landing.atMs;
    if (landing.couriers !== couriers) {
        landedAtMs = Date.now();
        setLanding({ couriers, atMs: landedAtMs });
    }
    // The ticker's `now` can be up to a second older than a landing that just happened.
    const sinceLandingSeconds = Math.max(0, Math.floor((now - landedAtMs) / 1000));

    // Two riders at once can only be two parts of one order, whatever the caller passed.
    const partCopy = split || couriers.length > 1;

    return (
        <Box>
            {couriers.map((courier) => (
                <Box key={courier.partIndex} data-testid={`courier-status-${courier.partIndex}`} sx={{ mt: 1 }}>
                    <Typography
                        data-testid={`courier-caption-${courier.partIndex}`}
                        sx={{ color: "#3b352c", fontSize: 14, fontWeight: 700, lineHeight: 1.35 }}
                    >
                        {headlineOf(courier, partCopy, t)}
                    </Typography>
                    <Typography
                        data-testid={`courier-updated-${courier.partIndex}`}
                        variant="caption"
                        sx={{ display: "block", color: "#8a807a", fontWeight: 600 }}
                    >
                        {updatedAgoOf(courier.positionAgeSeconds + sinceLandingSeconds, t)}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}
