import type { InterviewResult } from "./types";

// Upis nazad u PostHog: događaj + osobine osobe ($set), preko capture endpointa sa project tokenom.
// Posle toga produkt tim u PostHogu pravi kohortu po `ai_main_reason` bez ijedne linije koda.

export type CaptureStatus = { sent: boolean; error?: string };

export function posthogWriteConfigured() {
  return Boolean(process.env.POSTHOG_KEY);
}

export async function captureInterview(result: InterviewResult, segmentId: string): Promise<CaptureStatus> {
  if (!posthogWriteConfigured()) return { sent: false, error: "POSTHOG_KEY nije postavljen" };
  const host = (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  const now = new Date().toISOString();
  const body = {
    api_key: process.env.POSTHOG_KEY,
    event: "ai_interview_completed",
    distinct_id: result.userId,
    timestamp: now,
    properties: {
      segment: segmentId,
      main_reason: result.mainReason,
      reasons: result.reasons,
      sentiment: result.sentiment,
      suggested_change: result.suggestedChange,
      facts_used: result.factsUsed,
      simulated: result.simulated,
      $set: {
        ai_segment: segmentId,
        ai_main_reason: result.mainReason,
        ai_sentiment: result.sentiment,
        ai_suggested_change: result.suggestedChange,
        ai_interview_simulated: result.simulated,
        ai_interviewed_at: now,
      },
    },
  };
  try {
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { sent: false, error: `PostHog ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
