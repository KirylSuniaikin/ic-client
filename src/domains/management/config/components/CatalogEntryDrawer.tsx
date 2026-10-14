import React, { useState } from "react";
import { Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import ResponsiveSheet, { SHEET_MENU_PROPS } from "../../_shared/components/ResponsiveSheet";
import { BRAND_BUTTON_SX } from "../../_shared/components/roundedSelect";
import type {
    CatalogCategoryTO,
    CatalogItemTO,
    CreateCatalogEntryRequest,
    UpdateCatalogEntryRequest,
    ViolationClass,
} from "../../discipline/types";

export type CatalogDrawerTarget =
    | { mode: "create"; category: CatalogCategoryTO }
    | { mode: "edit"; item: CatalogItemTO };

export type CatalogEntryDrawerProps = {
    target: CatalogDrawerTarget | null;
    onClose: () => void;
    createEntry: (request: CreateCatalogEntryRequest) => Promise<CatalogItemTO>;
    updateEntry: (id: number, request: UpdateCatalogEntryRequest) => Promise<CatalogItemTO>;
};

const CLASSES: ViolationClass[] = ["A", "B", "C", "D"];
const INTEGER = /^\d+$/;
const HOURS = /^\d{1,3}(\.\d{1,2})?$/;
const MAX_TITLE = 255;
const MAX_HOURS = 999.99;

type FormState = { title: string; violationClass: ViolationClass; points: string; ttlDays: string; penaltyHours: string };

function initialState(target: CatalogDrawerTarget): FormState {
    if (target.mode === "create") {
        return { title: "", violationClass: "A", points: "", ttlDays: "", penaltyHours: "" };
    }
    const { item } = target;
    const isD = item.violationClass === "D";
    return {
        title: item.title,
        violationClass: item.violationClass,
        points: isD ? "" : String(item.points),
        ttlDays: isD || item.ttlDays === null ? "" : String(item.ttlDays),
        penaltyHours: String(item.penaltyHours),
    };
}

function isPositiveInteger(value: string): boolean {
    return INTEGER.test(value) && Number(value) > 0;
}

function isValidHours(value: string): boolean {
    return HOURS.test(value) && Number(value) <= MAX_HOURS;
}

type FormProps = Omit<CatalogEntryDrawerProps, "target"> & { target: CatalogDrawerTarget };

const CatalogEntryForm: React.FC<FormProps> = ({ target, onClose, createEntry, updateEntry }) => {
    const [form, setForm] = useState<FormState>(() => initialState(target));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isD = form.violationClass === "D";
    const titleValid = target.mode === "edit" || (form.title.trim().length >= 1 && form.title.length <= MAX_TITLE);
    const numbersValid =
        isD || (isPositiveInteger(form.points) && isPositiveInteger(form.ttlDays) && isValidHours(form.penaltyHours));
    const valid = titleValid && numbersValid;

    const handleClassChange = (next: ViolationClass): void => {
        setForm((prev) =>
            prev.violationClass === "D" && next !== "D"
                ? { ...prev, violationClass: next, points: "", ttlDays: "" }
                : { ...prev, violationClass: next },
        );
    };

    const handleSubmit = async (): Promise<void> => {
        const numbers = isD
            ? { points: 0, ttlDays: null, penaltyHours: 0 }
            : { points: Number(form.points), ttlDays: Number(form.ttlDays), penaltyHours: Number(form.penaltyHours) };
        setSaving(true);
        setError(null);
        try {
            if (target.mode === "create") {
                await createEntry({
                    categoryId: target.category.id,
                    title: form.title.trim(),
                    violationClass: form.violationClass,
                    ...numbers,
                });
            } else {
                await updateEntry(target.item.id, { violationClass: form.violationClass, ...numbers });
            }
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save the entry");
            setSaving(false);
        }
    };

    const numberField = (
        label: string,
        value: string,
        shown: string,
        onChange: (v: string) => void,
        inputMode: "numeric" | "decimal",
    ): JSX.Element => (
        <TextField
            label={label}
            value={isD ? shown : value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isD}
            size="small"
            fullWidth
            inputProps={{ inputMode }}
        />
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {target.mode === "create" ? (
                <TextField
                    label="Title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    size="small"
                    fullWidth
                    inputProps={{ maxLength: MAX_TITLE }}
                />
            ) : (
                <Typography variant="body1">{target.item.title}</Typography>
            )}
            <TextField
                select
                label="Class"
                value={form.violationClass}
                onChange={(e) => handleClassChange(e.target.value as ViolationClass)} // MUI types select values as string
                size="small"
                fullWidth
                SelectProps={{ MenuProps: SHEET_MENU_PROPS }}
            >
                {CLASSES.map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
            </TextField>
            {numberField("Points", form.points, "0", (v) => setForm((p) => ({ ...p, points: v })), "numeric")}
            {numberField("Expiry (days)", form.ttlDays, "", (v) => setForm((p) => ({ ...p, ttlDays: v })), "numeric")}
            {numberField("Penalty hours", form.penaltyHours, "0", (v) => setForm((p) => ({ ...p, penaltyHours: v })), "decimal")}
            <Typography variant="caption" color="text.secondary">
                Changes apply to future violations only. Violations already issued keep their points, expiry and hours.
            </Typography>
            {error !== null && (
                <Typography role="alert" variant="body2" color="error">
                    {error}
                </Typography>
            )}
            <Button
                variant="contained"
                disabled={!valid || saving}
                onClick={() => void handleSubmit()}
                sx={BRAND_BUTTON_SX}
            >
                {target.mode === "create" ? "Add entry" : "Save"}
            </Button>
        </Box>
    );
};

const CatalogEntryDrawer: React.FC<CatalogEntryDrawerProps> = ({ target, onClose, createEntry, updateEntry }) => {
    const title =
        target === null
            ? undefined
            : target.mode === "create"
              ? `Add entry — ${target.category.name}`
              : `Edit ${target.item.code}`;
    // The key remounts the form so each opening starts from its own entry's values.
    const formKey = target === null ? "closed" : target.mode === "create" ? `c${target.category.id}` : `e${target.item.id}`;

    return (
        <ResponsiveSheet open={target !== null} onClose={onClose} title={title}>
            {target !== null && (
                <CatalogEntryForm
                    key={formKey}
                    target={target}
                    onClose={onClose}
                    createEntry={createEntry}
                    updateEntry={updateEntry}
                />
            )}
        </ResponsiveSheet>
    );
};

export default CatalogEntryDrawer;
