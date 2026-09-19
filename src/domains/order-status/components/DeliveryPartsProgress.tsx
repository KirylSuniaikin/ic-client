// runs/6b/task-spec.md §6. Per-part progress line shown only inside OrderStatusContent's `riding`
// block, alongside CourierTrackingMap, when the order genuinely has more than one part
// (parts.length > 1 — never rendered for a single-part order, even a defensive length-1 array).
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { TrackedPart } from "../types";

export function DeliveryPartsProgress({ parts }: { parts: TrackedPart[] }): JSX.Element | null {
    const { t } = useTranslation("customerAuth");

    if (parts.length <= 1) return null;

    return (
        <Box sx={{ borderRadius: 4, border: "1px solid #f1eae4", mt: 1, p: 1.5 }}>
            {parts.map((part) => (
                <Typography
                    key={part.partIndex}
                    data-testid={`delivery-part-progress-${part.partIndex}`}
                    variant="body2"
                    sx={{ color: "#8a807a", fontWeight: 600 }}
                >
                    {part.delivered
                        ? t("orderStatus.partDelivered", { index: part.partIndex, total: part.partsTotal })
                        : t("orderStatus.partOnTheWay", { index: part.partIndex, total: part.partsTotal })}
                </Typography>
            ))}
        </Box>
    );
}
