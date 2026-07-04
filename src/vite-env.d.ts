/// <reference types="vite/client" />

/** Typed access to the app's environment variables (see .env.example). */
interface ImportMetaEnv {
  /** PokeWallet API key; required for card search. */
  readonly VITE_POKEWALLET_API_KEY?: string;
  /** Optional PokeWallet base URL override; defaults to the public API. */
  readonly VITE_POKEWALLET_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
