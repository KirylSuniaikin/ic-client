import { jest, describe, it, expect, beforeEach, beforeAll } from "@jest/globals";

// Uses the manual mock at __mocks__/client.ts, like management.test.ts and public.test.ts.
jest.mock("./client");

import { authFetch, BASE_URL } from "./client";
import {
    cancelOrder,
    fetchBoardCouriers,
    fetchCourierOrders,
    fetchCourierPeriodStats,
    fetchCouriers,
    fetchDeliveryCards,
    fetchOrderAssignmentAudit,
    fetchOrderProofPhoto,
    fetchOrderRoute,
    fetchOrdersAwaitingCourier,
    fetchPartProofPhoto,
    manualAssign,
    manualAssignPart,
    markHandedOverToCourier,
    markPartHandedOverToCourier,
    releaseOrder,
    releasePart,
} from "./dispatcher";
import { DeliveryApiError } from "../../domains/delivery/types";

/**
 * `dispatcher.ts` was the only module in `shared/api/` with no test at all — every URL it puts on
 * the wire was verified nowhere, because the dispatcher components mock it wholesale. Two of its
 * decisions are load-bearing and invisible from the component side:
 *
 *  - `fetchOrderProofPhoto` answers **null** on a 404, because retention purges the photo after
 *    seven days and "gone" is the normal state for anything older than a week (manual §05);
 *  - `markHandedOverToCourier` deliberately does NOT live under `/api/management/**`, which is
 *    MANAGER-and-up, because the person handing food to a rider is a COOK (manual §02: "Only the
 *    kitchen can press it"). Moving it under `BASE` would 403 every real user of it.
 */

const mockAuthFetch = jest.mocked(authFetch);
const BASE = `${BASE_URL}/management/delivery`;

beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

beforeEach(() => {
    mockAuthFetch.mockReset();
});

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function calledUrl(): string {
    return (mockAuthFetch.mock.calls[0] as [string, RequestInit])[0];
}

function calledInit(): RequestInit {
    return (mockAuthFetch.mock.calls[0] as [string, RequestInit])[1];
}

describe("dispatcher — reads", () => {
    it("lists the roster off the dispatcher prefix", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchCouriers();

        expect(calledUrl()).toBe(`${BASE}/couriers`);
        expect(calledInit().method).toBe("GET");
    });

    it("asks for the queue of orders still waiting for a courier", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchOrdersAwaitingCourier();

        expect(calledUrl()).toBe(`${BASE}/orders/awaiting-courier`);
    });

    it("scopes one courier's orders to that courier", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchCourierOrders("c1");

        expect(calledUrl()).toBe(`${BASE}/couriers/c1/orders`);
    });

    /**
     * The panel always sends both dates so the numbers on screen and the range printed beside them
     * can never describe different windows (manual §03: "always the applied range").
     */
    it("sends both ends of the period the figures are for", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({}));

        await fetchCourierPeriodStats("c1", "2026-09-01", "2026-09-03");

        expect(calledUrl()).toBe(`${BASE}/couriers/c1/stats?from=2026-09-01&to=2026-09-03`);
    });

    it("asks for one order's assignment history by order id", async () => {
        const audit = { orderId: 42, orderCreatedAt: null, dataSince: "2026-10-06T15:00:00", entries: [] };
        mockAuthFetch.mockResolvedValueOnce(json(audit));

        const result = await fetchOrderAssignmentAudit(42);

        expect(calledUrl()).toBe(`${BASE}/orders/42/audit`);
        expect(calledInit().method).toBe("GET");
        expect(result).toEqual(audit);
    });

    it("rejects when the order's history cannot be read", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({}, 404));

        await expect(fetchOrderAssignmentAudit(42)).rejects.toThrow("Response: 404");
    });

    it("asks for one order's route by order id", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({ points: [] }));

        await fetchOrderRoute(42);

        expect(calledUrl()).toBe(`${BASE}/orders/42/route`);
    });

    /** A filter, not a lookup: no branch means the whole board, and an unknown one is an empty list. */
    it("asks for the whole board when no branch is scoped", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchDeliveryCards();

        expect(calledUrl()).toBe(`${BASE}/board/cards`);
    });

    it("url-encodes a scoped branch into the card query", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchDeliveryCards("b 1/2");

        expect(calledUrl()).toBe(`${BASE}/board/cards?branchId=b%201%2F2`);
    });

    /**
     * The link between the two panels: with a card selected every courier row carries the engine's
     * own verdict for THAT order — rank, score, why no offer was made. Without one it is a plain
     * roster, which is what the board opens on.
     */
    it("asks for a plain roster when no card is selected", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchBoardCouriers();

        expect(calledUrl()).toBe(`${BASE}/board/couriers`);
    });

    it("annotates the roster against the selected order", async () => {
        mockAuthFetch.mockResolvedValueOnce(json([]));

        await fetchBoardCouriers(101);

        expect(calledUrl()).toBe(`${BASE}/board/couriers?orderId=101`);
    });

    it("surfaces the status when a read is refused", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 403 }));

        await expect(fetchCouriers()).rejects.toThrow("Response: 403");
    });
});

