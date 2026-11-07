import Link from "next/link";
import { notFound } from "next/navigation";
import { liveFirst, overview } from "@/lib/overview";
import ActionButton from "../../ActionButton";
import LiveRefresh from "../../LiveRefresh";

export const dynamic = "force-dynamic";

const SENT = { neg: "−", neu: "·", pos: "+" } as const;

// Ekran 2: Grupa. Sinteza razloga sa citatima + korisnici sa statusom intervjua.
export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { segments, byUser, person, posthog } = overview();
  const s = segments.find((x) => x.id === id);
  if (!s) notFound();
  const syn = s.synthesis;
  const stale = syn && syn.interviews !== s.interviews.length;
  // Intervjuisani prvi (najnoviji gore), zatim ostali.
  const done = s.interviews.map((r) => r.result.userId).reverse();
  const rest = liveFirst(s.userIds.filter((u) => !byUser.has(u)));

  return (
    <main>
      <header className="top">
        <div>
          <p className="muted"><Link href="/">← Grupe</Link></p>
          <h1>{s.name} <span className="pill">{s.userIds.length}</span></h1>
          <p className="muted">{s.why} · {s.roles.map(([r, n]) => `${r} ${n}`).join(" · ")}</p>
          <p className="question">{s.researchQuestion}</p>
        </div>
        <div className="actions"><LiveRefresh posthog={posthog} /></div>
      </header>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="row">
          <h2>Sinteza razloga</h2>
          {s.interviews.length > 0 && (
            <ActionButton url={`/api/synthesis/${s.id}`} label={syn ? "Ponovo sintetiši" : "Napravi sintezu"} busyLabel="Sintetišem..." secondary={!!syn} />
          )}
        </div>
        {!syn && <p className="muted">{s.interviews.length ? `${s.interviews.length} intervjua spremno za sintezu.` : "Još nema intervjua u ovoj grupi."}</p>}
        {syn && (
          <>
            <p className="muted">
              Iz {syn.interviews} intervjua{syn.simulated > 0 && <>, od toga {syn.simulated} <span className="pill sim">simulirano</span></>}
              {" · "}{new Date(syn.generatedAt).toLocaleString("sr-RS")}
              {stale && " · ima novih intervjua, sintetišite ponovo"}
            </p>
            <p className="insight">{syn.headline}</p>
            <ul className="themes">
              {syn.themes.map((t) => (
                <li key={t.reason}>
                  <div className="row">
                    <b>{t.reason}</b>
                    <span className="muted">{t.count} / {syn.interviews}</span>
                  </div>
                  <div className="meter"><span style={{ width: `${(100 * t.count) / syn.interviews}%` }} /></div>
                  {t.quotes.map((q) => <blockquote key={q}>„{q}“</blockquote>)}
                </li>
              ))}
            </ul>
            {syn.suggestedChanges.length > 0 && (
              <>
                <h2 style={{ marginTop: 16 }}>Predlozi promena</h2>
                <ol>{syn.suggestedChanges.map((c) => <li key={c}>{c}</li>)}</ol>
              </>
            )}
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Korisnici</h2>
        <table className="table">
          <thead><tr><th>Osoba</th><th>Uloga</th><th>Intervju</th><th>Glavni razlog</th><th>PostHog</th></tr></thead>
          <tbody>
            {[...done, ...rest].map((u) => {
              const r = byUser.get(u);
              return (
                <tr key={u}>
                  <td><Link href={`/interview/${encodeURIComponent(u)}`}>{person.get(u)?.name || u}</Link></td>
                  <td className="muted">{person.get(u)?.role || "?"}</td>
                  <td>{r ? (r.result.simulated ? <span className="pill sim">simulirano</span> : <span className="pill">uživo</span>) : <span className="muted">—</span>}</td>
                  <td>{r ? <>{SENT[r.result.sentiment]} {r.result.mainReason}</> : ""}</td>
                  <td className="muted">{r?.posthog ? (r.posthog.ok ? "✓ upisano" : "✗") : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
