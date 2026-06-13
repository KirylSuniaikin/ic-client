export type DoughInventoryAmounts = { S: number; M: number; L: number; Brick: number };

export type DoughType = "S" | "M" | "L" | "Brick";

export interface DoughInventory {
  S: number;
  M: number;
  L: number;
  Brick: number;
}

export type DoughAvailabilityFlags = {
  S: boolean;
  M: boolean;
  L: boolean;
  "Brick dough": boolean;
};

export type DoughStatus = {
  S: number;
  M: number;
  L: number;
  Brick: number;
  availability: DoughAvailabilityFlags;
};

export interface DoughAlert {
  doughType: DoughType;
  currentAmount: number;
}

// Cast to Record<string, unknown> is required to read properties on a narrowed unknown object — standard type guard pattern
export function isDoughAlert(x: unknown): x is DoughAlert {
  if (typeof x !== "object" || x === null) return false;
  if (!("doughType" in x) || !("currentAmount" in x)) return false;
  const obj = x as Record<string, unknown>;
  const validTypes: readonly string[] = ["S", "M", "L", "Brick"];
  return (
    typeof obj.doughType === "string" &&
    validTypes.includes(obj.doughType) &&
    typeof obj.currentAmount === "number"
  );
}
