import type { ActionLevel, ViolationClass } from "./types";

export const ACTION_LEVEL_LABEL: Record<ActionLevel, string> = {
    WRITTEN: "Written Warning",
    FINAL: "Final Written Warning",
    TERMINATION: "Termination",
    TERMINATION_ART107: "Termination (art.107) record",
};

export function violationClassLabel(c: ViolationClass): string {
    return `Class ${c}`;
}
