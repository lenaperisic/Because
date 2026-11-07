import { NextResponse } from "next/server";
import { loadCache } from "@/lib/posthog";
import { buildSegments } from "@/lib/segments";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildSegments(loadCache()));
}