describe("dispatcher — the proof photo", () => {
    it("returns the bytes rather than a URL, because the endpoint needs the staff token", async () => {
        const bytes = new Blob(["jpeg"], { type: "image/jpeg" });
        mockAuthFetch.mockResolvedValueOnce(new Response(bytes, { status: 200 }));

        const photo = await fetchOrderProofPhoto(42);

        expect(calledUrl()).toBe(`${BASE}/orders/42/proof-photo`);
        expect(photo).toBeInstanceOf(Blob);
    });

    /**
     * Retention deletes the photo after seven days, and plenty of orders were never photographed
     * at all. Both are the NORMAL state, so a 404 must read as "no photo", not as a failure the
     * manager has to interpret.
     */
    it("reads a purged proof photo as absent rather than as a failure", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(fetchOrderProofPhoto(42)).resolves.toBeNull();
    });

    it("still throws on a real failure", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchOrderProofPhoto(42)).rejects.toThrow("Response: 500");
    });
});

describe("dispatcher — writes", () => {
    /**
     * Server-authoritative two-step (courier-capacity, task-spec.md §5): a caller that never
     * mentions `acknowledgeOverCapacity` still has to send it as `false`, not leave it absent, so
     * the endpoint's optional/defaulted-to-false contract is exercised on the wire rather than
     * assumed.
     */
    it("names the courier the manager picked and defaults the acknowledgement to false", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({ assigned: true, warning: null }));

        await manualAssign(99, "c1");

        expect(calledUrl()).toBe(`${BASE}/orders/99/assign`);
        expect(calledInit().method).toBe("POST");
        expect(JSON.parse(calledInit().body as string)).toEqual({
            courierId: "c1",
            acknowledgeOverCapacity: false,
        });
    });

    /** The second half of the two-step: re-sending with the manager's explicit go-ahead. */
    it("carries an explicit acknowledgement through to the request body", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({ assigned: true, warning: { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 } }));

        await manualAssign(99, "c1", true);

        expect(JSON.parse(calledInit().body as string)).toEqual({
            courierId: "c1",
            acknowledgeOverCapacity: true,
        });
    });

    /**
     * The endpoint answers `200 OK` with a body now, not `204 No Content` — the parsed JSON is the
     * caller's only way to see whether the server actually assigned or is holding for a warning.
     */
    it("returns the parsed response body rather than discarding it", async () => {
        const body = { assigned: false, warning: { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 } };
        mockAuthFetch.mockResolvedValueOnce(json(body));

        await expect(manualAssign(99, "c1")).resolves.toEqual(body);
    });

    /** A 409 here is the race in manual §04 edge 7 — someone else claimed the order first. */
    it("surfaces the conflict when another claim won the race", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(manualAssign(99, "c1")).rejects.toThrow("Response: 409");
    });

    it("releases an order back to the engine with no body of its own", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await releaseOrder(43);

        expect(calledUrl()).toBe(`${BASE}/orders/43/release`);
        expect(calledInit().method).toBe("POST");
        expect(calledInit().body).toBeUndefined();
    });

    it("cancels one order by id", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await cancelOrder(43);

        expect(calledUrl()).toBe(`${BASE}/orders/43/cancel`);
        expect(calledInit().method).toBe("POST");
    });
});

describe("dispatcher — the kitchen hand-over", () => {
    /**
     * manual §02: "Only the kitchen can press it: one source of truth, and a rider's stray tap
     * cannot clear a screen." `/api/management/**` is MANAGER-and-up and a COOK does the
     * hand-over, so this endpoint deliberately sits on the kitchen prefix instead. Filing it under
     * `BASE` with the rest of the module would 403 every real user of it, and the failure would
     * only show up on a kitchen tablet.
     */
    it("posts the hand-over on the kitchen path, not the manager one", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await markHandedOverToCourier(77);

        expect(calledUrl()).toBe(`${BASE_URL}/kitchen/delivery/orders/77/handed-over`);
        expect(calledUrl()).not.toContain("/management/");
        expect(calledInit().method).toBe("POST");
    });

    /**
     * Thrown as a DeliveryApiError rather than the module's plain Error precisely so `OrderCard`
     * can tell a 409 ("no courier assigned yet" — an expected state, since a rider can be released
     * between the board being drawn and the button being pressed) apart from everything else and
     * say so in words.
     */
    it("throws a typed error carrying the status, so a 409 can be explained rather than logged", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(markHandedOverToCourier(77)).rejects.toBeInstanceOf(DeliveryApiError);
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));
        await expect(markHandedOverToCourier(77)).rejects.toMatchObject({ status: 409 });
    });

    /** The server is idempotent, so a double tap is a 204 and must not raise. */
    it("treats a repeated hand-over as success", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await expect(markHandedOverToCourier(77)).resolves.toBeUndefined();
    });
});

