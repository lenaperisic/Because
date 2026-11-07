"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      setMsg(data.ok ? `Povučeno: ${data.people} osoba` : `Greška: ${data.error}`);
    } catch (e) {
      setMsg(`Greška: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <span>
      <button className="secondary" onClick={refresh} disabled={busy}>{busy ? "Povlačim..." : "Osveži iz PostHoga"}</button>
      {msg && <span className="muted" style={{ marginLeft: 8 }}>{msg}</span>}
    </span>
  );
}
