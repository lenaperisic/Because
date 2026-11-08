import { loadCache, posthogReadConfigured } from "./posthog";
import { buildSegments } from "./segments";
import { listInterviews } from "./store";
import { loadSynthesis, type Synthesis } from "./synthesis";
import type { InterviewRecord, Segment } from "./types";

// Podaci za dashboard, sve iz keša i sačuvanih fajlova (bez poziva modela ili PostHoga).

export type SegmentView = Segment & {
  roles: [string, number][];
  interviews: InterviewRecord[];
  real: number;
  simulated: number;
  synthesis: Synthesis | null;
};

/** Prave Folio osobe (ne seed) prve, da se demo osoba odmah vidi. */
export const isLive = (id: string) => !id.startsWith("seed_");
export const liveFirst = (ids: string[]) =>
  [...ids].sort((a, b) => Number(isLive(b)) - Number(isLive(a)) || a.localeCompare(b));

export function overview() {
  const cache = loadCache();
  const records = listInterviews();
  const byUser = new Map(records.map((r) => [r.result.userId, r]));
  const person = new Map(cache.people.map((p) => [p.distinct_id, p]));
  const segments: SegmentView[] = buildSegments(cache).map((s) => {
    const roles = new Map<string, number>();
    for (const id of s.userIds) {
      const r = person.get(id)?.role || "?";
      roles.set(r, (roles.get(r) ?? 0) + 1);
    }
    // Isto pravilo kao ekran grupe i sinteza: intervjui osoba koje su SADA u grupi.
    const members = new Set(s.userIds);
    const interviews = records.filter((r) => members.has(r.result.userId));
    return {
      ...s,
      roles: [...roles].sort((a, b) => b[1] - a[1]),
      interviews,
      real: interviews.filter((r) => !r.result.simulated).length,
      simulated: interviews.filter((r) => r.result.simulated).length,
      synthesis: loadSynthesis(s.id),
    };
  });
  const segOf = new Map(segments.flatMap((s) => s.userIds.map((id) => [id, s] as const)));
  return { cache, segments, byUser, person, segOf, posthog: posthogReadConfigured() };
}

