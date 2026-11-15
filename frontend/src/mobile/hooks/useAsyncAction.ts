import { useCallback, useEffect, useRef, useState } from "react";
import { isAbortError } from "../api";

/** Lock before GPS/network work; cancel local waiting when the page unmounts. */
export function useAsyncAction<K extends string>() {
  const mounted = useRef(false);
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<K | null>(null);
  const [failure, setFailure] = useState<Error | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      active.current?.abort();
      active.current = null;
    };
  }, []);
  const run = useCallback(
    async <T>(key: K, task: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
      if (!mounted.current || active.current) return undefined;
      const controller = new AbortController();
      active.current = controller;
      setBusy(key);
      setFailure(null);
      try {
        const result = await task(controller.signal);
        return mounted.current && !controller.signal.aborted ? result : undefined;
      } catch (error: unknown) {
        if (mounted.current && !controller.signal.aborted && !isAbortError(error))
          setFailure(error instanceof Error ? error : new Error("The request failed."));
        return undefined;
      } finally {
        if (active.current === controller) {
          active.current = null;
          if (mounted.current) setBusy(null);
        }
      }
    },
    [],
  );
  return { busy, failure, error: failure?.message ?? "", run };
}
