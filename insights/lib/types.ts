// Ugovor između delova (A ↔ B ↔ C). Ne menjati bez dogovora.

export type Fact = { id: string; text: string };
export type Profile = { userId: string; role: string; segmentId: string; facts: Fact[] };
export type Segment = { id: string; name: string; why: string; researchQuestion: string; userIds: string[] };
export type InterviewResult = { userId: string; summary: string; mainReason: string;
  reasons: string[]; quotes: string[]; sentiment: "neg" | "neu" | "pos";
  suggestedChange: string; factsUsed: string[]; simulated: boolean };

// ---- Pomoćni oblici (interni za A; nisu deo ugovora) ----

/** Jedan red iz HogQL upita „upotreba svakog alata po osobi“. */
export type UsageRow = { distinct_id: string; feature: string; n: number; first_used: string; last_used: string };
/** Jedan red iz upita „uloga i aktivnost po osobi“. */
export type PersonRow = { distinct_id: string; role: string; name: string; opened: number; first_seen: string; last_seen: string };
/** Današnja aktivnost: događaj (+ alat) po vrsti dokumenta. */
export type TodayRow = { distinct_id: string; event: string; feature: string; doc_kind: string; n: number };

export type EventCache = {
  fetchedAt: string;
  source: "posthog" | "seed-local";
  usage: UsageRow[];
  people: PersonRow[];
  today: TodayRow[];
};

export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Sačuvan intervju: rezultat iz ugovora + transkript. */
export type InterviewRecord = {
  result: InterviewResult;
  transcript: ChatMessage[];
  completedAt: string;
  segmentId?: string;
  /** Kad je rezultat upisan u PostHog (ai_interview_completed + $set). */
  posthogSentAt?: string;
  posthogError?: string;
  /** Samo za simulirane: razlog koji je „korisnik“ imao, za proveru tačnosti intervjua. */
  hiddenReason?: string;
};
