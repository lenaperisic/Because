import { z } from "zod";
import { FEATURES, label } from "./features";
import { getStats } from "./facts";
import { complete } from "./llm";
import { writeJson } from "./posthog";
import { buildSegments, NAMES_FILE, SEGMENT_DEFS, SEGMENT_ORDER, type SegmentNames } from "./segments";
import type { EventCache } from "./types";

// Claude gives each group a name and a research question. Membership is still decided by the rules
// in code (lib/segments.ts); the model only sees aggregate numbers per group, not individuals.

const NamesSchema = z.object({
  segments: z.array(z.object({
    id: z.enum(SEGMENT_ORDER as [string, ...string[]]),
    name: z.string().describe("Short group name (2–4 words), clear to a product team."),
    research_question: z.string().describe("One open research question: what we want to learn about WHY."),
  })),
});

/** Aggregate description of a group, computed by code: size, roles, share of each tool. */
function describe(cache: EventCache) {
  return buildSegments(cache).map((s) => {
    const roles = new Map<string, number>();
    const feat = new Map<string, number>();
    let total = 0;
    for (const id of s.userIds) {
      const st = getStats(cache, id);
      if (!st) continue;
      roles.set(st.role || "?", (roles.get(st.role || "?") ?? 0) + 1);
      for (const f of FEATURES) feat.set(f, (feat.get(f) ?? 0) + (st.counts[f]?.n ?? 0));
      total += st.total;
    }
    const mix = [...roles].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(", ");
    const shares = [...feat].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
      .map(([f, n]) => `${label(f)} ${Math.round((100 * n) / Math.max(1, total))}%`).join(", ");
    return `- id: ${s.id}\n  rule: ${SEGMENT_DEFS[s.id as keyof typeof SEGMENT_DEFS].why}\n  people: ${s.userIds.length} (${mix || "—"})\n  tool share: ${shares || "—"}\n  working name: ${SEGMENT_DEFS[s.id as keyof typeof SEGMENT_DEFS].name}`;
  }).join("\n");
}

export async function nameSegments(cache: EventCache): Promise<SegmentNames> {
  const out = await complete({
    instructions: "You are a user experience researcher. You return only JSON that follows the given schema.",
    maxTokens: 4000,
    effort: "medium",
    schema: NamesSchema,
    schemaName: "segment_names",
    turns: [{
      role: "user",
      content: `Users of the Folio PDF tool are sorted into behavior groups (rules in code, last 30 days):

${describe(cache)}

For each group, give a short name and one research question for the AI interview. The name describes behavior, not occupation (the groups deliberately cut across roles). The question is open, not leading, and asks for a reason ("why"/"what"). Write in English.`,
    }],
  });
  const names: SegmentNames = {};
  for (const s of out.segments) {
    names[s.id as keyof SegmentNames] = { name: s.name, researchQuestion: s.research_question };
  }
  writeJson(NAMES_FILE, names);
  return names;
}
