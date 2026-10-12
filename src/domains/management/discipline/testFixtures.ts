import type { CatalogCategoryTO, CatalogItemTO, StaffDisciplineTO, ViolationClass, ViolationTO } from "./types";

export function makeViolation(overrides: Partial<ViolationTO> = {}): ViolationTO {
    return {
        id: 1,
        employeeId: 7,
        typeId: 3,
        code: "4.2",
        title: "Late arrival",
        categoryName: "Attendance",
        violationClass: "B",
        points: 5,
        penaltyHours: 1,
        status: "ACTIVE",
        shadowPilot: false,
        issuedAt: "2026-10-07T10:15:00",
        expiresAt: "2026-12-07T10:15:00",
        expired: false,
        daysUntilExpiry: null,
        occurredOn: "2026-10-06",
        discoveredOn: "2026-10-07",
        issuedByName: "Gina GM",
        issuerComment: "Arrived late",
        activatedAt: null,
        confirmedByName: null,
        explanationDueAt: null,
        employeeExplanation: null,
        explainedAt: null,
        cancelledByName: null,
        cancelledAt: null,
        cancelReason: null,
        dispute: null,
        hasPhoto: false,
        actionId: null,
        confirmedAutomatically: false,
        ...overrides,
    };
}

export function makeItem(id: number, violationClass: ViolationClass, categoryId = 1): CatalogItemTO {
    return { id, categoryId, code: `c.${id}`, title: `Item ${id}`, violationClass, points: 1, ttlDays: null, penaltyHours: 0 };
}

export function makeCategory(id: number, items: CatalogItemTO[]): CatalogCategoryTO {
    return { id, code: String(id), name: `Cat ${id}`, correctiveMeasure: null, items };
}

export function makeRecord(overrides: Partial<StaffDisciplineTO> = {}): StaffDisciplineTO {
    return {
        staffId: 7,
        displayName: "Casey",
        score: 90,
        zone: "GREEN",
        violations: [],
        actions: [],
        payCycle: { start: "2026-09-25", end: "2026-10-24" },
        penaltyHoursInCycle: 0,
        capHours: null,
        maxDeductibleHours: null,
        ...overrides,
    };
}
