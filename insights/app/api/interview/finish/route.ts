import { NextResponse } from "next/server";
import { z } from "zod";
import { ConsentDeclinedError, summarize } from "@/lib/interview";
import { getProfile } from "@/lib/profiles";
import { saveInterview } from "@/lib/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(40),
});

/** End of the interview: a structured result, saved in data/results/<userId>.json. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { userId, messages } = parsed.data;
  const profile = await getProfile(userId);
  if (!profile) return NextResponse.json({ error: `No person ${userId}` }, { status: 404 });
  try {
    const result = await summarize(profile, messages);
    const record = await saveInterview(result, messages, { segmentId: profile.segmentId });
    // The response body is InterviewResult (the contract); the PostHog write status goes in a header.
    return NextResponse.json(result, {
      headers: { "X-Posthog": record.posthogSentAt ? "sent" : "skipped" },
    });
  } catch (e) {
    // Without consent nothing is saved or sent to PostHog.
    if (e instanceof ConsentDeclinedError) return NextResponse.json({ declined: true });
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
