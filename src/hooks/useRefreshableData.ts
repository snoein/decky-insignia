import { useCallback, useEffect, useState } from "react";

// Shared shape behind every panel page that loads data via a `forceRefresh`
// callable and wires up Header's refresh button: fetches once on mount
// (loading indicator), supports a manual refresh (refreshing indicator), and
// -- when pollIntervalMs is given -- refetches in the background on that
// interval without disturbing either indicator, so a panel left open stays
// current without flashing "Loading..." or spinning the refresh icon.
export function useRefreshableData<T>(fetcher: (forceRefresh: boolean) => Promise<T>, pollIntervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback((isRefresh: boolean, background = false) => {
    if (!background) {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
    }
    return fetcher(isRefresh)
      .then((result) => {
        setData(result);
      })
      .finally(() => {
        if (!background) {
          setLoading(false);
          setRefreshing(false);
        }
      });
  }, [fetcher]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    const interval = setInterval(() => fetchData(false, true), pollIntervalMs);
    return () => clearInterval(interval);
  }, [fetchData, pollIntervalMs]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refreshing, refresh };
}
