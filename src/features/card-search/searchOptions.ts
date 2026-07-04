/**
 * Static dropdown/autocomplete options for the card search form.
 * Extend AVAILABLE_SETS as new Pokémon TCG sets release; ids come from
 * https://api.pokemontcg.io/v2/sets.
 */

export const AVAILABLE_RARITIES: string[] = [
  "",
  "Common",
  "Uncommon",
  "Rare",
  "Rare Holo",
  "Rare Holo V",
  "Rare Holo VMAX",
  "Illustration Rare",
  "Special Illustration Rare",
  "Rare Secret",
];

export interface SetOption {
  id: string;
  name: string;
}

export const AVAILABLE_SETS: SetOption[] = [
  { id: "sv1", name: "Scarlet & Violet" },
  { id: "svp", name: "Scarlet & Violet Black Star Promos" },
  { id: "sv2", name: "Paldea Evolved" },
  { id: "sve", name: "Scarlet & Violet Energies" },
  { id: "sv3", name: "Obsidian Flames" },
  { id: "sv3pt5", name: "151" },
  { id: "sv4", name: "Paradox Rift" },
  { id: "sv4pt5", name: "Paldean Fates" },
  { id: "sv5", name: "Temporal Forces" },
  { id: "sv6", name: "Twilight Masquerade" },
  { id: "sv6pt5", name: "Shrouded Fable" },
  { id: "sv7", name: "Stellar Crown" },
  { id: "sv8", name: "Surging Sparks" },
  { id: "sv8pt5", name: "Prismatic Evolutions" },
];

export interface OrderByOption {
  value: string;
  label: string;
}

export const ORDER_BY_OPTIONS: OrderByOption[] = [
  { value: "set.id,number", label: "Set + Number" },
  { value: "number", label: "Number" },
  { value: "name", label: "Name" },
];
