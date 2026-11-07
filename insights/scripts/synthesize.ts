// Sinteza razloga po grupi iz sačuvanih intervjua -> data/synthesis/<grupa>.json
//   npm run synthesize                 -> sve grupe koje imaju intervjue
//   npm run synthesize -- probali_ai   -> jedna grupa
import { loadEnv } from "../lib/env";

loadEnv();

async function main() {
  const { SEGMENT_ORDER } = await import("../lib/segments");
  const { interviewsFor, synthesize } = await import("../lib/synthesis");
  const only = process.argv.slice(2).find((a) => !a.startsWith("--"));
  for (const id of only ? [only] : SEGMENT_ORDER) {
    const n = interviewsFor(id).length;
    if (n === 0) { console.log(`${id}: nema intervjua, preskačem`); continue; }
    const s = await synthesize(id);
    console.log(`\n${id} (${s.interviews} intervjua, ${s.simulated} simuliranih): ${s.headline}`);
    for (const t of s.themes) console.log(`  ${String(t.count).padStart(2)} × ${t.reason}${t.quotes[0] ? `  „${t.quotes[0]}“` : ""}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
