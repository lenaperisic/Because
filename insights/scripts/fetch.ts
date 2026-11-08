// Pulls events from PostHog into the cache and prints the groups.
//   npm run fetch             -> PostHog -> data/cache.json
//   npm run fetch -- --local  -> no PostHog, just shows the groups over the existing cache / seed backup
import { loadEnv } from "../lib/env";
import { loadCache, refreshFromPosthog } from "../lib/posthog";
import { buildSegments } from "../lib/segments";

loadEnv();

async function main() {
  const local = process.argv.includes("--local");
  const t0 = Date.now();
  const cache = local ? loadCache() : await refreshFromPosthog();
  console.log(`Source: ${cache.source} · ${cache.people.length} people · ${cache.usage.length} usage rows · ${cache.today.length} rows for today${local ? "" : ` · ${Date.now() - t0} ms`}`);
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
