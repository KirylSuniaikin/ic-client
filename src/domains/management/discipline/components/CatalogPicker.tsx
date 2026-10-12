import React, { useMemo, useState } from "react";
import { Box, Typography } from "@mui/material";
import { filterCatalogForIssuer } from "../catalog";
import { violationClassLabel } from "../labels";
import { BRAND_RED } from "../../../../shared/utils/theme";
import type { CatalogCategoryTO, CatalogItemTO } from "../types";

export type CatalogPickerProps = {
    categories: ReadonlyArray<CatalogCategoryTO>;
    value: number | null;
    onChange: (id: number) => void;
    canIssueClassD: boolean;
};

function itemMeta(item: CatalogItemTO): string {
    const cls = violationClassLabel(item.violationClass);
    return item.violationClass === "D" ? cls : `${cls} · Points: -${item.points}`;
}

const CatalogPicker: React.FC<CatalogPickerProps> = ({ categories, value, onChange, canIssueClassD }) => {
    const visible = useMemo(() => filterCatalogForIssuer(categories, canIssueClassD), [categories, canIssueClassD]);
    const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

    const toggle = (id: number): void =>
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    return (
        <Box data-testid="catalog-picker">
            {visible.map((c) => {
                const isOpen = expanded.has(c.id);
                return (
                    <Box
                        key={c.id}
                        sx={{ border: "1px solid", borderColor: "grey.200", borderRadius: 3, mb: 1, overflow: "hidden" }}
                    >
                        <Box
                            component="button"
                            type="button"
                            aria-expanded={isOpen}
                            data-testid={`catalog-category-${c.id}`}
                            onClick={(): void => toggle(c.id)}
                            sx={{
                                width: "100%",
                                textAlign: "left",
                                background: "none",
                                border: 0,
                                cursor: "pointer",
                                p: 1.5,
                                fontWeight: 700,
                                fontSize: 14,
                                fontFamily: "inherit",
                            }}
                        >
                            {`${c.code} · ${c.name}`}
                        </Box>
                        {isOpen && (
                            <Box sx={{ px: 1.5, pb: 1.5 }}>
                                {c.correctiveMeasure !== null && (
                                    <Typography
                                        data-testid={`catalog-measure-${c.id}`}
                                        sx={{ fontSize: 13, color: "text.secondary", mb: 1 }}
                                    >
                                        {c.correctiveMeasure}
                                    </Typography>
                                )}
                                {c.items.map((item) => {
                                    const selected = item.id === value;
                                    return (
                                        <Box
                                            key={item.id}
                                            component="button"
                                            type="button"
                                            role="radio"
                                            aria-checked={selected}
                                            data-testid={`catalog-item-${item.id}`}
                                            onClick={(): void => onChange(item.id)}
                                            sx={{
                                                display: "block",
                                                width: "100%",
                                                textAlign: "left",
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                p: 1,
                                                mb: 0.5,
                                                borderRadius: 2,
                                                border: "1px solid",
                                                borderColor: selected ? BRAND_RED : "grey.200",
                                                bgcolor: selected ? "#fdecec" : "#fff",
                                            }}
                                        >
                                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                                                {`${item.code} ${item.title}`}
                                            </Typography>
                                            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                                                {itemMeta(item)}
                                            </Typography>
                                        </Box>
                                    );
                                })}
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
};

export default CatalogPicker;
