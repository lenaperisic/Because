import { NextResponse } from "next/server";
import { refreshFromPosthog } from "@/lib/posthog";

export const dynamic = "force-dynamic";

/** Dugme „Osveži iz PostHoga“: povuče sve ponovo i prepiše keš. */
export async function POST() {
  try {
    const c = await refreshFromPosthog();
    return NextResponse.json({ ok: true, fetchedAt: c.fetchedAt, people: c.people.length, usageRows: c.usage.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
