import React from "react";
import {Card, CardContent, Typography} from "@mui/material";
import {DeliveredByHourTable} from "../DeliveredByHourTable";
import {DeliveryAvailabilityCard} from "../performance/DeliveryAvailabilityCard";
import {StatEmptyState} from "../performance/statPlaceholders";
import type {AvailabilityScope} from "../performance/DeliveryAvailabilityCard";
import type {DeliveryAvailabilityStats, DeliveryHourBucket} from "../../types";

type Props = {
    hourly: DeliveryHourBucket[];
    availability: DeliveryAvailabilityStats | null;
    /** Passed straight through: the card pins the branches and dates its figures were fetched for. */
    availabilityScope: AvailabilityScope | null;
};

/**
 * The two halves of the same delivery question, read against each other.
 *
 * The first grid is when delivery WAS bought; the second is when it could not be. They share one
 * axis convention (ISO weekday x Bahrain-local hour) precisely so a manager can put them side by
 * side: an hour that sells well AND shows "no courier" time is the hour that needs another rider,
 * and neither grid says that on its own.
 *
 * The availability card is the same component the Performance tab renders — the availability
 * figures belong to both questions, and a second copy of that grid would be the one that
 * quietly stopped matching.
 */
export function DeliveryTab({hourly, availability, availabilityScope}: Props): JSX.Element {
    return (
        <>
            <Card sx={{borderRadius: 3, boxShadow: 3, width: "100%", mb: 2}}>
                <CardContent>
                    <Typography variant="h6" sx={{mb: 0.5}}>🛵 <b>Delivered By Hour</b></Typography>
                    <Typography variant="caption" color="text.secondary" sx={{display: "block"}}>
                        by the hour the food arrived, not the hour the order was placed
                    </Typography>

                    {hourly.length === 0 ? (
                        <StatEmptyState message="Nothing was delivered in this range"/>
                    ) : (
                        <DeliveredByHourTable buckets={hourly}/>
                    )}
                </CardContent>
            </Card>

            <DeliveryAvailabilityCard stats={availability} scope={availabilityScope}/>
        </>
    );
}
