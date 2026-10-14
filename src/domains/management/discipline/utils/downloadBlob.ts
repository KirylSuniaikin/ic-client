export function downloadBlob(blob: Blob, filename: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Object URLs are heap that never frees itself; on an all-day tablet shift these add up.
    URL.revokeObjectURL(objectUrl);
}
