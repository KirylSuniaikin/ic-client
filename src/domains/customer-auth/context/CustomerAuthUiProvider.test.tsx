import { describe, it, expect } from "@jest/globals";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { CustomerAuthUiProvider, useCustomerAuthUi } from "./CustomerAuthUiProvider";

function renderCustomerAuthUi() {
    return renderHook(() => useCustomerAuthUi(), {
        wrapper: ({ children }) => <CustomerAuthUiProvider>{children}</CustomerAuthUiProvider>,
    });
}

describe("CustomerAuthUiProvider", () => {
    it("starts with both popups closed and no prefill", () => {
        const { result } = renderCustomerAuthUi();

        expect(result.current.isLoginOpen).toBe(false);
        expect(result.current.isProfileOpen).toBe(false);
        expect(result.current.loginPrefillPhone).toBeNull();
        expect(result.current.selectedOrderId).toBeNull();
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(false);
    });

    it("openLogin() opens the login popup with no prefill", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openLogin();
        });

        expect(result.current.isLoginOpen).toBe(true);
        expect(result.current.isProfileOpen).toBe(false);
        expect(result.current.loginPrefillPhone).toBeNull();
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(true);
    });

    it("openLogin(phone) opens the login popup with the given prefill", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openLogin("97333607710");
        });

        expect(result.current.isLoginOpen).toBe(true);
        expect(result.current.loginPrefillPhone).toBe("97333607710");
    });

    it("openLogin() closes the profile popup if it was open", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openProfile();
        });
        expect(result.current.isProfileOpen).toBe(true);

        act(() => {
            result.current.openLogin("97333607710");
        });

        expect(result.current.isProfileOpen).toBe(false);
        expect(result.current.isLoginOpen).toBe(true);
        expect(result.current.loginPrefillPhone).toBe("97333607710");
    });

    it("openProfile() opens the profile popup and closes the login popup + clears prefill", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openLogin("97333607710");
        });
        expect(result.current.isLoginOpen).toBe(true);

        act(() => {
            result.current.openProfile();
        });

        expect(result.current.isProfileOpen).toBe(true);
        expect(result.current.isLoginOpen).toBe(false);
        expect(result.current.loginPrefillPhone).toBeNull();
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(true);
    });

    it("closeAll() clears both open-states and the prefill", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openLogin("97333607710");
        });

        act(() => {
            result.current.closeAll();
        });

        expect(result.current.isLoginOpen).toBe(false);
        expect(result.current.isProfileOpen).toBe(false);
        expect(result.current.loginPrefillPhone).toBeNull();
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(false);
    });

    it("openOrderDetail(orderId) opens the profile popup with that order selected", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openOrderDetail(1234);
        });

        expect(result.current.isProfileOpen).toBe(true);
        expect(result.current.isLoginOpen).toBe(false);
        expect(result.current.selectedOrderId).toBe(1234);
    });

    it("closeOrderDetail() keeps the profile open when the detail was opened from within it", () => {
        const { result } = renderCustomerAuthUi();

        // Profile already open, then a history row opens a detail on top of it.
        act(() => {
            result.current.openProfile();
        });
        act(() => {
            result.current.openOrderDetail(1234);
        });

        act(() => {
            result.current.closeOrderDetail();
        });

        expect(result.current.selectedOrderId).toBeNull();
        expect(result.current.isProfileOpen).toBe(true);
    });

    it("closeOrderDetail() also closes the profile when the detail was opened standalone (island/checkout)", () => {
        const { result } = renderCustomerAuthUi();

        // Profile was NOT open — opened directly (e.g. tapping the homepage island).
        act(() => {
            result.current.openOrderDetail(1234);
        });

        act(() => {
            result.current.closeOrderDetail();
        });

        expect(result.current.selectedOrderId).toBeNull();
        expect(result.current.isProfileOpen).toBe(false);
    });

    it("closeAll()/openLogin()/openProfile() also clear selectedOrderId", () => {
        const { result } = renderCustomerAuthUi();

        act(() => {
            result.current.openOrderDetail(1234);
        });
        act(() => {
            result.current.closeAll();
        });
        expect(result.current.selectedOrderId).toBeNull();

        act(() => {
            result.current.openOrderDetail(5678);
        });
        act(() => {
            result.current.openLogin();
        });
        expect(result.current.selectedOrderId).toBeNull();

        act(() => {
            result.current.openOrderDetail(5678);
        });
        act(() => {
            result.current.openProfile();
        });
        expect(result.current.selectedOrderId).toBeNull();
    });

    it("isAnyCustomerAuthPopupOpen reflects isLoginOpen || isProfileOpen", () => {
        const { result } = renderCustomerAuthUi();

        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(false);

        act(() => {
            result.current.openLogin();
        });
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(true);

        act(() => {
            result.current.openProfile();
        });
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(true);

        act(() => {
            result.current.closeAll();
        });
        expect(result.current.isAnyCustomerAuthPopupOpen).toBe(false);
    });
});

describe("useCustomerAuthUi - outside a provider", () => {
    it("throws a typed error when used outside CustomerAuthUiProvider", () => {
        expect(() => renderHook(() => useCustomerAuthUi())).toThrow(
            "useCustomerAuthUi must be used within a CustomerAuthUiProvider"
        );
    });
});
