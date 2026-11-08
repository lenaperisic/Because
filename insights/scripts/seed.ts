// Seed: ~200 sample people with Folio events over the last 30 days.
//
//   npm run seed              -> sends to PostHog (batch, historical_migration) + local backup
//   npm run seed -- --dry-run -> local backup only (data/seed-backup.json)
//
// Uses per tool = `usage` from the Folio JSON for that role × a random 0.5–1.5,
// so the groups are not perfectly clean. The randomness is deterministic (same seed = same data).

import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../lib/env";
import { SEED_BACKUP_FILE, writeJson } from "../lib/posthog";
import { SAMPLE_PREFIX } from "../lib/sample";
import type { EventCache, PersonRow, TodayRow, UsageRow } from "../lib/types";

loadEnv();

const DRY = process.argv.includes("--dry-run") || !process.env.POSTHOG_KEY;
const HOST = (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;

// ---- deterministic randomness ----
let state = 20261107;
function rand() {
  state |= 0; state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

// ---- roles ----
type Usage = Record<string, number>;
type RoleDef = { id: string; role: string; count: number; usage: Usage; kinds: string[] };

function folioUsage(id: string): Usage {
  const file = path.join(process.cwd(), "..", "folio", "folio", "src", "main", "resources", "data", `${id}.json`);
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { usage: Usage }).usage;
}

// Document types match the `kind` values in Folio's own data.
const ROLES: RoleDef[] = [
  { id: "doctor", role: "Doctor", count: 60, usage: folioUsage("doctor"), kinds: ["Lab report", "Form", "Scan", "Report", "Guidelines"] },
  { id: "developer", role: "Developer", count: 50, usage: folioUsage("developer"), kinds: ["Spec", "RFC", "Invoice", "Contract", "Docs"] },
  { id: "banker", role: "Banker", count: 50, usage: folioUsage("banker"), kinds: ["Contract", "Form", "Financials", "Scan", "Report"] },
  {
    id: "lawyer", role: "Lawyer", count: 20, kinds: ["Contract", "Annex", "Power of attorney", "Judgment"],
    usage: { read: 150, search: 14, annotate: 48, sign: 30, fill_form: 4, ocr: 6, redact: 22, compare: 70, merge: 12, compress: 3, export_text: 4, ai_summary: 0 },
  },
  {
    id: "student", role: "Student", count: 20, kinds: ["Lecture notes", "Paper", "Slides"],
    usage: { read: 18, search: 2, annotate: 4, sign: 0, fill_form: 0, ocr: 0, redact: 0, compare: 0, merge: 1, compress: 1, export_text: 1, ai_summary: 0 },
  },
];

const FIRST = ["Ana", "Marko", "Jelena", "Nikola", "Milica", "Stefan", "Ivana", "Luka", "Teodora", "Vuk", "Sara", "Petar",
  "Mina", "Filip", "Katarina", "Đorđe", "Tamara", "Nemanja", "Jovana", "Aleksa", "Dragana", "Miloš", "Sofija", "Uroš"];
const LAST = ["Jovanović", "Petrović", "Nikolić", "Marković", "Đorđević", "Stojanović", "Ilić", "Stanković", "Pavlović",
  "Milošević", "Popović", "Kostić", "Savić", "Lukić", "Todorović", "Ristić", "Simić", "Kovačević"];

// ---- generation ----
type Ev = { event: string; distinct_id: string; timestamp: string; properties: Record<string, unknown> };

const events: Ev[] = [];
const persons: { id: string; name: string; role: string }[] = [];

function ts(fromDaysAgo: number, toDaysAgo: number) {
  const t = NOW - between(toDaysAgo, fromDaysAgo) * DAY;
  return new Date(Math.min(t, NOW - 60_000)).toISOString();
}

for (const r of ROLES) {
  for (let i = 1; i <= r.count; i++) {
    const id = `${SAMPLE_PREFIX}${r.id}_${String(i).padStart(3, "0")}`;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    persons.push({ id, name, role: r.role });

    // About 10% (and half the students) are new: first visit in the last 1–6 days and less activity.
    const isNew = r.id === "student" ? rand() < 0.5 : rand() < 0.1;
    const span = isNew ? Math.floor(between(1, 6)) : 30;
    const volume = isNew ? span / 30 : 1;

    const usage: Usage = { ...r.usage };

    // Deliberate details from the plan.
    let aiOld = 0; // tried the AI summary 1–2 times 18–24 days ago, then stopped
    if (r.id === "developer") {
      usage.ai_summary = 0;
      if (i <= 15) aiOld = rand() < 0.5 ? 1 : 2;
    }
    if (r.id === "doctor") {
      usage.ai_summary = 0;
      if (i <= 3) aiOld = 1; // "almost nobody"
    }
    if (r.id === "banker") {
      if (i % 3 === 0) usage.ai_summary = Math.round(between(10, 20)); // a third use it regularly
      else { usage.ai_summary = 0; if (i <= 4) aiOld = 1; }
    }
    if (isNew) aiOld = 0;

    const kind = () => pick(r.kinds);
    const add = (event: string, props: Record<string, unknown>, timestamp: string) =>
      events.push({ event, distinct_id: id, timestamp, properties: { ...props, role: r.role, app: "folio-pdf-demo" } });

    const firstTs = ts(span, span - 0.2);
    events.push({ event: "$identify", distinct_id: id, timestamp: firstTs, properties: { $set: { name, role: r.role, title: r.role } } });
    add("app_opened", {}, firstTs);

    for (const [feature, base] of Object.entries(usage)) {
      const count = Math.round(base * between(0.5, 1.5) * volume);
      for (let k = 0; k < count; k++) {
        if (feature === "read") add("document_opened", { doc_kind: kind(), pages: Math.ceil(between(1, 12)) }, ts(span, 0));
        else add("feature_used", { feature, doc_kind: kind() }, ts(span, 0));
      }
    }
    for (let k = 0; k < aiOld; k++) add("feature_used", { feature: "ai_summary", doc_kind: kind() }, ts(24, 18));
  }
}

// ---- local backup in the same shape as the PostHog cache ----
function aggregate(evs: Ev[]): EventCache {
  const usage = new Map<string, UsageRow>();
  const people = new Map<string, PersonRow>();
  const today = new Map<string, TodayRow>();
  const startToday = new Date(NOW); startToday.setHours(0, 0, 0, 0);
  const names = new Map(persons.map((p) => [p.id, p.name]));
  for (const e of evs) {
    if (e.event === "$identify") continue;
    const p = people.get(e.distinct_id) ?? { distinct_id: e.distinct_id, role: String(e.properties.role ?? ""), name: names.get(e.distinct_id) ?? "", opened: 0, first_seen: e.timestamp, last_seen: e.timestamp };
    if (e.timestamp < p.first_seen) p.first_seen = e.timestamp;
    if (e.timestamp > p.last_seen) p.last_seen = e.timestamp;
    if (e.event === "document_opened") p.opened++;
    people.set(e.distinct_id, p);
    if (e.event === "feature_used") {
      const f = String(e.properties.feature);
      const key = `${e.distinct_id}|${f}`;
      const u = usage.get(key) ?? { distinct_id: e.distinct_id, feature: f, n: 0, first_used: e.timestamp, last_used: e.timestamp };
      u.n++;
      if (e.timestamp < u.first_used) u.first_used = e.timestamp;
      if (e.timestamp > u.last_used) u.last_used = e.timestamp;
      usage.set(key, u);
    }
    if (Date.parse(e.timestamp) >= startToday.getTime() && (e.event === "feature_used" || e.event === "document_opened")) {
      const feature = e.event === "feature_used" ? String(e.properties.feature) : "";
      const doc_kind = String(e.properties.doc_kind ?? "");
      const key = `${e.distinct_id}|${e.event}|${feature}|${doc_kind}`;
      const t = today.get(key) ?? { distinct_id: e.distinct_id, event: e.event, feature, doc_kind, n: 0 };
      t.n++;
      today.set(key, t);
    }
  }
  return { fetchedAt: new Date(NOW).toISOString(), source: "seed-local", usage: [...usage.values()], people: [...people.values()], today: [...today.values()] };
}

// ---- sending to PostHog ----
async function sendBatches() {
  const CHUNK = 1000;
  for (let i = 0; i < events.length; i += CHUNK) {
    const batch = events.slice(i, i + CHUNK);
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`${HOST}/batch/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: process.env.POSTHOG_KEY, historical_migration: true, batch }),
      });
      if (res.ok) break;
      const msg = `PostHog batch ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (attempt >= 3) throw new Error(msg);
      console.warn(`${msg} (attempt ${attempt}, retrying)`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
    process.stdout.write(`\r  sent ${Math.min(i + CHUNK, events.length)} / ${events.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  console.log(`Generated: ${persons.length} people, ${events.length} events.`);
  writeJson(SEED_BACKUP_FILE, aggregate(events));
  console.log(`Local backup: ${path.relative(process.cwd(), SEED_BACKUP_FILE)}`);
  if (DRY) {
    console.log(process.env.POSTHOG_KEY ? "--dry-run: nothing was sent to PostHog." : "POSTHOG_KEY is not set: nothing was sent to PostHog.");
    return;
  }
  console.log(`Sending to ${HOST} ...`);
  await sendBatches();
  console.log("Done. PostHog needs a few minutes before the events show up in queries.");
}

main().catch((e) => { console.error(e); process.exit(1); });
