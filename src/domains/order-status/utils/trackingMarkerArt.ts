// The courier tracking map's two markers: a top-down moped with its rider, and the customer's
// home. Both come from one generated artwork set shared with the mobile app (PNG there), so the
// geometry below is copied verbatim from its master SVGs and must not be hand-edited — change the
// generator and re-copy instead. Only the brand red is interpolated, from the theme.
import { BRAND_RED } from "../../../shared/utils/theme";
import { iconAngleOf } from "./heading";

// Artwork palette (moped-art README). These are not UI colours, so they have no theme tokens.
const TYRE = "#4A4A4F";
const RIDER = "#7A7570";
const HELMET = "#3b352c";
const VISOR = "#DCE8EE";
const HEADLAMP = "#FFF3CC";
const OUTLINE = "#FFFFFF";

/** CSS pixels. The canvas centre is the GPS point AND the rotation pivot. */
export const MOPED_ICON_SIZE = 40;

export const HOME_ICON_WIDTH = 32;
export const HOME_ICON_HEIGHT = 42;

// The silhouette every layer of the moped repeats: the shadow and the white outline are this same
// shape stroked wide, which is what keeps them centred on the pivot at any angle.
const SILHOUETTE = `
    <rect x="18.2" y="27.6" width="3.6" height="8.4" rx="1.8"/>
    <rect x="18.4" y="4" width="3.2" height="8" rx="1.6"/>
    <path d="M 20 7.2 C 22.3 7.2 23.3 8.4 23.3 10.6 L 23.5 16.4 C 23.6 18.2 26.2 19.6 26.2 24 C 26.2 29.6 23.6 32.6 20 32.6 C 16.4 32.6 13.8 29.6 13.8 24 C 13.8 19.6 16.4 18.2 16.5 16.4 L 16.7 10.6 C 16.7 8.4 17.7 7.2 20 7.2 Z"/>
    <rect x="12.6" y="11.3" width="14.8" height="2.2" rx="1.1"/>`;

function silhouetteArms(stroke: string): string {
    return `
    <line x1="16" y1="23.2" x2="13.7" y2="18" stroke="${stroke}" stroke-width="5.2" stroke-linecap="round"/>
    <line x1="13.7" y1="18" x2="14.4" y2="12.4" stroke="${stroke}" stroke-width="5.2" stroke-linecap="round"/>
    <line x1="24" y1="23.2" x2="26.3" y2="18" stroke="${stroke}" stroke-width="5.2" stroke-linecap="round"/>
    <line x1="26.3" y1="18" x2="25.6" y2="12.4" stroke="${stroke}" stroke-width="5.2" stroke-linecap="round"/>
    <rect x="14.6" y="21.8" width="10.8" height="5.2" rx="2.6"/>`;
}

// The moped's three top-level groups (shadow, outline, vehicle), nose pointing up = north.
const MOPED_LAYERS = `
  <g filter="url(#moped-shadow)" opacity="0.28" fill="#000" stroke="#000" stroke-width="3" stroke-linejoin="round">${SILHOUETTE}${silhouetteArms("#000")}
  </g>
  <g fill="${OUTLINE}" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round">${SILHOUETTE}${silhouetteArms(OUTLINE)}
  </g>
  <g>
    <rect x="18.2" y="27.6" width="3.6" height="8.4" rx="1.8" fill="${TYRE}"/>
    <rect x="18.4" y="4" width="3.2" height="8" rx="1.6" fill="${TYRE}"/>
    <path d="M 20 7.2 C 22.3 7.2 23.3 8.4 23.3 10.6 L 23.5 16.4 C 23.6 18.2 26.2 19.6 26.2 24 C 26.2 29.6 23.6 32.6 20 32.6 C 16.4 32.6 13.8 29.6 13.8 24 C 13.8 19.6 16.4 18.2 16.5 16.4 L 16.7 10.6 C 16.7 8.4 17.7 7.2 20 7.2 Z" fill="${BRAND_RED}"/>
    <rect x="12.6" y="11.3" width="14.8" height="2.2" rx="1.1" fill="${TYRE}"/>
    <ellipse cx="20" cy="12.3" rx="2.6" ry="2" fill="${BRAND_RED}"/>
    <ellipse cx="20" cy="8.5" rx="1.5" ry="0.85" fill="${HEADLAMP}"/>
    <line x1="16" y1="23.2" x2="13.7" y2="18" stroke="${RIDER}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="13.7" y1="18" x2="14.4" y2="12.4" stroke="${RIDER}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="24" y1="23.2" x2="26.3" y2="18" stroke="${RIDER}" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="26.3" y1="18" x2="25.6" y2="12.4" stroke="${RIDER}" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="14.6" y="21.8" width="10.8" height="5.2" rx="2.6" fill="${RIDER}"/>
    <circle cx="20" cy="21.2" r="3.9" fill="${HELMET}"/>
    <path d="M 16.96 19.78 C 17.51 18.6 18.7 17.85 20 17.85 C 21.3 17.85 22.49 18.6 23.04 19.78 Q 20 18.9 16.96 19.78 Z" fill="${VISOR}"/>
  </g>`;

const HOME_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
  <path d="M 9.3 28.9 Q 14.2 33.5 16 42 Q 17.8 33.5 22.7 28.9 Z" fill="${BRAND_RED}"/>
  <circle cx="16" cy="15.5" r="15" fill="${BRAND_RED}"/>
  <circle cx="16" cy="15.5" r="12.4" fill="#FFFFFF"/>
  <path d="M 16 7.6 L 24 14.6 L 21.6 14.6 L 21.6 22.2 Q 21.6 23 20.8 23 L 11.2 23 Q 10.4 23 10.4 22.2 L 10.4 14.6 L 8 14.6 Z" fill="${BRAND_RED}"/>
  <rect x="14.3" y="17.4" width="3.4" height="6.6" rx="0.9" fill="#FFFFFF"/>
</svg>`;

function toDataUrl(svg: string): string {
    // Whitespace between tags is pure weight in a URL that is rebuilt per heading.
    const compact = svg.replace(/>\s+</g, "><").trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(compact)}`;
}

function mopedSvg(angle: number): string {
    // The legacy google.maps.Marker cannot rotate an image icon, so the rotation is drawn into
    // the image itself, about the pivot. The art stays inside the circle inscribed in the canvas,
    // so no angle clips it.
    return `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
  <defs>
    <filter id="moped-shadow" filterUnits="userSpaceOnUse" x="0" y="0" width="40" height="40">
      <feGaussianBlur stdDeviation="1"/>
    </filter>
  </defs>
  <g transform="rotate(${angle} 20 20)">${MOPED_LAYERS}
  </g>
</svg>`;
}

// At most 360 entries (one per whole degree), and in practice the handful of headings one ride
// passes through. Re-using the identical URL for a heading seen before is what lets the browser
// serve the decoded image from its cache instead of decoding a new one mid-turn.
const mopedUrlCache = new Map<number, string>();

/** The moped icon turned to `degrees` (clockwise from north), as an SVG data URL. */
export function mopedIconUrl(degrees: number): string {
    const angle = iconAngleOf(degrees);
    const cached = mopedUrlCache.get(angle);
    if (cached !== undefined) return cached;
    const url = toDataUrl(mopedSvg(angle));
    mopedUrlCache.set(angle, url);
    return url;
}

/** The home marker. It never rotates; its anchor is the pointer tip at the bottom centre. */
export const HOME_ICON_URL: string = toDataUrl(HOME_SVG);
