import fs from "node:fs";
import path from "node:path";
import { daysAgo, getStats, listUserIds, triedAndQuit, type UserStats } from "./facts";
import type { EventCache, Segment } from "./types";

// Sorting into 5 groups by BEHAVIOR (not by role, no demographics). Code builds the groups;
// Claude only names them and phrases the research question (lib/naming.ts -> data/segment-names.json).

export type SegmentId = "signers" | "readers" | "compliance" | "tried_ai" | "new";

export const SEGMENT_DEFS: Record<SegmentId, Omit<Segment, "userIds">> = {
  signers: {
    id: "signers",
    name: "Signers",
    why: "Signing and forms make up more than half of their tool use.",
    researchQuestion: "What takes up most of their time, and why don't they use the AI summary?",
  },
  readers: {
    id: "readers",
    name: "Readers and searchers",
    why: "Search and text export dominate; they almost never sign.",
    researchQuestion: "What are they looking for in documents that they can't find?",
  },
  compliance: {
    id: "compliance",
    name: "Compliance",
    why: "Redaction and version comparison dominate.",
    researchQuestion: "What is missing for them in version comparison and redaction?",
  },
  tried_ai: {
    id: "tried_ai",
    name: "Tried AI, then quit",
    why: "Used the AI summary once or twice, last time more than 14 days ago, regardless of role.",
    researchQuestion: "What went wrong with the AI summary when they tried it?",
  },
  new: {
    id: "new",
    name: "New and inactive",
    why: "Fewer than 10 tool uses or a first visit in the last 7 days, with no clear pattern.",
    researchQuestion: "What did they expect from the tool when they started using it?",
  },
};

export const SEGMENT_ORDER: SegmentId[] = ["signers", "readers", "compliance", "tried_ai", "new"];

export const NAMES_FILE = path.join(process.cwd(), "data", "segment-names.json");
export type SegmentNames = Partial<Record<SegmentId, { name: string; researchQuestion: string }>>;

function loadNames(): SegmentNames {
  try {
    return JSON.parse(fs.readFileSync(NAMES_FILE, "utf8")) as SegmentNames;
  } catch {
    return {};
  }
}

export const isSegmentId = (id: string): id is SegmentId => id in SEGMENT_DEFS;

/** Group definition: the rule from code + the name and question Claude gave (if any). */
export function segmentDef(id: string): Omit<Segment, "userIds"> {
  const base = SEGMENT_DEFS[isSegmentId(id) ? id : "new"];
  const named = loadNames()[base.id as SegmentId];
  return named ? { ...base, name: named.name, researchQuestion: named.researchQuestion } : base;
}

const n = (s: UserStats, f: string) => s.counts[f]?.n ?? 0;

/**
 * Rules, in order:
 * 1. Tried AI, then quit (cuts across roles).
 * 2. New and inactive: few uses or new, with no dominant pattern (>50%).
 *    A new person who is already clearly a signer (e.g. the live demo) goes to Signers.
 * 3. The group with a share > 50%, otherwise the group with the largest share.
 */
export function classify(s: UserStats, now = Date.now()): { segmentId: SegmentId; why: string } {
  if (triedAndQuit(s, "ai_summary", now)) return { segmentId: "tried_ai", why: SEGMENT_DEFS.tried_ai.why };

  const total = Math.max(1, s.total);
  const shares: [SegmentId, number][] = [
    ["signers", (n(s, "sign") + n(s, "fill_form")) / total],
    ["readers", (n(s, "search") + n(s, "export_text")) / total],
    ["compliance", (n(s, "redact") + n(s, "compare")) / total],
  ];
  shares.sort((a, b) => b[1] - a[1]);
  const [topId, topShare] = shares[0];
  const pct = Math.round(topShare * 100);

  const isNew = s.total < 10 || daysAgo(s.firstSeen, now) < 7;
  if (isNew && topShare <= 0.5) return { segmentId: "new", why: SEGMENT_DEFS.new.why };
  if (s.total === 0) return { segmentId: "new", why: SEGMENT_DEFS.new.why };

  return { segmentId: topId, why: `${SEGMENT_DEFS[topId].why} (${pct}% of tool uses)` };
}

export function buildSegments(cache: EventCache, now = Date.now()): Segment[] {
  const byId = new Map<SegmentId, string[]>(SEGMENT_ORDER.map((id) => [id, []]));
  for (const userId of listUserIds(cache)) {
    const s = getStats(cache, userId, now);
    if (s) byId.get(classify(s, now).segmentId)!.push(userId);
  }
  return SEGMENT_ORDER.map((id) => ({ ...segmentDef(id), userIds: byId.get(id)! }));
}
