// Simulated interviews for the per-group synthesis. A second Claude plays a user with a HIDDEN reason;
// the interviewer is the same as live (lib/interview.ts). Every result has simulated: true.
//
//   npm run simulate -- --per 8                 # 8 per group (5 groups = 40 interviews)
//   npm run simulate -- --per 1 --segment new   # quick test
//   npm run simulate -- --per 8 --no-posthog    # without writing to PostHog
//   npm run simulate -- --per 8 --overwrite     # redo people who already have a result
//
// At the end it prints how often the main reason was hit (compared with the hidden reason).

import { loadEnv } from "../lib/env";
loadEnv();

const { buildProfile } = await import("../lib/facts");
const { loadCache } = await import("../lib/posthog");
const { isSample } = await import("../lib/sample");
const { buildSegments, segmentDef } = await import("../lib/segments");
const { CONSENT_MESSAGE, nextReply, summarize, MAX_QUESTIONS } = await import("../lib/interview");
const { complete, provider } = await import("../lib/llm");
const { loadInterview, saveInterview } = await import("../lib/store");
type Profile = import("../lib/types").Profile;
type ChatMessage = import("../lib/types").ChatMessage;
type SegmentId = import("../lib/segments").SegmentId;

const arg = (name: string, def: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PER = Number(arg("per", "8"));
const ONLY = arg("segment", "");
const CONCURRENCY = Number(arg("parallel", "3"));
const SEND = !process.argv.includes("--no-posthog");
const OVERWRITE = process.argv.includes("--overwrite");

// Hidden reasons per group: varied, so the synthesis has something to group. Some people share a reason.
const HIDDEN: Record<SegmentId, string[]> = {
  signers: [
    "You don't trust the AI summary for lab reports: if it misses a single value, you are the one responsible, so you read everything anyway.",
    "Most of your time goes into retyping patient details into referrals by hand; the AI summary doesn't help with that.",
    "You didn't even know the AI summary existed; the button never caught your eye.",
    "Hospital policy doesn't allow sending patient reports to AI tools because of data privacy.",
    "Signing takes long because you have to open every document separately; you want to sign several at once.",
  ],
  readers: [
    "Search doesn't find terms in tables and scanned pages, so you export the text and search in an editor.",
    "You need to search across several documents at once, but Folio only searches one.",
    "Text export breaks the formatting of code and tables, so you waste time cleaning it up.",
    "You would try the AI summary, but you want answers to specific questions about the document, not a general summary.",
  ],
  compliance: [
    "Version comparison doesn't show changes in tables and numbers, and that is where the most important contract changes are.",
    "You have to redact by hand on every page; you want it to find personal ID numbers and account numbers automatically.",
    "Auditors ask for proof of what was redacted and who did it, and Folio doesn't record that.",
    "Comparison doesn't work when one version is a scan, so you compare by hand.",
  ],
  tried_ai: [
    "The AI summary made up a detail that wasn't in the document, and you haven't trusted it since.",
    "The summary was too generic and too long; it's faster to skim the document yourself.",
    "The summary got the terminology wrong and read like a bad machine translation.",
    "It took half a minute to load, so you gave up.",
  ],
  new: [
    "You expected a simple reader; too many tools confuse you and you don't know where to start.",
    "You only use Folio to read lecture notes; comments are enough and you don't need more.",
    "You switched from another tool and look for the shortcuts you're used to, but they aren't there.",
    "You don't have much PDF work this month; the problem isn't the tool.",
  ],
};

function personaPrompt(profile: Profile, hidden: string) {
  const facts = profile.facts.map((f) => `- ${f.text}`).join("\n");
  return `You are playing a user of the Folio PDF tool in an interview run by an AI researcher. Answer in English, like a real person: briefly (1–3 sentences), sometimes vaguely, without lists and without formatting.

Your role: ${profile.role}.
What you actually did in the tool (you don't have to mention all of it):
${facts}

Your real reason (don't say it word for word right away; reveal it gradually, when you are asked the right question): ${hidden}

Agree when asked for consent. Don't invent activities that contradict the facts. Don't say you are an AI.`;
}

/** History from the persona's point of view: the interviewer is "user", the persona is "assistant". */
function personaTurns(history: ChatMessage[]) {
  return [
    { role: "user" as const, content: CONSENT_MESSAGE },
    ...history.map((m) => ({ role: m.role === "user" ? ("assistant" as const) : ("user" as const), content: m.content })),
  ];
}

async function runOne(profile: Profile, hidden: string) {
  const history: ChatMessage[] = [];
  const persona = personaPrompt(profile, hidden);
  for (let turn = 0; turn <= MAX_QUESTIONS + 1; turn++) {
    const answer = await complete({ instructions: persona, turns: personaTurns(history), maxTokens: 1000, effort: "low" });
    history.push({ role: "user", content: answer });
    const { reply, done } = await nextReply(profile, history);
    history.push({ role: "assistant", content: reply });
    if (done) break;
  }
  const result = await summarize(profile, history, true);
  const record = await saveInterview(result, history, { segmentId: profile.segmentId, hiddenReason: hidden, sendToPosthog: SEND });
  return { result, record, turns: history.length };
}

/** Rough: does the main reason share at least two meaningful words with the hidden reason. For a quick look, not a metric. */
function roughlyMatches(mainReason: string, hidden: string) {
  const words = (s: string) => new Set(s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").match(/[a-z]{5,}/g) ?? []);
  const a = words(mainReason), b = words(hidden);
  let common = 0;
  for (const w of a) if ([...b].some((x) => x.slice(0, 5) === w.slice(0, 5))) common++;
  return common >= 2;
}

async function main() {
  const cache = loadCache();
  const jobs: { profile: Profile; hidden: string }[] = [];
  for (const seg of buildSegments(cache)) {
    if (ONLY && seg.id !== ONLY) continue;
    const reasons = HIDDEN[seg.id as SegmentId];
    const candidates = seg.userIds.filter((id) => isSample(id) && (OVERWRITE || !loadInterview(id)));
    candidates.slice(0, PER).forEach((id, i) => {
      const profile = buildProfile(cache, id);
      if (profile) jobs.push({ profile, hidden: reasons[i % reasons.length] });
    });
  }
  console.log(`Model via: ${provider()} · ${jobs.length} interviews · ${CONCURRENCY} in parallel · PostHog: ${SEND ? "yes" : "no"}`);

  let ok = 0, failed = 0, matched = 0;
  const queue = [...jobs];
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const name = `${job.profile.userId} (${segmentDef(job.profile.segmentId).name})`;
      const t = Date.now();
      try {
        const { result, record, turns } = await runOne(job.profile, job.hidden);
        const hit = roughlyMatches(result.mainReason, job.hidden);
        ok++; if (hit) matched++;
        console.log(`✓ ${name} · ${turns} messages · ${Math.round((Date.now() - t) / 1000)} s · PostHog: ${record.posthogSentAt ? "yes" : "no"}${hit ? "" : " · reason differs"}\n    reason: ${result.mainReason}\n    hidden: ${job.hidden}`);
      } catch (e) {
        failed++;
        console.error(`✗ ${name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  console.log(`\nDone: ${ok} succeeded, ${failed} failed. Main reason roughly hit in ${matched}/${ok} (check the ones that differ by hand).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
