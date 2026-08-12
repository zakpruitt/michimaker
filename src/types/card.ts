export interface CardSummary {
    id: string;
    name: string;
    setName: string;
    number: string;
    rarity: string | null;
    smallImageUrl: string;
    marketPrice: number | null;
}

export function formatUsd(amount: number): string {
    return `$${amount.toFixed(2)}`;
}
