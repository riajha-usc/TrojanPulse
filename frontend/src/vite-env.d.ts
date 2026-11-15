/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  /** CARTO basemaps API key for the dark map tiles. Optional; tiles are watermarked without it. */
  readonly VITE_CARTO_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
