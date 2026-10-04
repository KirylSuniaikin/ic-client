import React, {useState} from "react";
import {
    Box, Chip, Drawer, Stack, TextField, Typography
} from "@mui/material";
import type {ComponentCost, UpdateComponentCost} from "../../types";
import {BRAND_RED} from "../../../../../shared/utils/theme";
import {describeSaveError, parseCellInput} from "./businessFormat";

type Props = {
    open: boolean;
    components: ComponentCost[];
    onClose: () => void;
    /** Rejects when the cost is refused: the drawer then keeps what was typed and says why. */
    onChange: (id: number, payload: UpdateComponentCost) => Promise<void>;
};

function without<T>(record: Readonly<Record<number, T>>, id: number): Record<number, T> {
    const next = {...record};
    delete next[id];
    return next;
}

/**
 * Gives each recipe component a cost.
 *
 * <p>The only surface anywhere for editing components — there is no component CRUD in this codebase —
 * and without it every cost card is empty and recipe COGS is zero, so this is a prerequisite for the
 * profit statement rather than a convenience.
 *
 * <p>Costs are entered <strong>per kilogram, litre or piece</strong>, the basis the owner already
 * works in, and the resolved per-gram figure is shown beside it. That pairing is deliberate: it is
 * the only place a 1000x mistake becomes obvious.
 */
export default function ComponentCostDrawer(
    {open, components, onClose, onChange}: Props
): React.JSX.Element {
    const [drafts, setDrafts] = useState<Record<number, string>>({});
    const [errors, setErrors] = useState<Record<number, string>>({});
    const [savingIds, setSavingIds] = useState<ReadonlySet<number>>(new Set());

    const markSaving = (id: number, saving: boolean): void => {
        setSavingIds(prev => {
            const next = new Set(prev);
            if (saving) next.add(id); else next.delete(id);
            return next;
        });
    };

    // Blur is the only place a save starts -- Enter just blurs -- and the field is locked until the
    // save answers, so one edit can never be sent twice. The draft stays on screen until then, and
    // after a refusal, so a failed save never looks like the old cost coming back.
    const commit = async (component: ComponentCost): Promise<void> => {
        const raw = drafts[component.id];
        if (raw === undefined) return;

        const parsed = parseCellInput(raw, false);
        if (parsed.kind === "invalid") {
            setErrors(prev => ({...prev, [component.id]: `Not saved: the cost ${parsed.reason}.`}));
            return;
        }
        // Leaving the field with the stored figure in it is not an edit.
        if (parsed.value === component.cost) {
            setDrafts(prev => without(prev, component.id));
            return;
        }

        markSaving(component.id, true);
        try {
            await onChange(component.id, {cost: parsed.value, clearCost: parsed.value === null});
            setDrafts(prev => without(prev, component.id));
        } catch (e) {
            setErrors(prev => ({...prev, [component.id]: `Not saved: ${describeSaveError(e)}`}));
        } finally {
            markSaving(component.id, false);
        }
    };

    const uncosted = components.filter(c => c.costSource === "MISSING").length;

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{zIndex: 1350}}
            PaperProps={{
                sx: {
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: {sm: 720},
                    mx: {sm: 'auto'},
                    maxHeight: '85dvh',
                    overflowY: 'auto',
                }
            }}
        >
            <Box sx={{p: 3, pb: 4}}>
                <Box sx={{width: 40, height: 4, bgcolor: 'grey.300', borderRadius: 2, mx: 'auto', mb: 2}}/>

                <Typography variant="h6" fontWeight="bold" sx={{textAlign: 'center'}}>
                    🍕 Ingredient costs
                </Typography>

                <Typography variant="body2" sx={{color: '#8a807a', textAlign: 'center', mt: 1}}>
                    {uncosted === 0
                        ? "Every ingredient has a cost."
                        : `${uncosted} ingredient${uncosted === 1 ? "" : "s"} still have no cost, so every recipe using them understates its cost.`}
                </Typography>

                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', textAlign: 'center', mb: 2}}>
                    Enter costs per kilogram, litre or piece — the same basis as your supplier prices.
                </Typography>

                <Stack spacing={2}>
                    {components.map(component => (
                        <Box
                            key={component.id}
                            data-testid={`component-row-${component.id}`}
                            sx={{
                                border: '1px solid #f1eae4',
                                borderRadius: 3,
                                p: 2,
                                backgroundColor: component.costSource === "MISSING" ? '#FCE9E9' : '#fff',
                            }}
                        >
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5}}>
                                <Typography fontWeight="bold" sx={{color: '#3b352c'}}>{component.name}</Typography>
                                {component.unit && (
                                    <Chip size="small" label={component.unit.toLowerCase()}
                                          sx={{backgroundColor: '#f1eae4', color: '#8a807a'}}/>
                                )}
                                <Chip
                                    size="small"
                                    label={component.costSource}
                                    sx={component.costSource === "MISSING"
                                        ? {backgroundColor: BRAND_RED, color: '#fff'}
                                        : {backgroundColor: '#f1eae4', color: '#8a807a'}}
                                />
                                {component.productName && (
                                    <Typography variant="caption" sx={{color: '#8a807a'}}>
                                        linked to {component.productName}
                                        {component.productPrice !== null && ` @ ${component.productPrice}`}
                                    </Typography>
                                )}
                            </Box>

                            <Stack direction={{xs: 'column', sm: 'row'}} spacing={2} alignItems="center">
                                <TextField
                                    size="small"
                                    fullWidth
                                    label="Cost per kg / litre / piece"
                                    value={drafts[component.id] ?? (component.cost ?? "")}
                                    disabled={savingIds.has(component.id)}
                                    error={errors[component.id] !== undefined}
                                    helperText={errors[component.id]}
                                    onChange={e => {
                                        setDrafts(prev => ({...prev, [component.id]: e.target.value}));
                                        setErrors(prev => without(prev, component.id));
                                    }}
                                    onBlur={() => void commit(component)}
                                    inputProps={{
                                        'aria-label': `Cost for ${component.name}`,
                                        onKeyDown: e => {
                                            if (e.key === "Enter") e.currentTarget.blur();
                                        },
                                    }}
                                />

                                {/* The pairing that catches a 1000x error: a gram of anything costing
                                    5 BD is not a real ingredient, and only this figure shows it. */}
                                <Typography variant="caption" sx={{color: '#8a807a', whiteSpace: 'nowrap'}}>
                                    = {component.resolvedUnitCost} per{" "}
                                    {component.unit ? component.unit.toLowerCase().replace(/s$/, "") : "unit"}
                                </Typography>
                            </Stack>

                            {component.ingredients.length > 0 && (
                                <Typography variant="caption" sx={{display: 'block', color: '#8a807a', mt: 1}}>
                                    Batch of {component.ingredients.length} ingredient
                                    {component.ingredients.length === 1 ? "" : "s"}
                                    {component.batchYield === null
                                        ? " — no batch yield set, so it cannot be costed"
                                        : `, yielding ${component.batchYield}`}
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Stack>
            </Box>
        </Drawer>
    );
}
