import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const profile = await getProfile(userId, { refresh: req.nextUrl.searchParams.has("refresh") });
  if (!profile) return NextResponse.json({ error: `No person ${userId}` }, { status: 404 });
  return NextResponse.json(profile);
}
