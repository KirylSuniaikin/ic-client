import React, {useState} from "react";
import {Chip} from "@mui/material";
import MenuCostCardsCard from "./business/MenuCostCardsCard";
import ComponentCostDrawer from "./business/ComponentCostDrawer";
import CollapsibleCard from "./business/CollapsibleCard";
import {useCostCards} from "../hooks/useCostCards";
import {BRAND_RED} from "../../../../shared/utils/theme";
import type {UpdateComponentCost} from "../types";

type Props = {
    /**
     * Called after a component cost is successfully saved. Pass businessStats.refresh only when the
     * viewer is OWNER — for MANAGER/SUPER_MANAGER the Business Stats report endpoint is OWNER-only and
     * would 403. Pass undefined for non-OWNER viewers (no refresh attempted).
     */
    onCostSaved?: () => Promise<void>;
};

/**
 * The menu cost-card section of the Pricing tab.
 *
 * <p>Relocated from the OWNER-only Business Stats tab so a branch manager can see what each item
 * costs to make without needing the rest of the business-level report. This component only mounts
 * when the caller renders it, which is the access gate — no internal role check is needed.
 */
export default function PricingCostCardsSection({onCostSaved}: Props): React.JSX.Element {
    const costCards = useCostCards();
    const [costDrawerOpen, setCostDrawerOpen] = useState<boolean>(false);

    const handleSetComponentCost = async (
        id: number,
        payload: UpdateComponentCost
    ): Promise<void> => {
        await costCards.setComponentCost(id, payload);
        if (onCostSaved) {
            await onCostSaved();
        }
    };

    return (
        <>
            <CollapsibleCard
                title="🍕 Menu cost cards"
                summary={costCards.cards ? `${costCards.cards.cards.length} items` : undefined}
                info="What each item costs to make, at the latest price paid for every ingredient. Each line prints its resolved unit cost, which is the only place a per-kg price applied to a per-gram amount becomes visible. Batch recipes — doughs and sauces, which are not menu items — are on the second tab."
                badge={costCards.uncostedCount > 0
                    ? <Chip
                        label={`⚠ ${costCards.uncostedCount} ingredients with no cost`}
                        onClick={() => setCostDrawerOpen(true)}
                        sx={{backgroundColor: BRAND_RED, color: '#fff', fontWeight: 'bold'}}/>
                    : undefined}
            >
                <MenuCostCardsCard
                    data={costCards.cards}
                    loading={costCards.loading}
                    components={costCards.components}
                    onSetCosts={() => setCostDrawerOpen(true)}
                />
            </CollapsibleCard>

            <ComponentCostDrawer
                open={costDrawerOpen}
                components={costCards.components}
                onClose={() => setCostDrawerOpen(false)}
                onChange={handleSetComponentCost}
            />
        </>
    );
}
