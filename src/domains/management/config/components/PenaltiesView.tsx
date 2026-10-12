import React, { useState } from "react";
import { Box, Button, CircularProgress, IconButton, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { usePenaltyCatalog } from "../hooks/usePenaltyCatalog";
import CatalogEntryDrawer from "./CatalogEntryDrawer";
import type { CatalogDrawerTarget } from "./CatalogEntryDrawer";
import ShadowPilotSwitch from "./ShadowPilotSwitch";
import type { CatalogItemTO } from "../../discipline/types";

const CARD_SX = {
    backgroundColor: "#fff",
    borderRadius: 2,
    boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
    p: 2,
    mb: 2,
} as const;

function formatValues(item: CatalogItemTO): string {
    if (item.violationClass === "D") return "Class D";
    const parts = [`Class ${item.violationClass}`, `${item.points} pts`];
    if (item.ttlDays !== null) parts.push(`${item.ttlDays} days`);
    parts.push(`${item.penaltyHours} h`);
    return parts.join(" · ");
}

export default function PenaltiesView(): JSX.Element {
    const catalog = usePenaltyCatalog();
    const [target, setTarget] = useState<CatalogDrawerTarget | null>(null);
    const { categories, loadingCatalog, catalogError } = catalog;

    return (
        <Box>
            <ShadowPilotSwitch settings={catalog.settings} onChange={catalog.setShadowPilot} />
            {catalog.settingsError !== null && (
                <Typography variant="body2" color="error" sx={{ mb: 2 }}>
                    {catalog.settingsError}
                </Typography>
            )}

            {loadingCatalog && categories === null && (
                <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={24} />
                </Box>
            )}
            {catalogError !== null && (
                <Typography variant="body2" color="error">
                    {catalogError}
                </Typography>
            )}

            {categories?.map((category) => (
                <Box key={category.id} sx={CARD_SX}>
                    <Typography variant="h6" fontWeight="bold">
                        {category.code} · {category.name}
                    </Typography>
                    {category.correctiveMeasure !== null && (
                        <Typography variant="caption" color="text.secondary" component="div">
                            {category.correctiveMeasure}
                        </Typography>
                    )}
                    {category.items.map((item) => (
                        <Box
                            key={item.id}
                            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eee", py: 1, mt: 1 }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {item.code} {item.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {formatValues(item)}
                                </Typography>
                            </Box>
                            <IconButton
                                size="small"
                                aria-label={`Edit ${item.code}`}
                                onClick={() => setTarget({ mode: "edit", item })}
                            >
                                <EditIcon />
                            </IconButton>
                        </Box>
                    ))}
                    <Button
                        size="small"
                        sx={{ textTransform: "none", mt: 1 }}
                        onClick={() => setTarget({ mode: "create", category })}
                    >
                        Add entry
                    </Button>
                </Box>
            ))}

            <CatalogEntryDrawer
                target={target}
                onClose={() => setTarget(null)}
                createEntry={catalog.createEntry}
                updateEntry={catalog.updateEntry}
            />
        </Box>
    );
}
