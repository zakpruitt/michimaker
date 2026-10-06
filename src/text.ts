export function slugify(value: string, fallback = "untitled"): string {
    const slug = value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);
    return slug === "" ? fallback : slug;
}

export function padNumber(value: number): string {
    return String(value).padStart(2, "0");
}
