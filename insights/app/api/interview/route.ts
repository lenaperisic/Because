import { NextResponse } from "next/server";
import { z } from "zod";
import { nextReply } from "@/lib/interview";
import { getProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(30),
});

/** The interviewer's next message. `messages` is the conversation after the greeting and ends with the user. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const { userId, messages } = parsed.data;
  if (messages.at(-1)?.role !== "user") return NextResponse.json({ error: "The last message must be from the user" }, { status: 400 });
  const profile = await getProfile(userId);
  if (!profile) return NextResponse.json({ error: `No person ${userId}` }, { status: 404 });
  try {
    return NextResponse.json(await nextReply(profile, messages));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
