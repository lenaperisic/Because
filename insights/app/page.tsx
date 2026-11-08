import Link from "next/link";
import { isLive, overview } from "@/lib/overview";
import ActionButton from "./ActionButton";
import LiveRefresh from "./LiveRefresh";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

// Screen 1: Groups. Cards with the number of people, the research question and the insight from interviews.
export default function Home() {
  const { cache, segments, byUser, person, segOf, posthog } = overview();
  const live = cache.people.map((p) => p.distinct_id).filter(isLive).sort();
  const totalReal = segments.reduce((n, s) => n + s.real, 0);
  const totalSim = segments.reduce((n, s) => n + s.simulated, 0);

  return (
    <main>
      <header className="top">
        <div>
          <h1>Folio user groups</h1>
          <p className="lede">PostHog tells you what users do. Because asks them why, each one about what they actually did.</p>
          <p className="muted">
            {cache.source === "posthog" ? "PostHog" : "local seed backup"} · {cache.people.length} people
            {cache.fetchedAt && ` · fetched ${new Date(cache.fetchedAt).toLocaleString("en-GB")}`}
            {" · "}{totalReal} live {totalReal === 1 ? "interview" : "interviews"}, {totalSim} simulated
          </p>
        </div>
        <div className="actions">
          <LiveRefresh posthog={posthog} />
          <RefreshButton />
          <ActionButton url="/api/segments/name" label="Claude names the groups" busyLabel="Naming..." secondary />
        </div>
      </header>

      {live.length > 0 && (
        <section className="card live-strip">
          <h2>Live from Folio <span className="pill live">live</span></h2>
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
                  <span className="muted">{r ? `✓ ${r.result.mainReason}` : "waiting for interview"}</span>
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
            <div className="bar" title="role mix">
              {s.roles.map(([r, n]) => <span key={r} className={`role-${r.toLowerCase()}`} style={{ flex: n }} />)}
            </div>
            <p className="muted">
              Interviews: {s.real} live{s.simulated > 0 && <>, {s.simulated} <span className="pill sim">simulated</span></>}
            </p>
            {s.synthesis?.takeaway ? (
              <p className="insight">{s.synthesis.takeaway}</p>
            ) : s.interviews.length > 0 ? (
              <p className="muted">Latest reason: “{s.interviews.at(-1)!.result.mainReason}”</p>
            ) : null}
          </Link>
        ))}
      </div>
    </main>
  );
}
