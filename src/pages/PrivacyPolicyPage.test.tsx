import { jest, describe, it, expect, afterEach } from "@jest/globals";
import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { DELETE_ACCOUNT_SECTION_ID, DELETE_DATA_SECTION_ID, PrivacyPolicyPage, type PrivacyPolicyTab } from "./PrivacyPolicyPage";

const IC_PIZZA_TAB_NAME = "IC Pizza (website, app, kiosk)";
const DELIVERY_TAB_NAME = "Astra Courier (delivery)";

// The page renders nothing that echoes the router's location -- this probe, inside the same
// MemoryRouter, reports where a tab link took it (same idiom as AuthPage.test.tsx).
function LocationProbe(): JSX.Element {
    const location = useLocation();
    return <div data-testid="location-probe" data-pathname={location.pathname} />;
}

// The route-to-tab mapping lives in router.tsx and is covered by router.test.tsx; here the tab is
// pinned so each test exercises one policy, and the probe shows where the links point.
function renderPolicy(tab: PrivacyPolicyTab, initialPath: string) {
    return render(
        <HelmetProvider>
            <MemoryRouter initialEntries={[initialPath]}>
                <PrivacyPolicyPage tab={tab} />
                <LocationProbe />
            </MemoryRouter>
        </HelmetProvider>
    );
}

function currentPath(): string | null {
    return screen.getByTestId("location-probe").getAttribute("data-pathname");
}

function panelText(): string {
    return screen.getByRole("tabpanel").textContent ?? "";
}

// A policy section is the h2 plus everything after it inside the same Box.
function sectionOf(headingName: string): HTMLElement {
    const section = screen.getByRole("heading", { level: 2, name: headingName }).parentElement;
    if (section === null) {
        throw new Error(`No section wraps the heading "${headingName}"`);
    }
    return section;
}

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Seven or more digits, allowing the spaces/dashes a written phone number carries -- long enough
// to skip the policy's own numbers (60 seconds, 500 positions, Building 1284, 2026).
const PHONE_PATTERN = /\+?\d[\d\s-]{5,}\d/g;

function contactDetailsIn(container: HTMLElement): { emails: string[]; phones: string[]; hrefs: string[] } {
    const text = container.textContent ?? "";
    const hrefs = Array.from(container.querySelectorAll("a[href^='mailto:'], a[href^='tel:']"))
        .map(anchor => anchor.getAttribute("href") ?? "");
    return {
        emails: text.match(EMAIL_PATTERN) ?? [],
        phones: text.match(PHONE_PATTERN) ?? [],
        hrefs,
    };
}

