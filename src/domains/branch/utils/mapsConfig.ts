/** Does not exist yet — belongs in `ic-client/.env.local` (plain `.env` is NOT in .gitignore
 * here; only `.env.local`/`.env.*.local` are, so a key placed in `.env` would be committed).
 * CRA inlines every REACT_APP_* var into the public bundle at build time, so this key is visible
 * in the shipped JS regardless of where it is read from — it is protected by Google Cloud
 * Console's HTTP-referrer restrictions, not by secrecy. Do not "fix" this by hiding the key
 * server-side. Mirrors REACT_APP_KEETA_URL in domains/delivery/constants.ts. */
export const GOOGLE_MAPS_API_KEY: string | undefined = process.env.REACT_APP_GOOGLE_MAPS_KEY;

/**
 * Optional. A cloud-styled map, created in Google Cloud Console → Map Management.
 *
 * Not a secret either — it ships in the bundle next to the key, and is meaningless without one.
 *
 * When set, Google serves the style attached to this id and **ignores any `styles` passed in
 * code**, logging a warning if both are supplied. That is why {@link LIGHT_MAP_STYLES} below is
 * applied only when this is absent: the two are alternatives, never a merge.
 */
export const GOOGLE_MAPS_MAP_ID: string | undefined = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;

/**
 * Code-side fallback styling, used only when no Map ID is configured.
 *
 * Light, to sit with the storefront's cream palette (#fbfaf6) rather than fight it.
 *
 * The POI suppression is not decoration. A default Google map draws its own points of interest —
 * museums, shopping centres, landmarks — as coloured, labelled pins, and two branch markers are
 * simply lost among them. Turning POI and transit off leaves streets, water and OUR pins, which is
 * the whole reason the map is on screen.
 */
export const LIGHT_MAP_STYLES: google.maps.MapTypeStyle[] = [
    { elementType: "geometry", stylers: [{ color: "#f4f1ea" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#7c766c" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#f4f1ea" }] },
    // Every POI category off: these are the pins that were drowning ours.
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e7e1d6" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8f887c" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f6e7cf" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe0e8" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
];

/**
 * The branch pin, served from `public/`: a classic map pin whose round head is the IC Pizza badge
 * inside a brand-red ring, with a pointed tip whose apex is the image's bottom-centre — the point
 * BranchMapView anchors on the branch's coordinate.
 *
 * A generated 104x136 asset (2x its 52x68 CSS size) rather than the 4500x4501 source logo — at
 * marker size the original would still decode to a ~80MB bitmap for a 52px head.
 */
export const BRANCH_PIN_URL: string = `${process.env.PUBLIC_URL}/branch-pin.png`;
