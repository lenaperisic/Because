import { captureInterview } from "./capture";
import { summarize } from "./interview";
import { segmentDef } from "./segments";
import { saveInterview } from "./store";
import type { ChatMessage, InterviewRecord, Profile } from "./types";

/**
 * Kraj intervjua (pravog ili simuliranog): strukturisan rezultat -> data/results/<userId>.json
 * -> upis nazad u PostHog (ai_interview_completed + $set ai_segment, ai_main_reason...).
 * Ako PostHog zakaže, rezultat je ipak sačuvan, a greška piše u zapisu.
 */
export async function finishInterview(
  profile: Profile,
  transcript: ChatMessage[],
  opts: { simulated?: boolean; hiddenReason?: string; writeBack?: boolean } = {},
): Promise<InterviewRecord> {
  const result = await summarize(profile, transcript, opts.simulated ?? false);
  const seg = segmentDef(profile.segmentId);
  const posthog = opts.writeBack === false ? undefined : await captureInterview(result, seg.id, seg.name);
  return saveInterview(result, transcript, { segmentId: seg.id, posthog, hiddenReason: opts.hiddenReason });
}
