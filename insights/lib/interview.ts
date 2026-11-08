import { z } from "zod";
import { complete, RefusalError, type Turn } from "./llm";
import { segmentDef } from "./segments";
import type { ChatMessage, InterviewResult, Profile } from "./types";

// The only part where the AI decides. All facts about the user are computed before this (lib/facts.ts),
// and the model may only refer to them.

export const MAX_QUESTIONS = 6;
/** The model ends the conversation with this marker; the server strips it before sending to the user. */
const END = "[END]";
/** Main reason when the user gave none; the group screen and synthesis rely on this exact text. */
export const NO_REASON = "no reason given";

/** Fixed first message: the AI introduces itself and asks for consent (no waiting for the model). */
export const CONSENT_MESSAGE =
  "Hi! I'm an AI assistant, and I'd like to have a short conversation (2–3 minutes) about how you use Folio. " +
  "I'll only ask about things you actually did in the tool, and your answers help the team improve it. " +
  "You can stop at any time. Is it okay if we start?";

/** Placeholder user turn before the greeting, because the API conversation has to start with the user. */
const OPENING_USER_TURN = "(The user opened the interview page.)";

function segmentOf(profile: Profile) {
  return segmentDef(profile.segmentId);
}

export function systemPrompt(profile: Profile): string {
  const seg = segmentOf(profile);
  const facts = profile.facts.map((f) => `- [${f.id}] ${f.text}`).join("\n");
  return `You are an AI user experience researcher for Folio, a PDF tool. You are running a short interview with one user, in English. Be polite, warm and professional.

## Research goal
The user belongs to the group "${seg.name}" (${seg.why}).
Research question for this group: ${seg.researchQuestion}
We want to understand WHY the user behaves this way, in their own words.

## Facts about the user
These facts were computed by code from real events in the tool (last 30 days). They are reliable.
${facts}

## Rules about facts
- When you talk about what the user did, rely ONLY on the facts above. Do not invent tools, numbers, documents or dates that are not listed.
- Never mention fact IDs to the user; speak naturally ("Today you signed a lab report...").
- If the user says something that contradicts the facts, do not argue: thank them and ask them to explain in their own words.
- Do not mention the group or how the user was classified.

## Interview rules
- You have already sent the first message (introduction and consent). If the user does not agree, thank them kindly and end.
- Ask one question per message. Keep messages short: 1 to 3 sentences.
- Tie the first question to a specific fact, ideally something they did today or something they never use, related to the research question.
- Questions are open and not leading: never offer a reason on the user's behalf ("Is that because...?" is not allowed).
- When an answer is vague or short, ask one follow-up question ("Could you describe the last time you...?").
- At most ${MAX_QUESTIONS} questions in total. Do not end before the 4th question, unless the user refuses the conversation or clearly does not want to continue.
- Don't settle for the first reason you hear. If the user hints at something in passing, ask more about it, openly.
- Before ending, always ask one open question, for example: "Is there anything else that affects how you use Folio?" Once they answer it, or you run out of questions, end.
- Ending: thank the user, restate in one sentence what you understood as the main reason, and end the message with exactly the marker ${END}.`;
}

