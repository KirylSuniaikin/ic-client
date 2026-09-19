// Public-facing business info for meta tags / Schema.org structured data. This is frontend-only
// and separate from `BaseAppInfoResponse.workingHours` (the runtime schedule shown in-app): the
// backend's branch info (IBranch, from shared/api/management) is behind admin auth and carries no
// address/phone, so there is nothing to fetch this from today.
export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type OpeningHours = {
    dayOfWeek: DayOfWeek;
    opens: string; // "HH:mm"
    // May be numerically earlier than `opens` for hours that run past midnight (e.g. 16:30-01:30);
    // schema.org's OpeningHoursSpecification treats that as "closes the next day", so no split needed.
    closes: string;
};

export type RestaurantLocation = {
    slug: string;
    name: string;
    legalName: string;
    // Short USP line -- what actually differentiates this branch from the "best pizza in
    // Bahrain" / "NY-style" / "Neapolitan" crowd competitors already own. Feeds the meta
    // description, the page's (visually-hidden) H1, and the JSON-LD `description`/`slogan`.
    tagline: string;
    // Cuisine/style keywords for JSON-LD `servesCuisine`, most specific first.
    cuisines: string[];
    // Broader search-intent phrases for the JSON-LD/meta `keywords` field. This is structured
    // data for machines, not visible copy, so it's the right place for phrase variants (e.g.
    // "fermentation" alongside "48-hour cold-fermented dough") that would read as keyword
    // stuffing if crammed into the title/description instead.
    keywords: string[];
    streetAddress: string;
    addressLocality: string;
    addressCountry: string; // ISO 3166-1 alpha-2
    telephone: string;
    url: string;
    image: string;
    openingHours: OpeningHours[];
};

export const AL_HIDD_LOCATION: RestaurantLocation = {
    slug: 'al-hidd',
    name: 'IC Pizza Al Hidd',
    legalName: 'IC PIZZA W.L.L.',
    tagline: 'Detroit & Brooklyn style pizza, 48-hour cold-fermented dough, San Marzano tomatoes',
    cuisines: ['Detroit-style Pizza', 'Brooklyn-style Pizza', 'Pizza'],
    keywords: [
        'Detroit style pizza Bahrain',
        'Brooklyn style pizza Bahrain',
        'baguette pizza Bahrain',
        'cold fermented dough pizza Bahrain',
        '48 hour fermented pizza dough',
        'cold fermentation pizza',
        'San Marzano tomatoes pizza',
        'artisan pizza Bahrain',
        'pizza pickup Bahrain',
        'self-order pizza kiosk Bahrain',
        'pizza Al Hidd',
        'pizza delivery Al Hidd',
    ],
    streetAddress: 'Road 114, Block 101, Building 1284R',
    addressLocality: 'Al Hidd',
    addressCountry: 'BH',
    telephone: '+973 3360 7710',
    url: 'https://ic-pizza.com',
    image: 'https://ic-pizza.com/logo512.png',
    openingHours: [
        {dayOfWeek: 'Friday', opens: '16:30', closes: '01:30'},
        {dayOfWeek: 'Saturday', opens: '15:00', closes: '00:00'},
        {dayOfWeek: 'Sunday', opens: '15:00', closes: '00:00'},
        {dayOfWeek: 'Monday', opens: '15:00', closes: '00:00'},
        {dayOfWeek: 'Tuesday', opens: '15:00', closes: '00:00'},
        {dayOfWeek: 'Wednesday', opens: '15:00', closes: '00:00'},
        {dayOfWeek: 'Thursday', opens: '16:30', closes: '01:30'},
    ],
};

// Single branch today, and nothing in the frontend currently keys a route off a branch for
// customers (DEFAULT_BRANCH_ID in shared/api/client.ts is the only per-branch selector, and it's
// a UUID with no public address/phone attached to it). Adding a second branch to this file alone
// is not enough to get it its own SEO identity — see the project notes on multi-branch SEO.
export const DEFAULT_LOCATION: RestaurantLocation = AL_HIDD_LOCATION;
