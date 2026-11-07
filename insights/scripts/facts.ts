// Ispiše profil (grupu i činjenice sa ID-jevima) za jednu osobu.
//   npm run facts -- seed_lekar_017
//   npm run facts -- folio_ana_zirij --refresh   (prvo povuče svež keš iz PostHoga)
import { loadEnv } from "../lib/env";
import { buildProfile, getStats } from "../lib/facts";
import { loadCache, refreshFromPosthog } from "../lib/posthog";
import { classify, SEGMENT_DEFS } from "../lib/segments";

loadEnv();

async function main() {
  const userId = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!userId) throw new Error("Upotreba: npm run facts -- <distinct_id> [--refresh]");
  const cache = process.argv.includes("--refresh") ? await refreshFromPosthog() : loadCache();
  const profile = buildProfile(cache, userId);
  if (!profile) throw new Error(`Nema osobe ${userId} u kešu (${cache.source}, ${cache.people.length} osoba).`);
  const why = classify(getStats(cache, userId)!).why;
  console.log(`${profile.userId} · ${profile.role} · grupa: ${SEGMENT_DEFS[profile.segmentId as keyof typeof SEGMENT_DEFS].name} (${why})`);
  console.log(JSON.stringify(profile.facts, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
