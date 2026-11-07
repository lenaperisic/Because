// Simulirani intervjui za sintezu po grupi (jasno označeni kao simulirani).
//   npm run simulate                          -> 8 po grupi, svih 5 grupa
//   npm run simulate -- --per 3 --segment probali_ai
//   npm run simulate -- --no-posthog          -> bez upisa nazad u PostHog
//   npm run simulate -- --synthesize          -> posle simulacije odmah i sinteza po grupi
// Preskače osobe koje već imaju intervju. Uzima samo seed osobe (prave Folio osobe ostavlja za demo).
import { loadEnv } from "../lib/env";

loadEnv();

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  // Uvoz posle loadEnv, da lib/llm vidi ključeve.
  const { buildProfile } = await import("../lib/facts");
  const { finishInterview } = await import("../lib/finish");
  const { loadCache } = await import("../lib/posthog");
  const { buildSegments, isSegmentId } = await import("../lib/segments");
  const { HIDDEN_REASONS, simulateConversation } = await import("../lib/simulate");
  const { loadInterview } = await import("../lib/store");
  const { synthesize } = await import("../lib/synthesis");
  const { provider } = await import("../lib/llm");

  const per = Number(arg("per") ?? 8);
  const only = arg("segment");
  if (only && !isSegmentId(only)) throw new Error(`Nepoznata grupa: ${only}`);
  const concurrency = Number(arg("concurrency") ?? 3);
  const writeBack = !process.argv.includes("--no-posthog");

  const cache = loadCache();
  const jobs: { userId: string; segmentId: string; reason: string }[] = [];
  for (const seg of buildSegments(cache)) {
    if (only && seg.id !== only) continue;
    const reasons = HIDDEN_REASONS[seg.id as keyof typeof HIDDEN_REASONS];
    const free = seg.userIds.filter((id) => id.startsWith("seed_") && !loadInterview(id));
    // Raširi po ulogama: uzimaj na preskok, ne prvih N iste uloge.
    const step = Math.max(1, Math.floor(free.length / per));
    const picked = free.filter((_, i) => i % step === 0).slice(0, per);
    picked.forEach((userId, i) => jobs.push({ userId, segmentId: seg.id, reason: reasons[i % reasons.length] }));
  }
  console.log(`Model: ${provider()} · ${jobs.length} simuliranih intervjua · upis u PostHog: ${writeBack && process.env.POSTHOG_KEY ? "da" : "ne"}`);

  let ok = 0;
  const queue = [...jobs];
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const t0 = Date.now();
      try {
        const profile = buildProfile(cache, job.userId)!;
        const transcript = await simulateConversation(profile, job.reason);
        const rec = await finishInterview(profile, transcript, { simulated: true, hiddenReason: job.reason, writeBack });
        ok++;
        const ph = rec.posthog ? (rec.posthog.ok ? " · PostHog ✓" : ` · PostHog ✗ ${rec.posthog.error}`) : "";
        console.log(`  ✓ ${job.segmentId.padEnd(13)} ${job.userId.padEnd(20)} ${Math.round((Date.now() - t0) / 1000)}s  „${rec.result.mainReason}“${ph}`);
      } catch (e) {
        console.log(`  ✗ ${job.segmentId.padEnd(13)} ${job.userId.padEnd(20)} ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  console.log(`Gotovo: ${ok} / ${jobs.length}.`);

  if (process.argv.includes("--synthesize")) {
    for (const id of new Set(jobs.map((j) => j.segmentId))) {
      try {
        const s = await synthesize(id);
        console.log(`\nSinteza ${id}: ${s.headline}`);
        for (const t of s.themes) console.log(`  ${String(t.count).padStart(2)} × ${t.reason}`);
      } catch (e) {
        console.log(`Sinteza ${id} nije uspela: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
