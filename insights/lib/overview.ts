import { loadCache, posthogReadConfigured } from "./posthog";
import { isSample } from "./sample";
import { buildSegments } from "./segments";
import { listInterviews } from "./store";
import { loadSynthesis, type Synthesis } from "./synthesis";
import type { InterviewRecord, Segment } from "./types";

// Data for the dashboard, all from the cache and saved files (no model or PostHog calls).

export type SegmentView = Segment & {
  roles: [string, number][];
  interviews: InterviewRecord[];
  real: number;
  simulated: number;
  synthesis: Synthesis | null;
};

/** Real Folio people (not samples) first, so the demo person shows up right away. */
export const isLive = (id: string) => !isSample(id);
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
    // Same rule as the group screen and the synthesis: interviews of people who are in the group NOW.
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
