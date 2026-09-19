import { describe, it, expect } from "@jest/globals";
import type { MenuItem } from "../../domains/menu/types";
import type { RestaurantLocation } from "./restaurantLocations";
import { buildRestaurantJsonLd, buildMenuJsonLd } from "./structuredData";

const LOCATION: RestaurantLocation = {
    slug: "al-hidd",
    name: "IC Pizza Al Hidd",
    legalName: "IC PIZZA W.L.L.",
    tagline: "Detroit & Brooklyn style pizza, 48-hour cold-fermented dough, San Marzano tomatoes",
    cuisines: ["Detroit-style Pizza", "Brooklyn-style Pizza", "Pizza"],
    streetAddress: "Road 114, Block 101, Building 1284R",
    addressLocality: "Al Hidd",
    addressCountry: "BH",
    telephone: "+973 3360 7710",
    url: "https://ic-pizza.com",
    image: "https://ic-pizza.com/logo512.png",
    openingHours: [
        { dayOfWeek: "Friday", opens: "16:30", closes: "01:30" },
        { dayOfWeek: "Saturday", opens: "15:00", closes: "00:00" },
    ],
};

const makeItem = (overrides: Partial<MenuItem> = {}): MenuItem => ({
    available: true,
    category: "Pizzas",
    description: "Classic",
    id: 1,
    is_best_seller: false,
    name: "Margherita",
    photo: "margherita.png",
    price: 3.5,
    size: "M",
    ...overrides,
});

describe("buildRestaurantJsonLd", () => {
    it("maps the location's contact/address fields onto a schema.org Restaurant", () => {
        const jsonLd = buildRestaurantJsonLd(LOCATION);

        expect(jsonLd).toMatchObject({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            name: "IC Pizza Al Hidd",
            telephone: "+973 3360 7710",
            description: "Detroit & Brooklyn style pizza, 48-hour cold-fermented dough, San Marzano tomatoes",
            servesCuisine: ["Detroit-style Pizza", "Brooklyn-style Pizza", "Pizza"],
            address: {
                "@type": "PostalAddress",
                streetAddress: "Road 114, Block 101, Building 1284R",
                addressLocality: "Al Hidd",
                addressCountry: "BH",
            },
            hasMenu: "https://ic-pizza.com/menu",
        });
    });

    it("carries one OpeningHoursSpecification per entry, closes past midnight included as-is", () => {
        const jsonLd = buildRestaurantJsonLd(LOCATION);

        expect(jsonLd.openingHoursSpecification).toEqual([
            {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "https://schema.org/Friday",
                opens: "16:30",
                closes: "01:30",
            },
            {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: "https://schema.org/Saturday",
                opens: "15:00",
                closes: "00:00",
            },
        ]);
    });
});

describe("buildMenuJsonLd", () => {
    it("groups available items into MenuSections by category", () => {
        const jsonLd = buildMenuJsonLd(
            [
                makeItem({ id: 1, name: "Margherita", category: "Pizzas" }),
                makeItem({ id: 2, name: "Pepperoni", category: "Pizzas" }),
                makeItem({ id: 3, name: "Cola", category: "Beverages" }),
            ],
            LOCATION
        );

        expect(jsonLd["@type"]).toBe("Menu");
        expect(jsonLd.hasMenuSection).toEqual([
            expect.objectContaining({ name: "Pizzas", hasMenuItem: expect.arrayContaining([
                expect.objectContaining({ name: "Margherita" }),
                expect.objectContaining({ name: "Pepperoni" }),
            ]) }),
            expect.objectContaining({ name: "Beverages", hasMenuItem: [expect.objectContaining({ name: "Cola" })] }),
        ]);
    });

    it("excludes unavailable items", () => {
        const jsonLd = buildMenuJsonLd(
            [
                makeItem({ id: 1, name: "Margherita", available: true }),
                makeItem({ id: 2, name: "Sold Out Special", available: false }),
            ],
            LOCATION
        );

        const sections = jsonLd.hasMenuSection as Array<{ hasMenuItem: Array<{ name: string }> }>;
        const names = sections.flatMap(section => section.hasMenuItem.map(item => item.name));
        expect(names).toEqual(["Margherita"]);
    });

    it("prices each MenuItem as a BHD Offer", () => {
        const jsonLd = buildMenuJsonLd([makeItem({ price: 3.5 })], LOCATION);

        const sections = jsonLd.hasMenuSection as Array<{ hasMenuItem: Array<{ offers: Record<string, unknown> }> }>;
        expect(sections[0].hasMenuItem[0].offers).toEqual({
            "@type": "Offer",
            price: 3.5,
            priceCurrency: "BHD",
        });
    });
});
