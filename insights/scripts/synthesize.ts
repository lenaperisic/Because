// Reason synthesis per group (Claude), cached in data/synthesis/<group>.json.
//   npm run synthesize                        # all groups (from the cache if the results haven't changed)
//   npm run synthesize -- --segment tried_ai  # one group
//   npm run synthesize -- --force             # again, skipping the cache
import { loadEnv } from "../lib/env";
loadEnv();

const { segmentDef, SEGMENT_ORDER } = await import("../lib/segments");
const { synthesizeSegment } = await import("../lib/synthesis");
const { provider } = await import("../lib/llm");

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ONLY = arg("segment");
const FORCE = process.argv.includes("--force");

async function main() {
  if (ONLY && !SEGMENT_ORDER.includes(ONLY as never)) throw new Error(`No group ${ONLY}. Groups: ${SEGMENT_ORDER.join(", ")}`);
  const ids = ONLY ? SEGMENT_ORDER.filter((id) => id === ONLY) : SEGMENT_ORDER;
  console.log(`Model via: ${provider()} · groups: ${ids.length}${FORCE ? " · skipping cache" : ""}`);
  // Groups in parallel, printed in order.
  const results = await Promise.allSettled(ids.map((id) => synthesizeSegment(id, { force: FORCE })));
  let failed = 0;
  results.forEach((r, i) => {
    const name = segmentDef(ids[i]).name;
    if (r.status === "rejected") {
      failed++;
      console.error(`\n✗ ${name}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    const s = r.value;
    console.log(`\n## ${name} · ${s.basedOn} interviews${s.simulatedCount ? ` (simulated: ${s.simulatedCount})` : ""}`);
    if (s.basedOn === 0) return console.log("   no interviews yet");
    for (const t of s.themes) {
      console.log(`   ${t.count} × ${t.title}`);
      for (const q of t.quotes) console.log(`        “${q}”`);
    }
    console.log(`   → ${s.takeaway}`);
  });
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