describe("PrivacyPolicyPage", () => {
    describe("IC Pizza tab", () => {
        it("shows the existing customer policy, unchanged, with its tab selected", () => {
            renderPolicy("ic-pizza", "/privacy");

            expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
            expect(screen.getByText("Last updated: 26 October 2026")).toBeTruthy();
            expect(screen.getByText(/It covers three products: our website, our customer mobile app/)).toBeTruthy();
            expect(screen.getByRole("heading", { level: 2, name: "10. Changes" })).toBeTruthy();

            const tab = screen.getByRole("tab", { name: IC_PIZZA_TAB_NAME });
            expect(tab.getAttribute("aria-selected")).toBe("true");
            expect(tab.getAttribute("aria-current")).toBe("page");
            expect(screen.getByRole("tab", { name: DELIVERY_TAB_NAME }).getAttribute("aria-selected")).toBe("false");
        });

        it("does not show any of the courier policy", () => {
            renderPolicy("ic-pizza", "/privacy");

            expect(screen.queryByText(/Effective date:/)).toBeNull();
            expect(panelText()).not.toMatch(/Astra Courier is operated by/);
        });

        it("tells an app customer where to delete their account, and gives the section its own id", () => {
            renderPolicy("ic-pizza", "/privacy");

            const section = sectionOf("7. Delete your account");
            expect(section.id).toBe(DELETE_ACCOUNT_SECTION_ID);
            expect(within(section).getByText(/choose/).textContent).toMatch(/tap ••• and choose Delete account/);
            expect(within(sectionOf("6. Your choices")).getByText(/delete your account yourself — see section 7/)).toBeTruthy();
        });

        it("says what an account deletion removes, that marketing stops, and that order records stay", () => {
            renderPolicy("ic-pizza", "/privacy");

            const section = within(sectionOf("7. Delete your account"));
            expect(section.getByText(/your saved delivery addresses and your phone's notification token/)).toBeTruthy();
            expect(section.getByText(/we send you no marketing/)).toBeTruthy();
            expect(section.getByText(/records of the orders you placed/)).toBeTruthy();
        });

        it("discloses the app's foreground-only location, and that app customers' hashed phones go to Meta too", () => {
            renderPolicy("ic-pizza", "/privacy");

            const collected = within(sectionOf("2. What we collect"));
            expect(collected.getByText(/find the branch\s+nearest to you/)).toBeTruthy();
            expect(collected.getByText(/does not\s+read your location in the background/)).toBeTruthy();
            const shared = within(sectionOf("4. Who we share it with"));
            expect(shared.getByText(/phone numbers of customers who ordered on\s+our website, in our mobile app or at a kiosk, in hashed form/)).toBeTruthy();
            expect(shared.queryByText(/never sent to Meta for advertising/)).toBeNull();
        });

        it("tells kiosk customers their phone number may go to Meta, but not what they ordered", () => {
            renderPolicy("ic-pizza", "/privacy");

            expect(within(sectionOf("2. What we collect")).getByText(/phone number you\s+give at a kiosk may be included, in hashed form/)).toBeTruthy();
            expect(within(sectionOf("4. Who we share it with")).getByText(/What you order at a kiosk is never sent to these services/)).toBeTruthy();
        });

        it("keeps its later sections numbered after the new one", () => {
            renderPolicy("ic-pizza", "/privacy");

            expect(screen.getByRole("heading", { level: 2, name: "8. Security" })).toBeTruthy();
            expect(screen.getByRole("heading", { level: 2, name: "9. Children" })).toBeTruthy();
        });
    });

    describe("Astra Courier tab", () => {
        it("shows the courier policy with its own heading, date and tab selected", () => {
            renderPolicy("delivery", "/privacy/delivery");

            expect(screen.getByRole("heading", { level: 1, name: "Astra Courier Privacy Policy" })).toBeTruthy();
            expect(screen.getByText("Effective date: 6 October 2026")).toBeTruthy();
            expect(screen.queryByText(/Last updated:/)).toBeNull();

            const tab = screen.getByRole("tab", { name: DELIVERY_TAB_NAME });
            expect(tab.getAttribute("aria-selected")).toBe("true");
            expect(tab.getAttribute("aria-current")).toBe("page");
            expect(screen.getByRole("tab", { name: IC_PIZZA_TAB_NAME }).getAttribute("aria-current")).toBeNull();
        });

        it("names IC Pizza W.L.L. as the operator and data controller", () => {
            renderPolicy("delivery", "/privacy/delivery");

            expect(panelText()).toMatch(
                /Astra Courier is operated by IC PIZZA W\.L\.L\., .+, for its delivery service, and IC PIZZA W\.L\.L\. \("we", "us"\) is the controller of the personal data described on this tab\./
            );
        });

        it("discloses background location and its cadence", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const text = panelText();
            expect(text).toMatch(/Precise location, including in the background/);
            expect(text).toMatch(/even when the app is closed or not in use/);
            expect(text).toMatch(/from the\s+moment you go online, the app sends your location/);
            expect(text).toMatch(/every 60\s+seconds while you wait for\s+orders, and every 15 seconds while you carry one/);
            expect(text).toMatch(/It stops when you go offline\s+or sign out\./);
        });

        // The server's idle sweep ends the shift without stopping the phone's tracking, so the
        // policy must not promise that "off shift" always means "not sending".
        it("says tracking can outlive a shift the server ended, and that signing out always stops it", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const text = panelText();
            expect(text).toMatch(/no\s+position from you for 30 minutes while you were waiting for orders, the app\s+can keep sending your location until you sign out/);
            expect(text).toMatch(/Signing out always stops it, including after our server has taken you off\s+shift\./);
        });

        it("discloses shift and offer records, who sees them and how long they are kept", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const collected = within(sectionOf("2. What the app collects"));
            expect(collected.getByText(/when you go online and offline/)).toBeTruthy();
            expect(collected.getByText(/declined or\s+let run out/)).toBeTruthy();
            expect(collected.getByText(/when an order was not offered to you, the reason/)).toBeTruthy();

            expect(within(sectionOf("4. Who can see it")).getByText(/your hours on shift and the offers you declined or missed/)).toBeTruthy();
            expect(
                within(sectionOf("5. How long we keep it")).getByText(/kept while your rider account\s+exists, for your hours on shift/)
            ).toBeTruthy();
        });

        it("discloses delivery photos, and that neither the gallery nor the microphone is used", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const text = panelText();
            expect(text).toMatch(/the photo you take at the door with the\s+in-app camera/);
            expect(text).toMatch(/does not read your photo\s+gallery/);
            expect(text).toMatch(/does not use the microphone/);
        });

        it("states that the customer sees the rider's name and live position", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const text = panelText();
            expect(text).toMatch(/they see your name and your live position on a map/);
            expect(text).toMatch(/Your phone number is never shown to\s+them/);
            expect(text).toMatch(/we may\s+show them the delivery photo for their order/);
        });

        it("names the processors that receive rider data", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const text = panelText();
            expect(text).toMatch(/Google Maps/);
            expect(text).toMatch(/Expo, Google Firebase Cloud Messaging/);
            expect(text).toMatch(/Hosting and infrastructure providers/);
        });

        it("names every channel that carries the rider's name or position beyond our own staff", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const shared = within(sectionOf("4. Who can see it"));
            expect(shared.getByText(/Messaging providers \(WhatsApp \/ Meta\)/)).toBeTruthy();
            expect(shared.getByText(/is on its way includes your name/)).toBeTruthy();
            expect(shared.getByText(/order updates to the customer's\s+phone, some of which include your name/)).toBeTruthy();
            expect(shared.getByText(/keeps\s+sending Google your current position and the delivery address to estimate\s+when the order will arrive/)).toBeTruthy();
            expect(shared.getByText(/managers' group on Telegram/)).toBeTruthy();
        });

        it("gives the retention periods the backend enforces", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const retention = within(sectionOf("5. How long we keep it"));
            expect(retention.getByText(/90 days, then deleted automatically/)).toBeTruthy();
            // The courier row's last fix sits outside the 90-day purge of the history table.
            expect(retention.getByText(/most recent position is kept with your rider account until a newer one\s+replaces it/)).toBeTruthy();
            expect(retention.getByText(/7 days after\s+upload/)).toBeTruthy();
            expect(retention.getByText(/7 to 14 days/)).toBeTruthy();
        });

        // Google Play's data-safety form opens this section by URL and checks three things on it:
        // the app's name, step-by-step deletion instructions, and what is deleted versus kept.
        it("explains how a rider gets their data deleted, what is deleted and what is kept", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const deletion = sectionOf("7. Delete your data");
            expect(deletion.id).toBe(DELETE_DATA_SECTION_ID);
            const scoped = within(deletion);
            expect(scoped.getByText(/delete your Astra Courier account/)).toBeTruthy();
            expect(within(deletion.querySelector("ol") as HTMLElement).getAllByRole("listitem")).toHaveLength(3);
            expect(scoped.getByText(/Astra Courier - delete my data/)).toBeTruthy();
            expect(scoped.getByText(/full name and the phone number of your rider account/)).toBeTruthy();
            expect(scoped.getByText(/complete the deletion within 30 days/)).toBeTruthy();
            expect(scoped.getByText(/your location history and your last known position/)).toBeTruthy();
            expect(scoped.getByText(/accounting and tax/)).toBeTruthy();
            expect(scoped.getByText(/with your name removed/)).toBeTruthy();
        });

        it("points the choices section at the deletion steps", () => {
            renderPolicy("delivery", "/privacy/delivery");

            const link = within(sectionOf("6. Your choices")).getByRole("link", { name: "Delete your data" });
            expect(link.getAttribute("href")).toBe("/privacy/delivery/delete-data");
        });

        it("keeps its later sections numbered after the new one", () => {
            renderPolicy("delivery", "/privacy/delivery");

            ["8. Security", "9. Children", "10. Changes"].forEach(name =>
                expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy());
        });

        it("adds no email address or phone number the IC Pizza tab does not already give", () => {
            const delivery = renderPolicy("delivery", "/privacy/delivery");
            const deliveryContacts = contactDetailsIn(delivery.container);
            delivery.unmount();

            const icPizza = renderPolicy("ic-pizza", "/privacy");
            const icPizzaContacts = contactDetailsIn(icPizza.container);

            // The rider still needs a way to reach us -- the existing address, not a new one.
            expect(deliveryContacts.emails).toContain("andrew@ic-pizza.com");
            deliveryContacts.emails.forEach(email => expect(icPizzaContacts.emails).toContain(email));
            deliveryContacts.phones.forEach(phone => expect(icPizzaContacts.phones).toContain(phone));
            deliveryContacts.hrefs.forEach(href => expect(icPizzaContacts.hrefs).toContain(href));
        });
    });

    describe("tabs", () => {
        it("are links to each policy's own URL", () => {
            renderPolicy("ic-pizza", "/privacy");

            expect(screen.getByRole("tab", { name: IC_PIZZA_TAB_NAME }).getAttribute("href")).toBe("/privacy");
            expect(screen.getByRole("tab", { name: DELIVERY_TAB_NAME }).getAttribute("href")).toBe("/privacy/delivery");
        });

        it("change the URL to the courier policy when its tab is clicked", () => {
            renderPolicy("ic-pizza", "/privacy");

            fireEvent.click(screen.getByRole("tab", { name: DELIVERY_TAB_NAME }));

            expect(currentPath()).toBe("/privacy/delivery");
        });

        it("change the URL back to /privacy when the IC Pizza tab is clicked", () => {
            renderPolicy("delivery", "/privacy/delivery");

            fireEvent.click(screen.getByRole("tab", { name: IC_PIZZA_TAB_NAME }));

            expect(currentPath()).toBe("/privacy");
        });

        it("can be reached and followed with the keyboard alone", () => {
            renderPolicy("ic-pizza", "/privacy");

            // Roving tab index: Tab lands on the selected tab, arrows move between tabs.
            userEvent.tab();
            expect(document.activeElement).toBe(screen.getByRole("tab", { name: IC_PIZZA_TAB_NAME }));

            userEvent.keyboard("{ArrowRight}");
            expect(document.activeElement).toBe(screen.getByRole("tab", { name: DELIVERY_TAB_NAME }));

            userEvent.keyboard("{Enter}");
            expect(currentPath()).toBe("/privacy/delivery");
        });

        it("label the panel with the selected tab", () => {
            renderPolicy("delivery", "/privacy/delivery");

            expect(screen.getByRole("tabpanel", { name: DELIVERY_TAB_NAME })).toBeTruthy();
        });
    });

    describe("page title and meta", () => {
        function metaContent(selector: string): string | null | undefined {
            return document.head.querySelector(selector)?.getAttribute("content");
        }

        it("describe the IC Pizza policy on /privacy", async () => {
            renderPolicy("ic-pizza", "/privacy");

            await waitFor(() => expect(document.title).toBe("Privacy Policy | IC Pizza"));
            expect(metaContent("meta[name='description']")).toMatch(/website, mobile app and kiosk terminals/);
            expect(document.head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe("https://ic-pizza.com/privacy");
        });

        it("describe the courier policy on /privacy/delivery", async () => {
            renderPolicy("delivery", "/privacy/delivery");

            await waitFor(() => expect(document.title).toBe("Astra Courier Privacy Policy | IC Pizza"));
            expect(metaContent("meta[name='description']")).toMatch(/Astra Courier app/);
            expect(metaContent("meta[property='og:title']")).toBe("Astra Courier Privacy Policy | IC Pizza");
            expect(document.head.querySelector("link[rel='canonical']")?.getAttribute("href")).toBe("https://ic-pizza.com/privacy/delivery");
        });
    });
});

describe("PrivacyPolicyPage focusSectionId", () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;

    afterEach(() => {
        Element.prototype.scrollIntoView = originalScrollIntoView;
    });

    it("scrolls the named section into view when the page opens", () => {
        const scrolled: Element[] = [];
        // jsdom implements no scrolling; record which element was asked to scroll instead.
        Element.prototype.scrollIntoView = jest.fn(function (this: Element) {
            scrolled.push(this);
        }) as unknown as typeof Element.prototype.scrollIntoView;

        render(
            <HelmetProvider>
                <MemoryRouter initialEntries={["/privacy/delivery/delete-data"]}>
                    <PrivacyPolicyPage tab="delivery" focusSectionId={DELETE_DATA_SECTION_ID} />
                </MemoryRouter>
            </HelmetProvider>
        );

        expect(scrolled.map(element => element.id)).toEqual([DELETE_DATA_SECTION_ID]);
    });

    it("scrolls nowhere when no section is named", () => {
        const scrollIntoView = jest.fn();
        Element.prototype.scrollIntoView = scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;

        renderPolicy("delivery", "/privacy/delivery");

        expect(scrollIntoView).not.toHaveBeenCalled();
    });
});
