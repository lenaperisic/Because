// Sinteza razloga po grupi (Claude), sa kešom u data/synthesis/<grupa>.json.
//   npm run synthesize                         # sve grupe (iz keša ako se rezultati nisu menjali)
//   npm run synthesize -- --segment probali_ai # jedna grupa
//   npm run synthesize -- --force              # ponovo, bez keša
import { loadEnv } from "../lib/env";
loadEnv();

const { SEGMENT_DEFS, SEGMENT_ORDER } = await import("../lib/segments");
const { synthesizeSegment } = await import("../lib/synthesis");
const { provider } = await import("../lib/llm");

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const ONLY = arg("segment");
const FORCE = process.argv.includes("--force");

async function main() {
  if (ONLY && !SEGMENT_ORDER.includes(ONLY as never)) throw new Error(`Nema grupe ${ONLY}. Grupe: ${SEGMENT_ORDER.join(", ")}`);
  const ids = ONLY ? SEGMENT_ORDER.filter((id) => id === ONLY) : SEGMENT_ORDER;
  console.log(`Model preko: ${provider()} · grupa: ${ids.length}${FORCE ? " · bez keša" : ""}`);
  // Grupe paralelno, ispis redom.
  const results = await Promise.allSettled(ids.map((id) => synthesizeSegment(id, { force: FORCE })));
  let failed = 0;
  results.forEach((r, i) => {
    const name = SEGMENT_DEFS[ids[i]].name;
    if (r.status === "rejected") {
      failed++;
      console.error(`\n✗ ${name}: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
      return;
    }
    const s = r.value;
    console.log(`\n## ${name} · ${s.basedOn} intervjua${s.simulatedCount ? ` (simulirano: ${s.simulatedCount})` : ""}`);
    if (s.basedOn === 0) return console.log("   još nema intervjua");
    for (const t of s.themes) {
      console.log(`   ${t.count} × ${t.title}`);
      for (const q of t.quotes) console.log(`        „${q}“`);
    }
    console.log(`   → ${s.takeaway}`);
  });
  if (failed) process.exit(1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
