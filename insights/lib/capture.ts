import type { InterviewResult } from "./types";

// Upis nazad u PostHog: događaj `ai_interview_completed` + osobine osobe ($set) preko capture
// endpointa sa project tokenom. Posle toga produkt tim pravi kohorte po `ai_main_reason`
// bez ijedne linije koda.

export type CaptureStatus = { ok: boolean; at: string; error?: string };

export function posthogWriteConfigured() {
  return Boolean(process.env.POSTHOG_KEY);
}

export async function captureInterview(result: InterviewResult, segmentId: string, segmentName: string): Promise<CaptureStatus> {
  const at = new Date().toISOString();
  if (!posthogWriteConfigured()) return { ok: false, at, error: "POSTHOG_KEY nije postavljen" };
  const host = (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
  const person = {
    ai_segment: segmentId,
    ai_segment_name: segmentName,
    ai_main_reason: result.mainReason,
    ai_sentiment: result.sentiment,
    ai_suggested_change: result.suggestedChange,
    ai_interview_simulated: result.simulated,
    ai_interview_at: at,
  };
  try {
    const res = await fetch(`${host}/i/v0/e/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_KEY,
        event: "ai_interview_completed",
        distinct_id: result.userId,
        timestamp: at,
        properties: {
          segment: segmentId,
          segment_name: segmentName,
          main_reason: result.mainReason,
          reasons: result.reasons,
          quotes: result.quotes,
          sentiment: result.sentiment,
          suggested_change: result.suggestedChange,
          summary: result.summary,
          facts_used: result.factsUsed,
          simulated: result.simulated,
          $set: person,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, at, error: `PostHog ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true, at };
  } catch (e) {
    return { ok: false, at, error: e instanceof Error ? e.message : String(e) };
  }
}