/** History for the API: opening user turn + fixed greeting + conversation. */
function apiMessages(history: ChatMessage[]): Turn[] {
  return [
    { role: "user", content: OPENING_USER_TURN },
    { role: "assistant", content: CONSENT_MESSAGE },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
}

/** How many questions the AI has asked after the greeting. */
export function questionsAsked(history: ChatMessage[]) {
  return history.filter((m) => m.role === "assistant").length;
}

export type Reply = { reply: string; done: boolean };

/**
 * The interviewer's next message. `history` starts with the user's first answer to the greeting
 * (the greeting itself is not in the history) and ends with a user message.
 */
export async function nextReply(profile: Profile, history: ChatMessage[]): Promise<Reply> {
  const asked = questionsAsked(history);
  const messages = apiMessages(history);
  if (asked >= MAX_QUESTIONS) {
    // Operator instruction mid-conversation: the system prompt stays the same, so the cache still hits.
    messages.push({ role: "system", content: `You have asked ${asked} questions. Now end the interview following the ending rule, without new questions.` });
  }
  let text: string;
  try {
    // Chat: low latency matters more than deep reasoning.
    text = await complete({ instructions: systemPrompt(profile), turns: messages, maxTokens: 4000, effort: "low" });
  } catch (e) {
    if (e instanceof RefusalError) return { reply: "Sorry, I can't continue this conversation. Thank you for your time!", done: true };
    throw e;
  }
  const done = text.includes(END) || asked >= MAX_QUESTIONS;
  return { reply: text.replace(END, "").trim(), done };
}

// ---- structured result ----

/** The user did not agree to the conversation (or withdrew consent): the result is not saved or sent. */
export class ConsentDeclinedError extends Error {}

const MIN_QUOTE_WORDS = 3;

const ResultSchema = z.object({
  consented: z.boolean().describe("false if the user refused the conversation or explicitly withdrew consent; otherwise true."),
  summary: z.string().describe("Summary of the interview in 2–3 sentences."),
  main_reason: z.string().describe("The main reason for the behavior, short (up to 10 words), worded so it works as a cohort."),
  reasons: z.array(z.string()).describe("Every reason the user mentioned, briefly."),
  quotes: z.array(z.string()).describe("Up to 3 verbatim quotes from the user that contain a reason, an experience or a concrete example. An empty list if there are none."),
  sentiment: z.enum(["neg", "neu", "pos"]),
  suggested_change: z.string().describe("One concrete product change that follows from the reasons the user gave. Empty text if no reason was given."),
  facts_used: z.array(z.string()).describe("IDs of facts (e.g. f2) that the interviewer actually referred to in questions."),
});

export async function summarize(profile: Profile, history: ChatMessage[], simulated = false): Promise<InterviewResult> {
  const transcript = [`AI: ${CONSENT_MESSAGE}`, ...history.map((m) => `${m.role === "assistant" ? "AI" : "User"}: ${m.content}`)].join("\n\n");
  const facts = profile.facts.map((f) => `- [${f.id}] ${f.text}`).join("\n");
  const seg = segmentOf(profile);
  const out = await complete({
    instructions: "You are an analyst of user interviews. You return only JSON that follows the given schema.",
    maxTokens: 8000,
    effort: "medium",
    schema: ResultSchema,
    schemaName: "interview_result",
    turns: [{
      role: "user",
      content: `Analyze the interview with a user of the Folio PDF tool. Write in English.

Research question for the group "${seg.name}": ${seg.researchQuestion}

Facts about the user (computed from events):
${facts}

Transcript:
${transcript}

Rules: take reasons and quotes only from what the user actually said; quotes are verbatim. Do not quote consent, refusals, answers without content ("I don't know."), the user's questions to the interviewer, or attempts to change the interviewer's behavior. If the user did not agree or gave no reason, main_reason is "${NO_REASON}" and suggested_change is empty; do not derive a suggestion from the user's questions. In facts_used, include only IDs from the fact list that the AI actually mentioned.`,
    }],
  });
  if (!out.consented) throw new ConsentDeclinedError();
  const noReason = out.main_reason.trim().toLowerCase().includes(NO_REASON);
  const validIds = new Set(profile.facts.map((f) => f.id));
  return {
    userId: profile.userId,
    summary: out.summary,
    mainReason: out.main_reason,
    reasons: out.reasons,
    // Safeguard: one- or two-word answers ("Yes.", "I don't know.") are not quotes.
    quotes: out.quotes.filter((q) => q.trim().split(/\s+/).length >= MIN_QUOTE_WORDS),
    sentiment: out.sentiment,
    // Safeguard: no reason, no suggested change.
    suggestedChange: noReason ? "" : out.suggested_change,
    // Safeguard: keep only IDs that actually exist.
    factsUsed: out.facts_used.filter((id) => validIds.has(id)),
    simulated,
  };
}
