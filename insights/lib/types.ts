// Contract between the parts (A ↔ B ↔ C). Do not change without agreement.

export type Fact = { id: string; text: string };
export type Profile = { userId: string; role: string; segmentId: string; facts: Fact[] };
export type Segment = { id: string; name: string; why: string; researchQuestion: string; userIds: string[] };
export type InterviewResult = { userId: string; summary: string; mainReason: string;
  reasons: string[]; quotes: string[]; sentiment: "neg" | "neu" | "pos";
  suggestedChange: string; factsUsed: string[]; simulated: boolean };

// ---- Helper shapes (internal to A; not part of the contract) ----

/** One row from the HogQL query "use of each tool per person". */
export type UsageRow = { distinct_id: string; feature: string; n: number; first_used: string; last_used: string };
/** One row from the query "role and activity per person". */
export type PersonRow = { distinct_id: string; role: string; name: string; opened: number; first_seen: string; last_seen: string };
/** Today's activity: event (+ tool) per document type. */
export type TodayRow = { distinct_id: string; event: string; feature: string; doc_kind: string; n: number };

export type EventCache = {
  fetchedAt: string;
  source: "posthog" | "seed-local";
  usage: UsageRow[];
  people: PersonRow[];
  today: TodayRow[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Saved interview: the contract result + transcript. */
export type InterviewRecord = {
  result: InterviewResult;
  transcript: ChatMessage[];
  completedAt: string;
  segmentId?: string;
  /** When the result was written to PostHog (ai_interview_completed + $set). */
  posthogSentAt?: string;
  posthogError?: string;
  /** Simulated only: the reason the "user" had, to check how accurate the interview was. */
  hiddenReason?: string;
};
