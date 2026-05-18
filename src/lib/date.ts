const pad2 = (value: number): string => String(value).padStart(2, "0");

export function formatDisplayDate(value: unknown, fallback = "-"): string {
    if (value === null || value === undefined || value === "") return fallback;

    const raw = String(value).trim();
    if (!raw || raw === "N/A" || raw === "undefined" || raw === "-") return fallback;

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    const day = pad2(parsed.getDate());
    const month = pad2(parsed.getMonth() + 1);
    const year = parsed.getFullYear();

    return `${day}-${month}-${year}`;
}

export function formatDisplayDateTime(value: unknown, fallback = "-"): string {
    const datePart = formatDisplayDate(value, fallback);
    if (datePart === fallback) return fallback;

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);

    const hours = pad2(parsed.getHours());
    const minutes = pad2(parsed.getMinutes());

    return `${datePart} ${hours}:${minutes}`;
}

export function formatDisplayTime(value: unknown, fallback = ""): string {
    if (value === null || value === undefined || value === "") return fallback;

    const parsed = new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);

    const hours = pad2(parsed.getHours());
    const minutes = pad2(parsed.getMinutes());
    const seconds = pad2(parsed.getSeconds());

    return `${hours}:${minutes}:${seconds}`;
}