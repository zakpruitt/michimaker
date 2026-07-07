export interface PokewalletSearchResponse {
    query?: string;
    results?: PokewalletCard[];
}

export interface PokewalletCard {
    id: string;
    card_info?: PokewalletCardInfo | null;
    tcgplayer?: PokewalletTcgplayer | null;
    /** Present for CardMarket-sourced cards; prices are EUR, so unused. */
    cardmarket?: unknown;
}

export interface PokewalletCardInfo {
    name?: string | null;
    clean_name?: string | null;
    set_name?: string | null;
    set_code?: string | null;
    set_id?: string | null;
    card_number?: string | null;
    rarity?: string | null;
    card_type?: string | null;
}

export interface PokewalletTcgplayer {
    prices?: PokewalletTcgPrice[] | null;
    url?: string | null;
}

export interface PokewalletTcgPrice {
    sub_type_name?: string | null;
    market_price?: number | null;
    mid_price?: number | null;
}

export interface PokewalletSetsResponse {
    success?: boolean;
    data?: PokewalletSet[];
}

export interface PokewalletSet {
    name?: string | null;
    set_code?: string | null;
    set_id?: string | null;
    /** Language code, e.g. "eng", "jap", "chn", "ger". */
    language?: string | null;
}
