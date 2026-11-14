// Shared API client. Owner: Arin. Sharyu imports from here and asks for changes.
//
// Types come from the backend contract. With the backend running, generate them:
//   npm run gen:api      (writes ./schema.d.ts from http://localhost:8000/openapi.json)
//
// TODO(Arin): add one typed function per endpoint.

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:8000/ws";
