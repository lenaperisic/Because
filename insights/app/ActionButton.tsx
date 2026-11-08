"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** A button that sends a POST to `url`, then refreshes the page (synthesis, naming groups). */
export default function ActionButton({ url, label, busyLabel, secondary }: { url: string; label: string; busyLabel: string; secondary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <span>
      <button className={secondary ? "secondary" : undefined} onClick={run} disabled={busy}>{busy ? busyLabel : label}</button>
      {error && <span className="error" style={{ marginLeft: 8 }}>{error}</span>}
    </span>
  );
}