/**
 * Courier-capacity Phase 5 (task-spec.md §6.3/§11): the part-primary siblings of the order-keyed
 * functions above, mirroring each one's method/URL/body/error contract exactly — the only
 * difference is the path segment (`parts/{partId}` instead of `orders/{orderId}`).
 */
describe("dispatcher — part-primary siblings", () => {
    it("manualAssignPart posts to parts/{partId}/assign with the same body shape as manualAssign", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({ assigned: true, warning: null }));

        await manualAssignPart(501, "c1");

        expect(calledUrl()).toBe(`${BASE}/parts/501/assign`);
        expect(calledInit().method).toBe("POST");
        expect(JSON.parse(calledInit().body as string)).toEqual({
            courierId: "c1",
            acknowledgeOverCapacity: false,
        });
    });

    it("manualAssignPart carries an explicit acknowledgement through, same as manualAssign", async () => {
        mockAuthFetch.mockResolvedValueOnce(json({ assigned: true, warning: null }));

        await manualAssignPart(501, "c1", true);

        expect(JSON.parse(calledInit().body as string)).toEqual({
            courierId: "c1",
            acknowledgeOverCapacity: true,
        });
    });

    it("manualAssignPart returns the parsed response body", async () => {
        const body = { assigned: false, warning: { riderPizzas: 6, orderPizzas: 4, totalPizzas: 10, capacity: 8 } };
        mockAuthFetch.mockResolvedValueOnce(json(body));

        await expect(manualAssignPart(501, "c1")).resolves.toEqual(body);
    });

    it("manualAssignPart surfaces a 409 exactly like manualAssign", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(manualAssignPart(501, "c1")).rejects.toThrow("Response: 409");
    });

    it("releasePart posts to parts/{partId}/release with no body", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await releasePart(501);

        expect(calledUrl()).toBe(`${BASE}/parts/501/release`);
        expect(calledInit().method).toBe("POST");
        expect(calledInit().body).toBeUndefined();
    });

    it("fetchPartProofPhoto returns the bytes on success", async () => {
        const bytes = new Blob(["jpeg"], { type: "image/jpeg" });
        mockAuthFetch.mockResolvedValueOnce(new Response(bytes, { status: 200 }));

        const photo = await fetchPartProofPhoto(501);

        expect(calledUrl()).toBe(`${BASE}/parts/501/proof-photo`);
        expect(photo).toBeInstanceOf(Blob);
    });

    /** Same 404-is-null contract as fetchOrderProofPhoto. */
    it("fetchPartProofPhoto reads a 404 as absent rather than as a failure", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));

        await expect(fetchPartProofPhoto(501)).resolves.toBeNull();
    });

    it("fetchPartProofPhoto still throws on a real failure", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

        await expect(fetchPartProofPhoto(501)).rejects.toThrow("Response: 500");
    });

    it("markPartHandedOverToCourier posts on the kitchen path, not the manager one", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await markPartHandedOverToCourier(501);

        expect(calledUrl()).toBe(`${BASE_URL}/kitchen/delivery/parts/501/handed-over`);
        expect(calledUrl()).not.toContain("/management/");
        expect(calledInit().method).toBe("POST");
    });

    /** Same DeliveryApiError contract as markHandedOverToCourier. */
    it("markPartHandedOverToCourier throws a typed error carrying the status", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(markPartHandedOverToCourier(501)).rejects.toBeInstanceOf(DeliveryApiError);
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));
        await expect(markPartHandedOverToCourier(501)).rejects.toMatchObject({ status: 409 });
    });

    it("markPartHandedOverToCourier sends {courierName} as the JSON body when a name is given", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await markPartHandedOverToCourier(501, "Ali");

        expect(calledInit().body).toBe(JSON.stringify({ courierName: "Ali" }));
    });

    it("markPartHandedOverToCourier sends no body when the name is omitted", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

        await markPartHandedOverToCourier(501);

        expect(calledInit().body).toBeUndefined();
    });

    it("markPartHandedOverToCourier with a name still throws a typed error carrying the 409", async () => {
        mockAuthFetch.mockResolvedValueOnce(new Response(null, { status: 409 }));

        await expect(markPartHandedOverToCourier(501, "Ali")).rejects.toMatchObject({ status: 409 });
    });
});
