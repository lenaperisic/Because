import { NextResponse } from "next/server";
import { z } from "zod";
import { summarize } from "@/lib/interview";
import { getProfile } from "@/lib/profiles";
import { saveInterview } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40),
});

/** Kraj intervjua: strukturisan rezultat, sačuvan u data/results/<userId>.json. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtev" }, { status: 400 });
  const { userId, messages } = parsed.data;
  const profile = await getProfile(userId);
  if (!profile) return NextResponse.json({ error: `Nema osobe ${userId}` }, { status: 404 });
  try {
    const result = await summarize(profile, messages);
    const record = await saveInterview(result, messages, { segmentId: profile.segmentId });
    // Telo odgovora je InterviewResult (ugovor); status upisa u PostHog ide u zaglavlje.
    return NextResponse.json(result, {
      headers: { "X-Posthog": record.posthogSentAt ? "sent" : "skipped" },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
