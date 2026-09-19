import {Helmet} from 'react-helmet-async';
import {DEFAULT_LOCATION} from '../utils/restaurantLocations';

interface SeoHeadProps {
    title: string;
    description: string;
    // Route path only (e.g. "/menu") -- combined with DEFAULT_LOCATION.url for canonical/og:url,
    // so this stays correct if the site is ever promoted off the apex domain.
    path: string;
    image?: string;
    // One JSON-LD object, or several (e.g. Restaurant + Menu on the same page).
    jsonLd?: Record<string, unknown> | Record<string, unknown>[];
    noIndex?: boolean;
    // Search-intent phrase variants (see RestaurantLocation.keywords) -- machine-readable,
    // deliberately kept out of the human-facing title/description to avoid reading as stuffing.
    keywords?: string[];
}

export function SeoHead({title, description, path, image, jsonLd, noIndex, keywords}: SeoHeadProps): JSX.Element {
    const url = `${DEFAULT_LOCATION.url}${path}`;
    const ogImage = image ?? DEFAULT_LOCATION.image;
    const jsonLdEntries = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

    return (
        <Helmet>
            <title>{title}</title>
            <meta name="description" content={description}/>
            {keywords && keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')}/>}
            {noIndex && <meta name="robots" content="noindex, nofollow"/>}
            <link rel="canonical" href={url}/>
            <meta property="og:type" content="website"/>
            <meta property="og:site_name" content={DEFAULT_LOCATION.name}/>
            <meta property="og:title" content={title}/>
            <meta property="og:description" content={description}/>
            <meta property="og:url" content={url}/>
            <meta property="og:image" content={ogImage}/>
            <meta name="twitter:card" content="summary_large_image"/>
            <meta name="twitter:title" content={title}/>
            <meta name="twitter:description" content={description}/>
            <meta name="twitter:image" content={ogImage}/>
            {jsonLdEntries.map((entry, index) => (
                <script key={index} type="application/ld+json">{JSON.stringify(entry)}</script>
            ))}
        </Helmet>
    );
}
