import Link from "next/link";
import { loadCache } from "@/lib/posthog";
import { buildSegments } from "@/lib/segments";
import { listInterviews } from "@/lib/store";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

// Grub pregled za Checkpoint 1 (pravi dashboard je faza 2).
export default function Home() {
  const cache = loadCache();
  const segments = buildSegments(cache);
  const done = new Map(listInterviews().map((r) => [r.result.userId, r.result]));
  const name = new Map(cache.people.map((p) => [p.distinct_id, p.name]));
  // Prave Folio osobe (ne seed) prve, da se demo osoba odmah vidi.
  const order = (ids: string[]) =>
    [...ids].sort((a, b) => Number(a.startsWith("seed_")) - Number(b.startsWith("seed_")) || a.localeCompare(b));

  return (
    <main>
      <h1>Folio · AI intervjui</h1>
      <p className="muted">
        Izvor: {cache.source === "posthog" ? "PostHog" : "lokalna seed rezerva"} · {cache.people.length} osoba
        {cache.fetchedAt && ` · ${new Date(cache.fetchedAt).toLocaleString("sr-RS")}`} · <RefreshButton />
      </p>
      <div className="grid">
        {segments.map((s) => (
          <section key={s.id} className="card">
            <h2>{s.name} <span className="pill">{s.userIds.length}</span></h2>
            <p className="muted">{s.researchQuestion}</p>
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
