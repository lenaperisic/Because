"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_MS = 4000;
const POSTHOG_MS = 30_000;

/**
 * Osvežavanje uživo: stranica se ponovo iscrta na par sekundi (novi rezultati intervjua),
 * a ako je uključeno, na 30 s povuče i nove događaje iz PostHoga (3 upita, daleko ispod limita).
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
        if (!stop) setLast(data.ok ? new Date().toLocaleTimeString("sr-RS") : `greška: ${data.error}`);
        router.refresh();
      } catch (e) {
        if (!stop) setLast(`greška: ${e instanceof Error ? e.message : e}`);
      }
    }
    tick();
    const t = setInterval(tick, POSTHOG_MS);
    return () => { stop = true; clearInterval(t); };
  }, [pull, router]);

  return (
    <span className="live-toggle">
      <span className="dot" /> uživo
      {posthog && (
        <label className="muted">
          <input type="checkbox" checked={pull} onChange={(e) => setPull(e.target.checked)} /> PostHog na 30 s
          {pull && last && ` · ${last}`}
        </label>
      )}
    </span>
  );
}
