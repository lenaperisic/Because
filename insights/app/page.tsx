import Link from "next/link";
import { isLive, overview } from "@/lib/overview";
import ActionButton from "./ActionButton";
import LiveRefresh from "./LiveRefresh";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

// Ekran 1: Grupe. Kartice sa brojem ljudi, istraživačkim pitanjem i uvidom iz intervjua.
export default function Home() {
  const { cache, segments, byUser, person, segOf, posthog } = overview();
  const live = cache.people.map((p) => p.distinct_id).filter(isLive).sort();
  const totalReal = segments.reduce((n, s) => n + s.real, 0);
  const totalSim = segments.reduce((n, s) => n + s.simulated, 0);

  return (
    <main>
      <header className="top">
        <div>
          <h1>Folio · AI intervjui</h1>
          <p className="muted">
            {cache.source === "posthog" ? "PostHog" : "lokalna seed rezerva"} · {cache.people.length} osoba
            {cache.fetchedAt && ` · povučeno ${new Date(cache.fetchedAt).toLocaleString("sr-RS")}`}
            {" · "}{totalReal} intervjua uživo, {totalSim} simuliranih
          </p>
        </div>
        <div className="actions">
          <LiveRefresh posthog={posthog} />
          <RefreshButton />
          <ActionButton url="/api/segments/name" label="Claude imenuje grupe" busyLabel="Imenujem..." secondary />
        </div>
      </header>

      {live.length > 0 && (
        <section className="card live-strip">
          <h2>Uživo iz Folio-a</h2>
          <ul className="users">
            {live.map((id) => {
              const r = byUser.get(id);
              return (
                <li key={id}>
                  <span>
                    <Link href={`/interview/${encodeURIComponent(id)}`}><b>{person.get(id)?.name || id}</b></Link>
                    <span className="muted"> · {person.get(id)?.role || "?"} · </span>
                    {segOf.get(id) && <Link href={`/segment/${segOf.get(id)!.id}`}>{segOf.get(id)!.name}</Link>}
                  </span>
                  <span className="muted">{r ? `✓ ${r.result.mainReason}` : "čeka intervju"}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid">
        {segments.map((s) => (
          <Link key={s.id} href={`/segment/${s.id}`} className="card segment">
            <h2>{s.name} <span className="pill">{s.userIds.length}</span></h2>
            <p className="muted">{s.why}</p>
            <p className="question">{s.researchQuestion}</p>
            <p className="muted">{s.roles.map(([r, n]) => `${r} ${n}`).join(" · ")}</p>
            <div className="bar" title="udeo uloga">
              {s.roles.map(([r, n]) => <span key={r} className={`role-${r.toLowerCase()}`} style={{ flex: n }} />)}
            </div>
            <p className="muted">
              Intervjui: {s.real} uživo{s.simulated > 0 && <>, {s.simulated} <span className="pill sim">simulirano</span></>}
            </p>
            {s.synthesis ? (
              <p className="insight">{s.synthesis.headline}</p>
            ) : s.interviews.length > 0 ? (
              <p className="muted">Poslednji razlog: „{s.interviews.at(-1)!.result.mainReason}“</p>
            ) : null}
          </Link>
        ))}
      </div>
    </main>
  );
}
