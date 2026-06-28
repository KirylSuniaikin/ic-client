import React from "react";
import {Grid} from "@mui/material";
import {PlatformStatCard} from "../PlatformStatCard";
import type {StatsResponse} from "../../types";

type Props = {
    stats: StatsResponse;
};

export function PlatformsStatisticsGrid({stats}: Props): JSX.Element {
    return (
        <Grid container spacing={2}>
            <Grid size={{xs: 12, sm: 6}}>
                <PlatformStatCard
                    title="Pick Up"
                    items={[
                        {label: "Revenue", value: stats.totalPickUpRevenue, subValue: "BD", previousValue: stats.previous?.totalPickUpRevenue},
                        {label: "Orders", value: stats.totalPickUpOrderCount},
                    ]}
                />
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
                <PlatformStatCard
                    title="Talabat"
                    items={[
                        {label: "Revenue", value: stats.totalTalabatRevenue, subValue: "BD", previousValue: stats.previous?.totalTalabatRevenue},
                        {label: "Orders", value: stats.totalTalabatOrders},
                    ]}
                />
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
                <PlatformStatCard
                    title="Keeta"
                    items={[
                        {label: "Revenue", value: stats.totalKeetaRevenue, subValue: "BD", previousValue: stats.previous?.totalKeetaRevenue},
                        {label: "Orders", value: stats.totalKeetaOrders},
                    ]}
                />
            </Grid>
        </Grid>
    );
}
