/** Application settings; walk, route, pod and alert data belong to the API. */

function integerSetting(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (raw === undefined || raw.trim() === "") return fallback;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

const configuredPhone = import.meta.env.VITE_DPS_PHONE?.trim();
const dpsPhone =
  configuredPhone && /^\+?[1-9]\d{6,14}$/.test(configuredPhone) ? configuredPhone : "+12137404321";

export const CONFIG = {
  dpsPhone,

  /** Default required by the guide; bounded overrides support testing. */
  countdownSeconds: integerSetting(import.meta.env.VITE_COUNTDOWN_SECONDS, 10, 1, 60),

  holdForHelpMs: 2_000,

  /** Confirm this duration and the recorder's actual MIME type with Ria. */
  audioChunkMs: integerSetting(import.meta.env.VITE_AUDIO_CHUNK_MS, 3_000, 1_000, 10_000),

  requestTimeoutMs: 15_000,
  audioUploadTimeoutMs: 30_000,
  locationFreshForMs: 600_000,

  /** Demo only: start from Leavey Library when GPS is missing or off campus. */
  demoLocationFallback: true,

  /**
   * Compatibility only. Fresh voice triggers must not be silently muted.
   * The recording lifecycle must discard responses from stopped sessions.
   */
  triggerCooldownMs: 0,
} as const;
