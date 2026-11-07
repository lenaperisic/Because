import { z } from "zod";
import { FEATURES, label } from "./features";
import { getStats } from "./facts";
import { complete } from "./llm";
import { writeJson } from "./posthog";
import { buildSegments, NAMES_FILE, SEGMENT_DEFS, SEGMENT_ORDER, type SegmentNames } from "./segments";
import type { EventCache } from "./types";

// Claude daje ime i istraživačko pitanje svakoj grupi. Članstvo i dalje određuju pravila
// iz koda (lib/segments.ts); model vidi samo zbirne brojeve po grupi, ne pojedince.

const NamesSchema = z.object({
  segments: z.array(z.object({
    id: z.enum(SEGMENT_ORDER as [string, ...string[]]),
    name: z.string().describe("Kratko ime grupe (2–4 reči), razumljivo produkt timu."),
    research_question: z.string().describe("Jedno otvoreno istraživačko pitanje: šta želimo da saznamo ZAŠTO."),
  })),
});

/** Zbirni opis grupe koji računa kod: veličina, uloge, udeo svakog alata. */
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
    return `- id: ${s.id}\n  pravilo: ${SEGMENT_DEFS[s.id as keyof typeof SEGMENT_DEFS].why}\n  osoba: ${s.userIds.length} (${mix || "—"})\n  udeo alata: ${shares || "—"}\n  radno ime: ${SEGMENT_DEFS[s.id as keyof typeof SEGMENT_DEFS].name}`;
  }).join("\n");
}

export async function nameSegments(cache: EventCache): Promise<SegmentNames> {
  const out = await complete({
    instructions: "Ti si istraživač korisničkog iskustva. Vraćaš isključivo JSON po zadatoj šemi.",
    maxTokens: 4000,
    effort: "medium",
    schema: NamesSchema,
    schemaName: "segment_names",
    turns: [{
      role: "user",
      content: `Korisnici PDF alata Folio su razvrstani u grupe po ponašanju (pravila iz koda, poslednjih 30 dana):

${describe(cache)}

Za svaku grupu daj kratko ime i jedno istraživačko pitanje za AI intervju. Ime opisuje ponašanje, ne zanimanje (grupe namerno presecaju uloge). Pitanje je otvoreno, nije sugestivno i traži razlog („zašto“/„šta“). Srpski, latinica.`,
    }],
  });
  const names: SegmentNames = {};
  for (const s of out.segments) {
    names[s.id as keyof SegmentNames] = { name: s.name, researchQuestion: s.research_question };
  }
  writeJson(NAMES_FILE, names);
  return names;
}
