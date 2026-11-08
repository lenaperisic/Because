import { NextResponse, type NextRequest } from "next/server";
import { SEGMENT_DEFS, type SegmentId } from "@/lib/segments";
import { synthesizeSegment } from "@/lib/synthesis";

export const dynamic = "force-dynamic";

/** Sinteza razloga za grupu. Iz keša dok se rezultati ne promene; ?force=1 preskače keš. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!Object.hasOwn(SEGMENT_DEFS, id)) return NextResponse.json({ error: `Nema grupe ${id}` }, { status: 404 });
  try {
    const force = req.nextUrl.searchParams.get("force") === "1";
    return NextResponse.json(await synthesizeSegment(id as SegmentId, { force }));
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
