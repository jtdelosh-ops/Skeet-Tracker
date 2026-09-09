"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Shoot } from "@/lib/scoring";
import { createRequestGate } from "@/lib/request-gate";

type HistoryData = { shoots: Shoot[]; total: number; page: number; pages: number; query: string };
const readLocation = () => {
  const params = new URLSearchParams(window.location.search);
  return { query: params.get("q") ?? "", page: params.get("page") ?? "1" };
};
function updateLocation(query: string, page: number, push = false) {
  const url = new URL(window.location.href);
  if (query.trim()) url.searchParams.set("q", query.trim()); else url.searchParams.delete("q");
  if (page > 1) url.searchParams.set("page", String(page)); else url.searchParams.delete("page");
  if (url.href !== window.location.href) window.history[push ? "pushState" : "replaceState"](window.history.state, "", url);
}

export function useHistory() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gate] = useState(createRequestGate);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = useCallback(() => {
    gate.cancel();
    if (timer.current) clearTimeout(timer.current);
  }, [gate]);
  const request = useCallback(async (q: string, page: string | number) => {
    cancel();
    const current = gate.start();
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q, page: String(page) });
      const response = await fetch(`/api/history?${params}`, { signal: current.signal });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "Unable to load history.");
      if (!current.isCurrent()) return;
      setData(result);
      updateLocation(result.query, result.page);
    } catch (e) {
      if (current.isCurrent() && !(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Unable to load history.");
    } finally {
      if (current.isCurrent()) setLoading(false);
    }
  }, [cancel, gate]);
  useEffect(() => {
    const restore = () => {
      const location = readLocation();
      setQuery(location.query);
      void request(location.query, location.page);
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => { cancel(); window.removeEventListener("popstate", restore); };
  }, [request, cancel]);
  const search = (q: string) => {
    cancel(); // Invalidate old requests immediately, including during the debounce gap.
    setQuery(q);
    setLoading(true);
    setError("");
    updateLocation(q, 1);
    timer.current = setTimeout(() => void request(q, 1), q ? 300 : 0);
  };
  const navigate = (page: number) => {
    updateLocation(query, page, true);
    void request(query, page);
  };
  const refresh = () => { const location = readLocation(); void request(location.query, location.page); };
  return { query, data, loading, error, search, navigate, refresh };
}
