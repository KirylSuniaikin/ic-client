import type {MenuItem} from '../../domains/menu/types';
import type {RestaurantLocation} from './restaurantLocations';

// Bahrain-only today; there is no other currency anywhere in the ordering flow
// (see the "currency" key in shared/i18n/locales/*/common.json, also "BHD").
const PRICE_CURRENCY = 'BHD';

export function buildRestaurantJsonLd(location: RestaurantLocation): Record<string, unknown> {
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

// Mirrors whatever useMenuData actually fetched, grouped the same way the page displays it
// (by category), so the structured data never drifts from what the customer sees.
export function buildMenuJsonLd(menuData: MenuItem[], location: RestaurantLocation): Record<string, unknown> {
    const byCategory = new Map<string, MenuItem[]>();
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
                    priceCurrency: PRICE_CURRENCY,
                },
            })),
        })),
    };
}
