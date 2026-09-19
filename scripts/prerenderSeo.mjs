// Runs as `postbuild` (see package.json), after `react-scripts build`. Writes real per-route
// <title>/meta/OG/JSON-LD tags directly into the built static HTML -- no headless browser.
//
// This replaced a react-snap (Puppeteer) prerender step for two independent reasons:
//   1. react-snap's bundled Chromium cannot launch on Vercel's build container -- it's missing
//      shared libraries (libnss3.so and others) that there is no way to apt-get install there.
//   2. Even where Chromium *can* launch, api.ic-pizza.com's CORS policy rejects a browser
//      request made from the build's localhost origin, so a browser-driven crawl never actually
//      captured live menu data anyway.
// A plain Node `fetch()` is not a browser and is not subject to CORS at all, which is what makes
// this simpler AND more reliable than getting Puppeteer running in a locked-down build image.
//
// This intentionally duplicates (does not import) a few things that only exist as TS/JSX, since
// this file runs directly under plain Node, outside the CRA/webpack/TS toolchain. Keep these in
// sync by hand if any of them change:
//   - src/shared/utils/restaurantLocations.ts   (business info)
//   - src/shared/utils/structuredData.ts        (JSON-LD builders)
//   - src/shared/components/SeoHead.tsx         (tag shape)
//   - src/pages/HomePage.tsx / PrivacyPolicyPage.tsx (title/description copy)
// None of those files change: react-helmet-async still drives the tags client-side after
// hydration for every real visitor and any crawler that executes JS. This script only covers
// the raw HTML a non-JS crawler (or the very first paint) sees.

import {readFile, writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

const BUILD_DIR = path.resolve(process.cwd(), 'build');
const SITE_URL = 'https://ic-pizza.com';
const API_BASE_URL = 'https://api.ic-pizza.com/api';
const DEFAULT_BRANCH_ID = '2e8c35f7-d75e-4442-b496-cbb929842c10';

const LOCATION = {
    name: 'IC Pizza Al Hidd',
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
    legalName: 'IC PIZZA W.L.L.',
    url: SITE_URL,
    image: `${SITE_URL}/logo512.png`,
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

function buildRestaurantJsonLd(location) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Restaurant',
        name: location.name,
        legalName: location.legalName,
        description: location.tagline,
        slogan: location.tagline,
        image: location.image,
        url: location.url,
        telephone: location.telephone,
        servesCuisine: location.cuisines,
        // schema.org's `keywords` is typed as a single Text value, not a list -- comma-joined,
        // per the common convention (schema.org/keywords).
        keywords: location.keywords.join(', '),
        priceRange: '$$',
        address: {
            '@type': 'PostalAddress',
            streetAddress: location.streetAddress,
            addressLocality: location.addressLocality,
            addressCountry: location.addressCountry,
        },
        openingHoursSpecification: location.openingHours.map(hours => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: `https://schema.org/${hours.dayOfWeek}`,
            opens: hours.opens,
            closes: hours.closes,
        })),
        hasMenu: `${location.url}/menu`,
        acceptsReservations: false,
    };
}

function buildMenuJsonLd(menuData, location) {
    const byCategory = new Map();
    menuData.filter(item => item.available).forEach(item => {
        const items = byCategory.get(item.category) ?? [];
        items.push(item);
        byCategory.set(item.category, items);
    });

    return {
        '@context': 'https://schema.org',
        '@type': 'Menu',
        name: `${location.name} Menu`,
        hasMenuSection: Array.from(byCategory.entries()).map(([category, items]) => ({
            '@type': 'MenuSection',
            name: category,
            hasMenuItem: items.map(item => ({
                '@type': 'MenuItem',
                name: item.name,
                description: item.description || undefined,
                offers: {
                    '@type': 'Offer',
                    price: item.price,
                    priceCurrency: 'BHD',
                },
            })),
        })),
    };
}

