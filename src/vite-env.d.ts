/// <reference types="vite/client" />

/** Typed access to the app's environment variables (see .env.example). */
interface ImportMetaEnv {
  /** Pokémon TCG API key; optional, since the API allows keyless use. */
  readonly VITE_POKEMON_TCG_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
