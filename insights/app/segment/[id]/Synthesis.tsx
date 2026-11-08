"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Synthesis as SynthesisData } from "@/lib/synthesis";
import { cleanQuote, personCount } from "./format";

type Props = {
  segmentId: string;
  /** Menja se kad se rezultati grupe promene; tada se sinteza povlači ponovo. */
  version: string;
  /** Broj intervjua u grupi (sa servera). */
  interviews: number;
};

/** Sinteza razloga (Claude). Povlači se posle učitavanja, da strana ne čeka model. */
export default function Synthesis({ segmentId, version, interviews }: Props) {
  const [data, setData] = useState<SynthesisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(async (force: boolean) => {
    inFlight.current?.abort();
    const ctrl = new AbortController();
    inFlight.current = ctrl;
    setLoading(true);
    setError("");
    try {
      const url = `/api/segments/${encodeURIComponent(segmentId)}/synthesis${force ? "?force=1" : ""}`;
      const res = await fetch(url, { cache: "no-store", signal: ctrl.signal });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body as SynthesisData);
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : String(e));
    } finally {
      // Samo poslednji zahtev gasi „Pravim...“; prekinut zahtev je već zamenjen novim.
      if (inFlight.current === ctrl) {
        inFlight.current = null;
        setLoading(false);
      }
    }
  }, [segmentId]);

  useEffect(() => {
    if (interviews === 0) {
      setData(null);
      setError("");
      return;
    }
    load(false);
    return () => inFlight.current?.abort();
  }, [load, version, interviews]);

  if (interviews === 0) {
    return (
      <section className="card synthesis">
        <h2>Sinteza razloga (Claude)</h2>
        <p className="muted">Sinteza se pravi kad grupa ima bar jedan intervju.</p>
      </section>
    );
  }

  return (
    <section className="card synthesis">
      <div className="synthesis-head">
        <h2>Sinteza razloga (Claude)</h2>
        <button className="secondary" onClick={() => load(true)} disabled={loading}>
          {loading ? "Pravim sintezu..." : "Napravi ponovo"}
        </button>
      </div>
      {data && (
        <p className="muted">
          Na osnovu {data.basedOn} intervjua
          {data.simulatedCount > 0 && (
            <> · <span className="pill">{data.simulatedCount === data.basedOn ? "svi simulirani" : `simulirano: ${data.simulatedCount}`}</span></>
          )}
        </p>
      )}
      {!data && loading && <p className="muted">Pravim sintezu iz intervjua, to traje do 20-ak sekundi...</p>}
      {error && <p className="error">{data ? "Nova sinteza nije uspela, prikazana je prethodna: " : "Sinteza nije uspela: "}{error}</p>}
      {data && data.takeaway && <p className="takeaway">{data.takeaway}</p>}
      {data && data.themes.length === 0 && <p className="muted">Model nije izdvojio teme.</p>}
      {data && data.themes.length > 0 && (
        <div className="themes">
          {data.themes.map((t, i) => (
            <div key={`${i}|${t.title}`} className="theme">
              <b>{t.title}</b> <span className="pill">{personCount(t.count)}</span>
              {t.quotes.map(cleanQuote).filter(Boolean).map((q, j) => (
                <blockquote key={`${j}|${q}`} className="quote">„{q}“</blockquote>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
