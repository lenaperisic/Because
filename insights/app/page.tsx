import Link from "next/link";
import { loadCache } from "@/lib/posthog";
import { buildSegments } from "@/lib/segments";
import { listInterviews } from "@/lib/store";
import AutoRefresh from "./AutoRefresh";
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
      <p className="lede">PostHog vam kaže šta korisnici rade. Mi ih pitamo zašto, i to svakog o onome što je on uradio.</p>
      <p className="muted">
        Izvor: {cache.source === "posthog" ? "PostHog" : "lokalna seed rezerva"} · {cache.people.length} osoba
        {cache.fetchedAt && ` · ${new Date(cache.fetchedAt).toLocaleString("sr-RS")}`} · <RefreshButton />
      </p>
      <AutoRefresh />
      <div className="grid">
        {segments.map((s) => (
          <section key={s.id} className="card">
            <h2><Link href={`/segment/${s.id}`}>{s.name}</Link> <span className="pill">{s.userIds.length}</span></h2>
            <p className="muted">{s.researchQuestion}</p>
            <p className="muted">
              Intervjuisano <b>{s.userIds.filter((id) => done.has(id)).length}</b> od {s.userIds.length} ·{" "}
              <Link href={`/segment/${s.id}`}>Sinteza i razlozi →</Link>
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
