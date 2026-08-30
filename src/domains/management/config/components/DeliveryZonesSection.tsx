import React, { useCallback, useEffect, useState } from "react";
import {
    Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
    Switch, TextField, Typography,
} from "@mui/material";
import {
    createDeliveryZone, deleteDeliveryZone, fetchDeliveryZones, updateDeliveryZone,
} from "../../../../shared/api/management";
import { logger } from "../../../../shared/utils/logger";
import { GOOGLE_MAPS_API_KEY } from "../../../branch/utils/mapsConfig";
import { DeliveryZoneMap } from "./DeliveryZoneMap";
import { draftFromZone, isDraftDirty, validateZoneDraft } from "../utils/deliveryZoneDraft";
import type { DeliveryZoneDraft } from "../utils/deliveryZoneDraft";
import type { DeliveryZone } from "../types";

const BRAND = "#E44B4C";

/**
 * Draw and edit where this branch will deliver.
 *
 * ── Read this before changing anything that saves ────────────────────────────────────────────
 * Zones **narrow** the radius; they never extend it. A pin must be inside an active zone AND
 * inside the freshness radius. And `DeliveryZoneService` fails **closed**: a polygon it cannot
 * parse covers nothing. Together those mean a malformed save does not throw and does not warn —
 * it silently stops this branch delivering anywhere, and the only symptom is customers being
 * turned away. So the draft is validated before it is sent, and the save button stays disabled
 * until it would be accepted.
 *
 * A branch with NO active zone is unrestricted (radius-only), which is why deactivating is
 * offered next to deleting: it is the safe way to suspend a zone without losing the drawing.
 *
 * Sits on the Schedule tab beside DeliverySwitch, not on Menu: both answer "what is this one
 * kitchen delivering today", and both are gated to the same MANAGER-and-up roles that
 * /api/management/delivery/** requires.
 */

type Props = {
    branchId: string;
    /** Centres an empty map on the kitchen. Null on branches with no coordinates recorded. */
    branchLatitude: number | null;
    branchLongitude: number | null;
    /**
     * How far this kitchen delivers, from the branch payload. Drawn on the map so the sentence
     * above the editor — a zone narrows the radius, it never extends it — becomes something a
     * manager can see. Null on a branch object that did not come from a branch fetch.
     */
    branchRadiusKm: number | null;
    /**
     * Lets ConfigComponent's branch-switch guard include unsaved zone work. Reported rather than
     * inferred: a draft that merely opened a saved zone to look at it is not work to lose.
     */
    onDirtyChange: (dirty: boolean) => void;
};

