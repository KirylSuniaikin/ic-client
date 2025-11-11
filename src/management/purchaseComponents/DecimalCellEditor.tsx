import React from "react";
import {TextField} from "@mui/material";


export const normalizeDecimal = (s: unknown) => {
    let t = String(s ?? "").trim().replace(",", ".");
    t = t.replace(/[^\d.-]/g, "");
    t = t.replace(/(?!^)-/g, "");
    const i = t.indexOf(".");
    if (i !== -1) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, ""); // одна точка
    return t;
};


type DecimalCellEditorProps = any & {
    highlightPredicate?: (text: string) => boolean;
};

export const DecimalCellEditor: React.FC<DecimalCellEditorProps> = (params) => {
    const { api, id, field, highlightPredicate } = params;
    const [text, setText] = React.useState<string>(String(params.value ?? ""));

    const apply = async () => {
        const norm = normalizeDecimal(text);
        await api.setEditCellValue({ id, field, value: norm });
        queueMicrotask(() => { try { api.stopCellEditMode({ id, field }); } catch {} });
    };

    const overTarget = !!highlightPredicate?.(text);

    return (
        <TextField
            autoFocus
            size="small"
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => {
                const t = e.target.value;
                setText(t);
                api.setEditCellValue({ id, field, value: normalizeDecimal(t) }, e);
            }}
            onBlur={apply}
            onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
            sx={overTarget ? (theme) => ({
                backgroundColor: `${theme.palette.error.light}33`,
                "& .MuiInputBase-input": { color: theme.palette.error.main, fontWeight: 700 },
            }) : undefined}
            helperText={overTarget ? "Above target" : ""}
            error={overTarget}
            fullWidth
        />
    );
};

