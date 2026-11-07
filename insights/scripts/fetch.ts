// Povuče događaje iz PostHoga u keš i ispiše grupe.
//   npm run fetch             -> PostHog -> data/cache.json
//   npm run fetch -- --local  -> bez PostHoga, samo prikaz nad postojećim kešom / seed rezervom
import { loadEnv } from "../lib/env";
import { loadCache, refreshFromPosthog } from "../lib/posthog";
import { buildSegments } from "../lib/segments";

loadEnv();

async function main() {
  const local = process.argv.includes("--local");
  const t0 = Date.now();
  const cache = local ? loadCache() : await refreshFromPosthog();
  console.log(`Izvor: ${cache.source} · ${cache.people.length} osoba · ${cache.usage.length} redova upotrebe · ${cache.today.length} redova za danas${local ? "" : ` · ${Date.now() - t0} ms`}`);
  for (const s of buildSegments(cache)) {
    const roles = new Map<string, number>();
    for (const id of s.userIds) {
      const r = cache.people.find((p) => p.distinct_id === id)?.role || "?";
      roles.set(r, (roles.get(r) ?? 0) + 1);
    }
    const mix = [...roles].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ");
    console.log(`  ${s.name.padEnd(24)} ${String(s.userIds.length).padStart(4)}   ${mix}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
