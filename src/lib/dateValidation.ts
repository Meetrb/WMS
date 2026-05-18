const pad = (value: number): string => String(value).padStart(2, "0");

export const getTodayDateInputMax = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    return `${year}-${month}-${day}`;
};

export const getCurrentDateTimeLocalMax = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const isFutureDate = (value: string): boolean => {
    if (!value.trim()) return false;

    const selected = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return false;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return selected.getTime() > today.getTime();
};

export const isFutureDateTimeLocal = (value: string): boolean => {
    if (!value.trim()) return false;

    const selected = new Date(value);
    if (Number.isNaN(selected.getTime())) return false;

    return selected.getTime() > Date.now();
};
