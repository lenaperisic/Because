import { NextResponse } from "next/server";
import { nameSegments } from "@/lib/naming";
import { loadCache } from "@/lib/posthog";

export const dynamic = "force-dynamic";

/** Claude imenuje grupe i formuliše istraživačka pitanja (članstvo ostaje po pravilima iz koda). */
export async function POST() {
  try {
    return NextResponse.json(await nameSegments(loadCache()));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
