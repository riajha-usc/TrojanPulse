import * as client from "../shared/api/client";
import { CONFIG } from "./config";
import type { LatLng, Schema } from "./types";

export { ApiError, getToken, logout } from "../shared/api/client";

export class ApiFailure extends Error {
  readonly outcomeUnknown: boolean;
  readonly status: number;
  constructor(message: string, outcomeUnknown = false, status = 0) {
    super(message);
    this.name = "ApiFailure";
    this.outcomeUnknown = outcomeUnknown;
    this.status = status;
  }
}

export const isAbortError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";

/**
 * Shared calls have no AbortSignal argument yet. Stop waiting and ignore late results
 * on cancellation, but do not claim this undoes a request already sent to the server.
 */
function observe<T>(
  task: (signal: AbortSignal) => Promise<T>,
  callerSignal?: AbortSignal,
  mutation = false,
  timeoutMs: number = CONFIG.requestTimeoutMs,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callerSignal?.removeEventListener("abort", cancel);
      callback();
    };
    const cancel = () => {
      controller.abort();
      finish(() => reject(new DOMException("Request cancelled.", "AbortError")));
    };
    if (callerSignal?.aborted) {
      cancel();
      return;
    }
    callerSignal?.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      finish(() =>
        reject(
          new ApiFailure(
            mutation
              ? "Request timed out. The server may still have processed it."
              : "The server took too long to respond.",
            mutation,
          ),
        ),
      );
    }, timeoutMs);
    try {
      task(controller.signal).then(
        (value) => finish(() => resolve(value)),
        (error: unknown) =>
          finish(() => {
            if (isAbortError(error)) {
              reject(error);
              return;
            }
            const uncertain =
              mutation &&
              (!(error instanceof client.ApiError) || error.status === 0 || error.status >= 500);
            const message = error instanceof Error ? error.message : "The request failed.";
            reject(
              new ApiFailure(
                uncertain ? message + " The server may have received the request." : message,
                uncertain,
                error instanceof client.ApiError ? error.status : 0,
              ),
            );
          }),
      );
    } catch (error: unknown) {
      finish(() => reject(error));
    }
  });
}

// The shared client does not export /health yet.
export function getHealth(signal?: AbortSignal) {
  return observe(async (requestSignal) => {
    const response = await fetch(new URL("/health", client.API_URL), { signal: requestSignal });
    if (!response.ok) throw new Error("Could not check the backend data mode.");
    const body: unknown = await response.json();
    if (
      !body ||
      typeof body !== "object" ||
      !("simulated_data" in body) ||
      typeof body.simulated_data !== "boolean"
    )
      throw new Error("Invalid backend data mode.");
    return { simulated_data: body.simulated_data };
  }, signal);
}
export const getRoutes = (from: LatLng, to: LatLng, signal?: AbortSignal) =>
  observe(() => client.getRoutes(from, to), signal);
export const getPods = (to: LatLng, departInMin?: number, signal?: AbortSignal) =>
  observe(() => client.getPods(to, departInMin), signal);
export const joinPod = (id: string, signal?: AbortSignal) =>
  observe(() => client.joinPod(id), signal, true);
export const reportHazard = (body: Schema["HazardReportRequest"], signal?: AbortSignal) =>
  observe(() => client.reportHazard(body.type, body.location), signal, true);
export const startWalk = (body: Schema["WalkCreateRequest"], signal?: AbortSignal) =>
  observe(() => client.startWalk(body), signal, true);
export const endWalk = (id: string, signal?: AbortSignal) =>
  observe(() => client.endWalk(id), signal, true);
export const sendAudio = (id: string, form: FormData, signal?: AbortSignal) =>
  observe(() => client.sendAudio(id, form), signal, false, CONFIG.audioUploadTimeoutMs);
export const createAlert = (body: Schema["AlertCreateRequest"], signal?: AbortSignal) =>
  observe(() => client.createAlert(body), signal, true);
export const resolveAlert = (id: string, signal?: AbortSignal) =>
  observe(() => client.resolveAlert(id), signal, true);
export const getAlerts = (signal?: AbortSignal) => observe(() => client.getAlerts(), signal);

export const login = (email: string, signal?: AbortSignal) =>
  observe(() => client.login(email), signal);
