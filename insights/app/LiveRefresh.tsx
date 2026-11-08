"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_MS = 4000;
const POSTHOG_MS = 30_000;

/**
 * Live refresh: the page re-renders every few seconds (new interview results),
 * and, if turned on, pulls new events from PostHog every 30 s (3 queries, far below the limit).
 */
export default function LiveRefresh({ posthog }: { posthog: boolean }) {
  const router = useRouter();
  const [pull, setPull] = useState(false);
  const [last, setLast] = useState("");

  useEffect(() => {
    const t = setInterval(() => router.refresh(), PAGE_MS);
    return () => clearInterval(t);
  }, [router]);

  useEffect(() => {
    if (!pull) return;
    let stop = false;
    async function tick() {
      try {
        const res = await fetch("/api/refresh", { method: "POST" });
        const data = await res.json();
        if (!stop) setLast(data.ok ? new Date().toLocaleTimeString("en-GB") : `error: ${data.error}`);
        router.refresh();
      } catch (e) {
        if (!stop) setLast(`error: ${e instanceof Error ? e.message : e}`);
      }
    }
    tick();
    const t = setInterval(tick, POSTHOG_MS);
    return () => { stop = true; clearInterval(t); };
  }, [pull, router]);

  return (
    <span className="live-toggle">
      <span className="dot" /> live
      {posthog && (
        <label className="muted">
          <input type="checkbox" checked={pull} onChange={(e) => setPull(e.target.checked)} /> PostHog every 30 s
          {pull && last && ` · ${last}`}
        </label>
      )}
    </span>
  );
}
