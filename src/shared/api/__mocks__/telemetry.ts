import { jest } from "@jest/globals";
import type { ClientErrorPayload } from "../telemetry";

// Manual mock for shared/api/telemetry.ts.
// Exports only the function used by other domains' hooks/components (ST5/ST6).
export const reportClientError = jest.fn<Promise<void>, [ClientErrorPayload]>();
