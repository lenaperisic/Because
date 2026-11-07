import { z } from "zod";
import { complete } from "./llm";
import { segmentDef } from "./segments";
import { listInterviews, saveSynthesis } from "./store";
import type { InterviewRecord, SegmentSynthesis } from "./types";

// Sinteza razloga po grupi: Claude grupiše glavne razloge iz sačuvanih intervjua u teme,
// sa doslovnim citatima. Broj intervjua i broj simuliranih računa kod, ne model.

const SynthesisSchema = z.object({
  headline: z.string().describe("Jedna rečenica: najvažniji uvid za produkt tim."),
  themes: z.array(z.object({
    reason: z.string().describe("Tema/razlog, kratko (do 10 reči)."),
    interview_numbers: z.array(z.number().int()).describe("Redni brojevi intervjua (#) u kojima se tema javlja."),
    quotes: z.array(z.string()).describe("1–2 doslovna citata iz tih intervjua."),
  })).describe("Teme od najčešće ka najređoj, najviše 5."),
  suggested_changes: z.array(z.string()).describe("Do 3 konkretne promene proizvoda, od najvažnije."),
});

/** Intervjui jedne grupe (grupa u trenutku intervjua; stari zapisi bez nje se preskaču). */
export function interviewsFor(segmentId: string, all = listInterviews()): InterviewRecord[] {
  return all.filter((r) => r.segmentId === segmentId).sort((a, b) => a.completedAt.localeCompare(b.completedAt));
}

export async function synthesize(segmentId: string): Promise<SegmentSynthesis> {
  const seg = segmentDef(segmentId);
  const records = interviewsFor(seg.id);
  if (records.length === 0) throw new Error(`Grupa „${seg.name}“ još nema intervjua.`);

  const block = records.map((r, i) => {
    const x = r.result;
    return `#${i + 1}${x.simulated ? " (simulirano)" : ""}
Glavni razlog: ${x.mainReason}
Razlozi: ${x.reasons.join("; ") || "—"}
Citati: ${x.quotes.map((q) => `„${q}“`).join(" ") || "—"}
Predlog: ${x.suggestedChange}`;
  }).join("\n\n");

  const out = await complete({
    instructions: "Ti si istraživač korisničkog iskustva. Sintetišeš intervjue u teme. Vraćaš isključivo JSON po zadatoj šemi.",
    maxTokens: 8000,
    effort: "medium",
    schema: SynthesisSchema,
    schemaName: "segment_synthesis",
    turns: [{
      role: "user",
      content: `Grupa korisnika PDF alata Folio: „${seg.name}“ (${seg.why}).
Istraživačko pitanje: ${seg.researchQuestion}

Rezultati intervjua (${records.length}):

${block}

Grupiši razloge u teme. Citati moraju biti doslovno preuzeti iz gornjih citata. Ne izmišljaj razloge kojih nema. Piši na srpskom (latinica).`,
    }],
  });

  const quotes = new Set(records.flatMap((r) => r.result.quotes));
  const synthesis: SegmentSynthesis = {
    segmentId: seg.id,
    generatedAt: new Date().toISOString(),
    interviews: records.length,
    simulated: records.filter((r) => r.result.simulated).length,
    headline: out.headline,
    themes: out.themes
      .map((t) => ({
        reason: t.reason,
        // Broj računa kod iz rednih brojeva koji stvarno postoje.
        count: new Set(t.interview_numbers.filter((n) => n >= 1 && n <= records.length)).size,
        // Zaštita: samo citati koji zaista postoje u rezultatima.
        quotes: t.quotes.filter((q) => quotes.has(q.replace(/^[„"]|[“"]$/g, ""))).map((q) => q.replace(/^[„"]|[“"]$/g, "")),
      }))
      .filter((t) => t.count > 0)
      .sort((a, b) => b.count - a.count),
    suggestedChanges: out.suggested_changes,
  };
  saveSynthesis(synthesis);
  return synthesis;
}
