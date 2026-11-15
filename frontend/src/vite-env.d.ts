/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  /** CARTO basemaps API key for the dark map tiles. Maps show no streets without it. */
  readonly VITE_CARTO_KEY?: string;
}

interface Window {
  /** Set by the backend when it serves the page. See backend/app/web.py. */
  TP_RUNTIME?: { cartoKey?: string };
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
