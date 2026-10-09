import { useState, useEffect } from 'react';

/* eslint-disable react-hooks/set-state-in-effect */
// Generic API data hook: manages loading / error / data + refresh.
//   const { data, loading, error, refetch } = useFetch(fetcher, deps)
export function useFetch(fetcher, deps = [], immediate = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!immediate) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => alive && setData(res.data ?? res))
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = () => setTick((t) => t + 1);

  return { data, loading, error, refetch };
}

export default useFetch;