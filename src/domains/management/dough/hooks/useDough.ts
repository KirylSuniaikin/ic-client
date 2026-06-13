import { useEffect, useRef, useState } from "react";
import type { DoughStatus, DoughType, DoughAvailabilityFlags } from "../types";
import { getDoughInventory, putDoughInventory, putDoughAvailability } from "../../../../shared/api/management";

export interface UseDoughResult {
    doughLoading: boolean;
    onDoughInventoryChange: (type: DoughType, value: number) => void;
    onDoughAvailabilityToggle: (key: string) => Promise<void>;
}

export function useDough(
    branchId: string | null,
    doughStatus: DoughStatus | null,
    setDoughStatus: React.Dispatch<React.SetStateAction<DoughStatus | null>>,
): UseDoughResult {
    const [doughLoading, setDoughLoading] = useState(false);
    const doughStatusRef = useRef<DoughStatus | null>(null);
    doughStatusRef.current = doughStatus;
    const doughDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        if (!branchId) return;

        let cancelled = false;

        async function loadDoughInventory(): Promise<void> {
            try {
                setDoughLoading(true);
                const status = await getDoughInventory(branchId!);
                if (!cancelled) {
                    setDoughStatus(status);
                    doughStatusRef.current = status;
                }
            } catch (err) {
                console.error("Failed to load dough inventory:", err);
            } finally {
                if (!cancelled) setDoughLoading(false);
            }
        }

        void loadDoughInventory();

        return () => {
            cancelled = true;
            clearTimeout(doughDebounceRef.current);
        };
    }, [branchId]);

    const onDoughInventoryChange = (type: DoughType, value: number): void => {
        const current = doughStatusRef.current;
        const optimisticStatus: DoughStatus | null = current ? {
            S: type === 'S' ? value : current.S,
            M: type === 'M' ? value : current.M,
            L: type === 'L' ? value : current.L,
            Brick: type === 'Brick' ? value : current.Brick,
            availability: current.availability,
        } : null;
        setDoughStatus(optimisticStatus);
        doughStatusRef.current = optimisticStatus;

        clearTimeout(doughDebounceRef.current);
        doughDebounceRef.current = setTimeout(async () => {
            const latest = doughStatusRef.current;
            if (!branchId || !latest) return;
            try {
                const serverResponse = await putDoughInventory(branchId, latest);
                setDoughStatus(serverResponse);
                doughStatusRef.current = serverResponse;
            } catch (err) {
                console.error("Failed to save dough inventory:", err);
            }
        }, 300);
    };

    const onDoughAvailabilityToggle = async (key: string): Promise<void> => {
        if (!branchId || !doughStatus) return;

        const prevStatus = doughStatus;
        const prevAvailability: DoughAvailabilityFlags = doughStatus.availability ?? {
            S: false, M: false, L: false, "Brick dough": false,
        };

        let updatedFlags: DoughAvailabilityFlags;
        if (key === "S") {
            updatedFlags = { ...prevAvailability, S: !prevAvailability.S };
        } else if (key === "M") {
            updatedFlags = { ...prevAvailability, M: !prevAvailability.M };
        } else if (key === "L") {
            updatedFlags = { ...prevAvailability, L: !prevAvailability.L };
        } else {
            // key === "Brick dough" — the only other value DoughSection passes via AVAILABILITY_KEY
            updatedFlags = { ...prevAvailability, "Brick dough": !prevAvailability["Brick dough"] };
        }

        const optimisticStatus: DoughStatus = { ...doughStatus, availability: updatedFlags };
        setDoughStatus(optimisticStatus);
        doughStatusRef.current = optimisticStatus;

        try {
            const serverResponse = await putDoughAvailability(branchId, updatedFlags);
            setDoughStatus(serverResponse);
            doughStatusRef.current = serverResponse;
        } catch (err) {
            setDoughStatus(prevStatus);
            doughStatusRef.current = prevStatus;
            console.error("Failed to update dough availability:", err);
        }
    };

    return { doughLoading, onDoughInventoryChange, onDoughAvailabilityToggle };
}
