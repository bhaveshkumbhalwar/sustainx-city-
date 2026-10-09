import { useEffect, useRef } from 'react';

// Controlled polling fallback (no WebSocket infrastructure exists).
// - intervalMs: 30000–60000 recommended; never below 15000
// - Pauses when the tab is hidden or when `enabled` is false, so background
//   pages never poll. Refetches immediately when the tab becomes visible.
// Usage: usePolling(refetch, 45000, enabled)
export function usePolling(callback, intervalMs = 45000, enabled = true) {
  const cbRef = useRef(null);
  useEffect(() => {
    cbRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const ms = Math.max(15000, intervalMs);
    const tick = () => {
      if (document.visibilityState === 'visible') {
        try {
          cbRef.current();
        } catch {
          // polling must never crash the page
        }
      }
    };
    const id = setInterval(tick, ms);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs, enabled]);
}

export default usePolling;
