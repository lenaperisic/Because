// Prints the profile (group and facts with IDs) for one person.
//   npm run facts -- sample_doctor_017
//   npm run facts -- folio_ana_zirij --refresh   (pulls a fresh cache from PostHog first)
import { loadEnv } from "../lib/env";
import { buildProfile, getStats } from "../lib/facts";
import { loadCache, refreshFromPosthog } from "../lib/posthog";
import { classify, segmentDef } from "../lib/segments";

loadEnv();

async function main() {
  const userId = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!userId) throw new Error("Usage: npm run facts -- <distinct_id> [--refresh]");
  const cache = process.argv.includes("--refresh") ? await refreshFromPosthog() : loadCache();
  const profile = buildProfile(cache, userId);
  if (!profile) throw new Error(`No person ${userId} in the cache (${cache.source}, ${cache.people.length} people).`);
  const why = classify(getStats(cache, userId)!).why;
  console.log(`${profile.userId} · ${profile.role} · group: ${segmentDef(profile.segmentId).name} (${why})`);
  console.log(JSON.stringify(profile.facts, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
