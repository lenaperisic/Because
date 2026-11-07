import { NextResponse } from "next/server";
import { isSegmentId } from "@/lib/segments";
import { loadSynthesis } from "@/lib/store";
import { synthesize } from "@/lib/synthesis";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ segmentId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { segmentId } = await params;
  return NextResponse.json(loadSynthesis(segmentId));
}

/** Napravi (ponovo) sintezu razloga za grupu iz sačuvanih intervjua. */
export async function POST(_req: Request, { params }: Ctx) {
  const { segmentId } = await params;
  if (!isSegmentId(segmentId)) return NextResponse.json({ error: `Nepoznata grupa ${segmentId}` }, { status: 404 });
  try {
    return NextResponse.json(await synthesize(segmentId));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
