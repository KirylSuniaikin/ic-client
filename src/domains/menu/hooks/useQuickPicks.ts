import { useEffect, useState } from "react";
import { getQuickPicks } from "../../../shared/api/public";
import type { QuickPickDto } from "../types";

export function useQuickPicks(menuItemId: number | undefined | null): QuickPickDto[] {
    const [picks, setPicks] = useState<QuickPickDto[]>([]);

    useEffect(() => {
        if (menuItemId === null || menuItemId === undefined) {
            setPicks([]);
            return;
        }

        getQuickPicks(menuItemId)
            .then(setPicks)
            .catch(() => setPicks([]));
    }, [menuItemId]);

    return picks;
}