export default function DeliveryZonesSection({
    branchId,
    branchLatitude,
    branchLongitude,
    branchRadiusKm,
    onDirtyChange,
}: Props): JSX.Element {
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [draft, setDraft] = useState<DeliveryZoneDraft | null>(null);
    /**
     * Bumped whenever the editable overlay must be rebuilt from the draft — a different zone
     * opened, an undo, a clear. NOT bumped as vertices are dragged: the map owns the path during
     * a session, and re-seeding it mid-drag would rebuild the shape under the manager's finger.
     */
    const [sessionKey, setSessionKey] = useState(0);
    const [pendingDelete, setPendingDelete] = useState<DeliveryZone | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            setZones(await fetchDeliveryZones(branchId));
        } catch (e) {
            logger.error("Failed to load delivery zones", e);
            setError("Could not load this branch's delivery zones.");
        } finally {
            setLoading(false);
        }
    }, [branchId]);

    // Keyed on the branch, so switching branches reloads AND abandons the draft — which is what
    // makes the parent's discard-and-switch guard sufficient with no reset plumbing.
    useEffect(() => {
        setDraft(null);
        void load();
    }, [branchId, load]);

    // Reported on every change rather than at edit boundaries: a draft becomes dirty on the first
    // tap on the map, not when the editor opens.
    useEffect(() => {
        onDirtyChange(draft !== null && isDraftDirty(draft, zones));
    }, [draft, zones, onDirtyChange]);

    function openDraft(next: DeliveryZoneDraft): void {
        setDraft(next);
        setError(null);
        setSessionKey((key) => key + 1);
    }

    function reseed(polygon: number[][]): void {
        setDraft((prev) => (prev === null ? prev : { ...prev, polygon }));
        setSessionKey((key) => key + 1);
    }

    // No reseed: the map already holds this path — it is the one that just reported it. Bumping
    // the session here would rebuild the overlay on every vertex drag.
    const handlePolygonChange = useCallback((polygon: number[][]): void => {
        setDraft((prev) => (prev === null ? prev : { ...prev, polygon }));
    }, []);

    async function handleSave(): Promise<void> {
        if (draft === null) return;
        const problem = validateZoneDraft(draft);
        if (problem !== null) {
            setError(problem);
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const body = {
                branchId,
                name: draft.name.trim(),
                polygon: draft.polygon,
                active: draft.active,
            };
            if (draft.id === null) {
                await createDeliveryZone(body);
            } else {
                await updateDeliveryZone(draft.id, body);
            }
            setDraft(null);
            await load();
        } catch (e) {
            logger.error("Failed to save delivery zone", e);
            setError("Could not save this zone. It has not been changed.");
        } finally {
            setSaving(false);
        }
    }

    async function handleConfirmDelete(): Promise<void> {
        const zone = pendingDelete;
        if (zone === null) return;
        setPendingDelete(null);
        setSaving(true);
        setError(null);
        try {
            await deleteDeliveryZone(zone.id);
            if (draft?.id === zone.id) setDraft(null);
            await load();
        } catch (e) {
            logger.error("Failed to delete delivery zone", e);
            setError("Could not delete this zone.");
        } finally {
            setSaving(false);
        }
    }

    const validationProblem = draft === null ? null : validateZoneDraft(draft);
    const center = branchLatitude !== null && branchLongitude !== null
        ? { lat: branchLatitude, lng: branchLongitude }
        : null;

    return (
        <Box sx={{ backgroundColor: "#fff", borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,0.1)", p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ flex: 1 }}>Delivery zones</Typography>
                {(loading || saving) && <CircularProgress size={18} />}
            </Box>
            {/* Says which direction a zone acts in, because getting that backwards is the whole
                risk here: drawing one does not extend the branch's reach, it restricts it. */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                A zone narrows where this kitchen delivers — it never extends the radius. With no
                active zone the branch delivers anywhere inside its radius.
            </Typography>

            {error !== null && (
                <Typography variant="body2" data-testid="zone-error" sx={{ mb: 2, color: BRAND }}>
                    {error}
                </Typography>
            )}

            {zones.length === 0 && !loading && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No zones drawn — this branch delivers anywhere inside its radius.
                </Typography>
            )}

            {zones.map((zone) => (
                <Box
                    key={zone.id}
                    data-testid={`zone-row-${zone.id}`}
                    sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid #eee", py: 1 }}
                >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{zone.name}</Typography>
                        {/* An empty polygon on a saved zone is the server telling us it could not
                            parse the stored one. Saying so is the point: that row is the one
                            blocking delivery, and hiding it would leave it unfixable. */}
                        <Typography variant="caption" color={zone.polygon.length === 0 ? "error" : "text.secondary"}>
                            {zone.polygon.length === 0
                                ? "Stored shape could not be read — redraw it"
                                : `${zone.polygon.length} points`}
                        </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {zone.active ? "Active" : "Off"}
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => openDraft(draftFromZone(zone))}
                        sx={{ textTransform: "none", fontWeight: 700, color: BRAND }}
                    >
                        Edit
                    </Button>
                    <Button
                        size="small"
                        onClick={() => setPendingDelete(zone)}
                        sx={{ textTransform: "none", color: "text.secondary" }}
                    >
                        Delete
                    </Button>
                </Box>
            ))}

            {GOOGLE_MAPS_API_KEY ? (
                <>
                    {draft === null ? (
                        <Button
                            onClick={() => openDraft({ id: null, name: "", polygon: [], active: true })}
                            sx={{ mt: 2, textTransform: "none", fontWeight: 700, color: BRAND }}
                        >
                            + New zone
                        </Button>
                    ) : (
                        <Box sx={{ mt: 2 }}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Zone name"
                                value={draft.name}
                                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                sx={{ mb: 1.5 }}
                            />

                            <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                                <Typography variant="body2" sx={{ flex: 1 }}>
                                    Active
                                </Typography>
                                <Switch
                                    checked={draft.active}
                                    onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                                    slotProps={{ input: { "aria-label": "Zone is active" } }}
                                />
                            </Box>

                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                                Tap the map to add a point, drag a point to move it, right-click a
                                point to remove it.
                            </Typography>

                            <DeliveryZoneMap
                                zones={zones}
                                editingZoneId={draft.id}
                                editing
                                sessionKey={`${draft.id ?? "new"}-${sessionKey}`}
                                initialPolygon={draft.polygon}
                                onPolygonChange={handlePolygonChange}
                                center={center}
                                radiusKm={branchRadiusKm}
                            />

                            {/* The count is the only feedback that the polygon is long enough to
                                be accepted, and the reason the save button is disabled. */}
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                                {draft.polygon.length} point(s)
                            </Typography>

                            {validationProblem !== null && (
                                <Typography variant="caption" data-testid="zone-validation" sx={{ display: "block", color: BRAND }}>
                                    {validationProblem}
                                </Typography>
                            )}

                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
                                <Button
                                    variant="contained"
                                    disableElevation
                                    disabled={saving || validationProblem !== null}
                                    onClick={() => { void handleSave(); }}
                                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: 999,
                                          backgroundColor: BRAND, "&:hover": { backgroundColor: "#c63b3c" } }}
                                >
                                    Save zone
                                </Button>
                                <Button
                                    disabled={draft.polygon.length === 0}
                                    onClick={() => reseed(draft.polygon.slice(0, -1))}
                                    sx={{ textTransform: "none", color: "text.secondary" }}
                                >
                                    Undo point
                                </Button>
                                <Button
                                    disabled={draft.polygon.length === 0}
                                    onClick={() => reseed([])}
                                    sx={{ textTransform: "none", color: "text.secondary" }}
                                >
                                    Clear
                                </Button>
                                <Button
                                    onClick={() => { setDraft(null); setError(null); }}
                                    sx={{ textTransform: "none", color: "text.secondary" }}
                                >
                                    Cancel
                                </Button>
                            </Box>
                        </Box>
                    )}
                </>
            ) : (
                // No key configured means no map at all — the coordinate list is the fallback, the
                // same one BranchListView and the route drill-down fall back to. Drawing is the
                // one thing genuinely impossible without it, so it is the one thing withdrawn.
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                        No Google Maps key is configured, so zones cannot be drawn here. The stored
                        coordinates are shown as [longitude, latitude] pairs.
                    </Typography>
                    {zones.map((zone) => (
                        <Box key={zone.id} sx={{ mt: 1.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{zone.name}</Typography>
                            <Box component="ul" sx={{ m: 0, pl: 3 }}>
                                {zone.polygon.map((point, index) => (
                                    <Typography key={index} component="li" variant="caption" color="text.secondary">
                                        {`${point[0].toFixed(5)}, ${point[1].toFixed(5)}`}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            <Dialog
                open={pendingDelete !== null}
                onClose={() => setPendingDelete(null)}
                PaperProps={{ sx: { borderRadius: "14px", width: 270, m: 2 } }}
            >
                <DialogTitle sx={{ fontSize: "13px", fontWeight: 600, textAlign: "center", pb: 0.5, pt: 2.5 }}>
                    Delete this zone?
                </DialogTitle>
                <DialogContent sx={{ textAlign: "center", pb: 1.5 }}>
                    <Typography fontSize="13px" color="text.secondary">
                        “{pendingDelete?.name}” will be removed. To keep the drawing but stop it
                        applying, switch it off instead.
                    </Typography>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ p: 0 }}>
                    <Button
                        fullWidth
                        onClick={() => setPendingDelete(null)}
                        sx={{ borderRadius: 0, py: 1.4, fontSize: "13px", color: "text.secondary",
                              fontWeight: 400, borderRight: "0.5px solid", borderColor: "divider" }}
                    >
                        Cancel
                    </Button>
                    <Button
                        fullWidth
                        onClick={() => { void handleConfirmDelete(); }}
                        sx={{ borderRadius: 0, py: 1.4, fontSize: "13px", color: BRAND, fontWeight: 600 }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
