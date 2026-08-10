// Domain-agnostic image downscale/compress helper for photo uploads (e.g. purchase invoices).
// Sits beside decimalUtils/imageMap — no domain imports here.

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_QUALITY = 0.7;
const OUTPUT_TYPE = "image/jpeg";

// Re-encoding an already-small JPEG only loses quality for no size benefit — skip it.
const SMALL_JPEG_MAX_BYTES = 200 * 1024;

export class ImageCompressionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ImageCompressionError";
    }
}

// Scales the longest edge down to maxEdge, preserving aspect ratio. Never upscales:
// if both edges already fit, the input is returned unchanged (rounded to integers).
// Guards against 0/NaN dimensions (e.g. a source image that failed to decode).
export function computeTargetSize(w: number, h: number, maxEdge: number): { w: number; h: number } {
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        return { w: 0, h: 0 };
    }
    const longestEdge = Math.max(w, h);
    if (longestEdge <= maxEdge) {
        return { w: Math.round(w), h: Math.round(h) };
    }
    const scale = maxEdge / longestEdge;
    return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

// Fallback loader for browsers without createImageBitmap (older iOS Safari).
function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = (): void => resolve(img);
        img.onerror = (): void => reject(new ImageCompressionError("Failed to load image for downscaling"));
        img.src = src;
    });
}

// canvas.toBlob is callback-based and can hand back null — wrap it in a Promise and
// reject with a real Error subclass instead of leaving the caller to handle null.
function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new ImageCompressionError("Canvas failed to produce an image blob"));
                    return;
                }
                resolve(blob);
            },
            OUTPUT_TYPE,
            quality
        );
    });
}

async function drawToBlob(
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    maxEdge: number,
    quality: number
): Promise<Blob> {
    const { w, h } = computeTargetSize(sourceWidth, sourceHeight, maxEdge);
    // A 0-sized canvas makes toBlob fail with a message that blames the canvas rather than
    // the undecodable source it actually came from — name the real cause here instead.
    if (w <= 0 || h <= 0) {
        throw new ImageCompressionError(
            `Image has unusable dimensions (${sourceWidth}x${sourceHeight}) and cannot be compressed`
        );
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new ImageCompressionError("Canvas 2D context is unavailable");
    }
    ctx.drawImage(source, 0, 0, w, h);
    return canvasToBlob(canvas, quality);
}

// Downscales/compresses an image file for upload. Defaults: maxEdge 1600, quality 0.7,
// output image/jpeg (~150-400 KB). Already-small JPEGs are returned untouched.
export async function downscaleImage(file: File, opts?: { maxEdge?: number; quality?: number }): Promise<Blob> {
    const maxEdge = opts?.maxEdge ?? DEFAULT_MAX_EDGE;
    const quality = opts?.quality ?? DEFAULT_QUALITY;

    if (file.type === OUTPUT_TYPE && file.size <= SMALL_JPEG_MAX_BYTES) {
        return file;
    }

    if (typeof createImageBitmap === "function") {
        // WHY: without imageOrientation:'from-image', EXIF orientation is ignored when a
        // bitmap is drawn to a canvas, so portrait photos taken on a phone come out
        // rotated 90 degrees. This only shows up on a real device, never in jsdom.
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        try {
            return await drawToBlob(bitmap, bitmap.width, bitmap.height, maxEdge, quality);
        } finally {
            bitmap.close();
        }
    }

    const objectUrl = URL.createObjectURL(file);
    try {
        const img = await loadImageElement(objectUrl);
        return await drawToBlob(img, img.naturalWidth, img.naturalHeight, maxEdge, quality);
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}
