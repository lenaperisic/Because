import Link from "next/link";
import { loadCache } from "@/lib/posthog";
import { isSample } from "@/lib/sample";
import { buildSegments } from "@/lib/segments";
import { listInterviews } from "@/lib/store";
import AutoRefresh from "./AutoRefresh";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

// Rough overview for Checkpoint 1 (the real dashboard is phase 2).
export default function Home() {
  const cache = loadCache();
  const segments = buildSegments(cache);
  const done = new Map(listInterviews().map((r) => [r.result.userId, r.result]));
  const name = new Map(cache.people.map((p) => [p.distinct_id, p.name]));
  // Real Folio people (not samples) first, so the demo person shows up right away.
  const order = (ids: string[]) =>
    [...ids].sort((a, b) => Number(isSample(a)) - Number(isSample(b)) || a.localeCompare(b));

  return (
    <main>
      <h1>Folio user groups</h1>
      <p className="lede">PostHog tells you what users do. Because asks them why, each one about what they actually did.</p>
      <p className="muted">
        Source: {cache.source === "posthog" ? "PostHog" : "local seed backup"} · {cache.people.length} people
        {cache.fetchedAt && ` · ${new Date(cache.fetchedAt).toLocaleString("en-GB")}`} · <RefreshButton />
      </p>
      <AutoRefresh />
      <div className="grid">
        {segments.map((s) => (
          <section key={s.id} className="card">
            <h2><Link href={`/segment/${s.id}`}>{s.name}</Link> <span className="pill">{s.userIds.length}</span></h2>
            <p className="muted">{s.researchQuestion}</p>
            <p className="muted">
              Interviewed <b>{s.userIds.filter((id) => done.has(id)).length}</b> of {s.userIds.length} ·{" "}
              <Link href={`/segment/${s.id}`}>Synthesis and reasons →</Link>
            </p>
            <ul className="users">
              {order(s.userIds).map((id) => (
                <li key={id}>
                  <Link href={`/interview/${encodeURIComponent(id)}`}>{id}</Link>
                  <span className="muted">{done.get(id) ? `✓ ${done.get(id)!.mainReason}` : name.get(id)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
