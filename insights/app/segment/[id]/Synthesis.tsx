"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Synthesis as SynthesisData } from "@/lib/synthesis";
import { cleanQuote, personCount } from "./format";

type Props = {
  segmentId: string;
  /** Changes when the group's results change; the synthesis is fetched again then. */
  version: string;
  /** Number of interviews in the group (from the server). */
  interviews: number;
};

/** Takeaway: the first sentence is the headline, the rest goes below at normal size. */
function Takeaway({ text }: { text: string }) {
  const m = text.trim().match(/^(.+?[.!?])\s+(\S[\s\S]*)$/);
  return (
    <>
      <p className="takeaway">{m ? m[1] : text}</p>
      {m && <p className="takeaway-rest">{m[2]}</p>}
    </>
  );
}

/** Reason synthesis (Claude). Fetched after loading, so the page doesn't wait for the model. */
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
      // Only the latest request turns off "Synthesizing..."; an aborted request has already been replaced.
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
        <h2>Reason synthesis (Claude)</h2>
        <p className="muted">The synthesis is created once the group has at least one interview.</p>
      </section>
    );
  }

  return (
    <section className="card synthesis">
      <div className="synthesis-head">
        <h2>Reason synthesis (Claude)</h2>
        <button className="secondary" onClick={() => load(true)} disabled={loading}>
          {loading ? "Synthesizing..." : "Regenerate"}
        </button>
      </div>
      {!data && loading && <p className="muted">Synthesizing the interviews, this takes up to about 20 seconds...</p>}
      {error && <p className="error">{data ? "The new synthesis failed; showing the previous one: " : "Synthesis failed: "}{error}</p>}
      {data && data.takeaway && <Takeaway text={data.takeaway} />}
      {data && (
        <p className="muted">
          Based on {data.basedOn} {data.basedOn === 1 ? "interview" : "interviews"}
          {data.simulatedCount > 0 && (
            <> · <span className="pill sim">{data.simulatedCount === data.basedOn ? "all simulated" : `simulated: ${data.simulatedCount}`}</span></>
          )}
        </p>
      )}
      {data && data.themes.length === 0 && <p className="muted">The model found no themes.</p>}
      {data && data.themes.length > 0 && (
        <div className="themes">
          {data.themes.map((t, i) => (
            <div key={`${i}|${t.title}`} className="theme">
              <b>{t.title}</b> <span className="pill">{personCount(t.count)}</span>
              {t.quotes.map(cleanQuote).filter(Boolean).map((q, j) => (
                <blockquote key={`${j}|${q}`} className="quote"><span className="qm" aria-hidden="true">“</span>{q}”</blockquote>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