function escapeHtml(value) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHeadTags({title, description, urlPath, jsonLd, keywords}) {
    const url = `${SITE_URL}${urlPath}`;
    const t = escapeHtml(title);
    const d = escapeHtml(description);
    return [
        `<title>${t}</title>`,
        `<meta name="description" content="${d}">`,
        ...(keywords && keywords.length > 0 ? [`<meta name="keywords" content="${escapeHtml(keywords.join(', '))}">`] : []),
        `<link rel="canonical" href="${url}">`,
        '<meta property="og:type" content="website">',
        `<meta property="og:site_name" content="${escapeHtml(LOCATION.name)}">`,
        `<meta property="og:title" content="${t}">`,
        `<meta property="og:description" content="${d}">`,
        `<meta property="og:url" content="${url}">`,
        `<meta property="og:image" content="${LOCATION.image}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<meta name="twitter:title" content="${t}">`,
        `<meta name="twitter:description" content="${d}">`,
        `<meta name="twitter:image" content="${LOCATION.image}">`,
        ...jsonLd.map(entry => `<script type="application/ld+json">${JSON.stringify(entry)}</script>`),
    ].join('\n    ');
}

async function fetchMenuData() {
    try {
        const res = await fetch(`${API_BASE_URL}/get_base_app_info?branchId=${DEFAULT_BRANCH_ID}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data.menu) ? data.menu : [];
    } catch (err) {
        // Never fail the build over this -- title/meta/OG/Restaurant JSON-LD (the primary ask)
        // don't depend on it. Only the bonus Menu JSON-LD is skipped.
        console.warn(`⚠️  prerenderSeo: could not fetch live menu data (${err.message}); Menu JSON-LD omitted for this build.`);
        return [];
    }
}

// Matches by attribute substring rather than exact tag string, so it survives CRA's production
// HTML minifier reordering/reformatting attributes (verified against the real build output).
const TAG_PATTERNS = [
    /<title>[\s\S]*?<\/title>/,
    /<meta[^>]*\bname=["']description["'][^>]*>/,
    /<meta[^>]*\bname=["']keywords["'][^>]*>/,
    /<link[^>]*\brel=["']canonical["'][^>]*>/,
    /<meta[^>]*\bproperty=["']og:[a-z_]+["'][^>]*>/g,
    /<meta[^>]*\bname=["']twitter:[a-z]+["'][^>]*>/g,
];

async function writeRoute(template, urlPath, outputRelativePath, routeTags) {
    let html = template;
    for (const pattern of TAG_PATTERNS) html = html.replace(pattern, '');
    html = html.replace('</head>', `    ${routeTags}\n  </head>`);

    const outputPath = path.join(BUILD_DIR, outputRelativePath);
    await mkdir(path.dirname(outputPath), {recursive: true});
    await writeFile(outputPath, html);
    console.log(`✅  wrote ${outputRelativePath}`);
}

async function main() {
    const template = await readFile(path.join(BUILD_DIR, 'index.html'), 'utf8');
    const menuData = await fetchMenuData();

    const jsonLd = [buildRestaurantJsonLd(LOCATION)];
    if (menuData.length > 0) jsonLd.push(buildMenuJsonLd(menuData, LOCATION));

    const menuTags = renderHeadTags({
        title: `${LOCATION.name} — Detroit & Brooklyn Style Pizza | Order Online, Bahrain`,
        description: `${LOCATION.tagline}. Order online for pickup or delivery in ${LOCATION.addressLocality}, Bahrain. Call ${LOCATION.telephone}.`,
        urlPath: '/menu',
        jsonLd,
        keywords: LOCATION.keywords,
    });
    await writeRoute(template, '/menu', 'menu/index.html', menuTags);
    // "/" redirects client-side to "/menu" (see src/app/router.tsx) -- same tags, so a crawler
    // landing on the bare domain sees the real page instead of CRA's generic build defaults.
    await writeRoute(template, '/', 'index.html', menuTags);

    const privacyTags = renderHeadTags({
        title: 'Privacy Policy | IC Pizza',
        description: 'How IC Pizza collects, uses and protects your personal data across our website, mobile app and kiosk terminals.',
        urlPath: '/privacy',
        jsonLd: [],
    });
    await writeRoute(template, '/privacy', 'privacy/index.html', privacyTags);
}

main().catch(err => {
    console.error('prerenderSeo failed:', err);
    process.exit(1);
});
