export function dateFormatter(sep: string = "-", locale: string = "en"): string {
    const now = new Date();
    const d = new Date(now);

    if (now.getDate() <= 3) {
        d.setMonth(d.getMonth() - 1);
    }

    const mon = new Intl.DateTimeFormat(locale, { month: "short" })
        .format(d);

    const yy = String(d.getFullYear() % 100).padStart(2, "0");

    return [mon, yy].join(sep);
}
