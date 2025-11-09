import {useMemo} from "react";
import {Box} from "@mui/material";
import {DataGrid, GridColDef} from "@mui/x-data-grid";
import {DoughUsageRow} from "../management/types/statTypes";
import {GRAMS_BY_TYPE, makeTotalsInGrams} from "../management/mappers/doughMapper";

type Props = {
    rows: unknown[];
};

export default function DoughUsageTable({rows}: Props) {

    const DAYS = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ] as const;

    const DAY_LABEL: Record<typeof DAYS[number], string> = {
        monday: "Monday",
        tuesday: "Tuesday",
        wednesday: "Wednesday",
        thursday: "Thursday",
        friday: "Friday",
        saturday: "Saturday",
        sunday: "Sunday",
    };

    const data = useMemo<DoughUsageRow[]>(
        () =>
            (Array.isArray(rows) ? rows : []).map((r: DoughUsageRow) => ({
                id: r.doughType,
                doughType: r.doughType,
                monday: r.monday ?? 0,
                tuesday: r.tuesday ?? 0,
                wednesday: r.wednesday ?? 0,
                thursday: r.thursday ?? 0,
                friday: r.friday ?? 0,
                saturday: r.saturday ?? 0,
                sunday: r.sunday ?? 0,
            })),
        [rows]
    );

    const totalsByDay = useMemo<Record<typeof DAYS[number], number>>(() => {
        const totals: any = {};
        for (const d of DAYS) {
            totals[d] = data.reduce((sum, r) => {
                const gramsPerUnit = GRAMS_BY_TYPE[r.doughType] ?? 0;
                const count = r[d] ?? 0;
                return sum + count * gramsPerUnit;
            }, 0);
        }
        return totals;
    }, [data]);

    type DayKey = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday";


    const renderQtyCell = (day: DayKey): GridColDef<DoughUsageRow>["renderCell"] => {
        return (params) => {
            const row = params.row as DoughUsageRow;
            if(row.isTotal) return;
            const count = Number(row[day] ?? 0);
            const gramsPerUnit = GRAMS_BY_TYPE[row.doughType] ?? 0;
            const grams = Math.round(count * gramsPerUnit);
            const totalGrams = totalsByDay[day] || 0;
            const pct = totalGrams > 0 ? ((grams / totalGrams) * 100).toFixed(1) : "0.0";
            return (
                <span>
        {count} <span style={{ opacity: 0.7 }}>({grams} g, {pct}%)</span>
      </span>
            );
        };
    };

    const dataWithTotal = useMemo(() => {
        if (!data.length) return data;
        const total = makeTotalsInGrams(data);
        return [...data, total];
    }, [data]);

    const columns: GridColDef<DoughUsageRow>[] = [
        { field: "doughType", headerName: "Dough type", flex: 1, minWidth: 160 },
        ...DAYS.map((d) => ({
            field: d,
            headerName: DAY_LABEL[d],
            width: 170,
            sortable: false,
            filterable: false,
            renderCell: (p) =>
                p.id === "__total" ? <b>{(p.value as number) ?? 0} g</b> : renderQtyCell(d)(p),
            valueGetter: (_v, row) => row[d],
        })),
    ];

    return (
        <Box sx={{ borderRadius: 3, width: '100%', boxShadow: 3}}>
            <DataGrid
                rows={dataWithTotal}
                getRowId={(r) => r.doughType}
                columns={columns}
                hideFooter
                disableRowSelectionOnClick
                sx={{
                    borderRadius: 3,
                    pt: 1,
                    "& .MuiDataGrid-columnHeaders": { fontWeight: 700 },
                    "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
                }}
            />
        </Box>
    );
}