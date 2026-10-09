// Mirrors backend/.../domain/discipline/** DTO records field for field. Dates and times are ISO
// strings; a LocalDateTime carries no offset and means Bahrain local time.

export type ViolationClass = "A" | "B" | "C" | "D";
export type ViolationStatus = "PENDING_EXPLANATION" | "ACTIVE" | "CANCELLED";
export type ActionLevel = "WRITTEN" | "FINAL" | "TERMINATION" | "TERMINATION_ART107";
export type DisputeOutcome = "UPHELD" | "CANCELLED";
export type DisciplineZone = "GREEN" | "YELLOW" | "ORANGE" | "RED";

// E1 / E19 / E20
export type CatalogItemTO = {
    id: number;
    categoryId: number;
    code: string;
    title: string;
    violationClass: ViolationClass;
    points: number;
    ttlDays: number | null;
    penaltyHours: number;
};
export type CatalogCategoryTO = {
    id: number;
    code: string;
    name: string;
    correctiveMeasure: string | null;
    items: CatalogItemTO[];
};
export type CreateCatalogEntryRequest = {
    categoryId: number;
    title: string;
    violationClass: ViolationClass;
    points: number;
    ttlDays: number | null;
    penaltyHours: number;
};
export type UpdateCatalogEntryRequest = Omit<CreateCatalogEntryRequest, "categoryId" | "title">;

// E21 / E22
export type DisciplineSettingsTO = {
    shadowPilot: boolean;
    updatedAt: string | null;
    updatedByName: string | null;
};
export type UpdateDisciplineSettingsRequest = { shadowPilot: boolean };

// E2
export type RosterScoreTO = { staffId: number; score: number; zone: DisciplineZone };

// E3 / E4 pieces
export type DisputeTO = {
    reason: string;
    disputedAt: string;
    outcome: DisputeOutcome | null;
    resolvedByName: string | null;
    resolvedAt: string | null;
    resolutionNote: string | null;
};
export type ViolationTO = {
    id: number;
    employeeId: number;
    typeId: number;
    code: string;
    title: string;
    categoryName: string;
    violationClass: ViolationClass;
    points: number;
    penaltyHours: number | null; // null when shadowPilot (FR-24), for every viewer
    status: ViolationStatus;
    shadowPilot: boolean;
    issuedAt: string;
    expiresAt: string | null;
    expired: boolean; // ACTIVE and expiresAt <= now
    daysUntilExpiry: number | null; // ceil days; null unless ACTIVE, unexpired, class A-C
    occurredOn: string;
    discoveredOn: string;
    issuedByName: string;
    issuerComment: string;
    activatedAt: string | null;
    confirmedByName: string | null;
    explanationDueAt: string | null;
    employeeExplanation: string | null;
    explainedAt: string | null;
    cancelledByName: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    dispute: DisputeTO | null;
    hasPhoto: boolean;
    actionId: number | null;
    confirmedAutomatically: boolean; // the scheduled job confirmed it because the GM did not act in time
};
export type DisciplinaryActionTO = {
    id: number;
    violationId: number;
    employeeId: number;
    actionLevel: ActionLevel;
    scoreAtTime: number | null;
    shadowPilot: boolean;
    createdAt: string;
    documentAvailable: boolean; // not ART107, not pilot, not voided
    signedAt: string | null;
    signedRecordedByName: string | null;
    refusalRecordedAt: string | null;
    refusalShiftChiefName: string | null;
    refusalGmName: string | null;
    voidedAt: string | null;
};
export type PayCycleTO = { start: string; end: string };
export type StaffDisciplineTO = {
    staffId: number;
    displayName: string;
    score: number;
    zone: DisciplineZone;
    violations: ViolationTO[]; // all statuses, newest issuedAt first; the client splits
    actions: DisciplinaryActionTO[];
    payCycle: PayCycleTO;
    penaltyHoursInCycle: number;
    // null when the shadow pilot is ON (no cap is in force)
    capHours: number | null;
    maxDeductibleHours: number | null;
};

// E6 / E7
export type IssueViolationRequest = {
    violationTypeId: number;
    issuerComment: string; // 1..2000, trimmed
    occurredOn: string; // yyyy-MM-dd
    discoveredOn: string; // yyyy-MM-dd
};
export type IssuePreviewTO = {
    violationTypeId: number;
    code: string;
    title: string;
    violationClass: ViolationClass;
    points: number;
    penaltyHours: number; // catalog snapshot; the UI hides it when shadowPilot
    scoreBefore: number;
    scoreAfter: number;
    zoneBefore: DisciplineZone;
    zoneAfter: DisciplineZone;
    formalAction: ActionLevel | null; // issued on confirmation if pending
    outcomeStatus: "ACTIVE" | "PENDING_EXPLANATION";
    expiresAt: string | null;
    shadowPilot: boolean;
    payCycle: PayCycleTO;
    penaltyHoursInCycle: number;
    // null when the shadow pilot is ON (no cap is in force)
    capHours: number | null;
    maxDeductibleHours: number | null;
};

// E8
export type ViolationPhotoMetaTO = { violationId: number; contentType: string; sizeBytes: number };
// E10, E11, E13, E14
export type ExplanationRequest = { text: string };
export type DisputeRequest = { reason: string };
export type CancelViolationRequest = { reason: string };
export type RejectDisputeRequest = { note: string };
// E17
export type RefusalActRequest = { shiftChiefStaffId: number; gmStaffId: number };

// E5
export type MyWorkSummaryTO = {
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    totalCost: number | null; // OWNER viewer only
    totalSalary: number | null; // OWNER viewer only
};
