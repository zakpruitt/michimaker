export interface CardSummary {
    id: string;
    name: string;
    setName: string;
    /** Collector number, e.g. "148/165". */
    number: string;
    rarity: string | null;
    /** data: URL baked in at placement time; the image endpoint needs an API key the viewer may lack. */
    smallImageUrl: string;
    /** Market price in USD from TCGplayer, if the API provided one. */
    marketPrice: number | null;
}

export function formatUsd(amount: number): string {
    return `$${amount.toFixed(2)}`;
}
