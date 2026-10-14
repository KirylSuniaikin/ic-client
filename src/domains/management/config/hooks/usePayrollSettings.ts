import { useCallback, useEffect, useState } from "react";
import { fetchPayrollSettings, updatePayrollSettings } from "../../../../shared/api/management";
import type { PayrollSettingsTO } from "../types";

export type UsePayrollSettingsResult = {
    settings: PayrollSettingsTO | null;
    loadError: string | null;
    setCapPaidOvertime: (value: boolean) => Promise<void>;
};

// The mutation propagates its error: the switch owns the error display.
export function usePayrollSettings(): UsePayrollSettingsResult {
    const [settings, setSettings] = useState<PayrollSettingsTO | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void (async (): Promise<void> => {
            try {
                const loaded = await fetchPayrollSettings();
                if (!cancelled) setSettings(loaded);
            } catch (err) {
                if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load payroll settings");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const setCapPaidOvertime = useCallback(async (value: boolean): Promise<void> => {
        const updated = await updatePayrollSettings({ capPaidOvertime: value });
        setSettings(updated);
        setLoadError(null);
    }, []);

    return { settings, loadError, setCapPaidOvertime };
}
