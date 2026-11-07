import { NextResponse } from "next/server";
import { z } from "zod";
import { finishInterview } from "@/lib/finish";
import { getProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40),
});

/** Kraj intervjua: strukturisan rezultat, sačuvan u data/results/<userId>.json i upisan nazad u PostHog. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtev" }, { status: 400 });
  const { userId, messages } = parsed.data;
  const profile = await getProfile(userId);
  if (!profile) return NextResponse.json({ error: `Nema osobe ${userId}` }, { status: 404 });
  try {
    const record = await finishInterview(profile, messages);
    return NextResponse.json({ ...record.result, posthog: record.posthog });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
