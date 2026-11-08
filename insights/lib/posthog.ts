import fs from "node:fs";
import path from "node:path";
import type { EventCache, PersonRow, TodayRow, UsageRow } from "./types";

// Reading: PostHog query API (personal key, Query Read).
// Limits: without LIMIT it returns 100 rows (with LIMIT up to 50,000), 240 queries/min, 3 at a time,
// queries up to 10 s. So we run the queries one at a time and cache the result in a file right away.

const DATA_DIR = path.join(process.cwd(), "data");
export const CACHE_FILE = path.join(DATA_DIR, "cache.json");
/** The seed script writes the same shape here, as a backup in case PostHog fails. */
export const SEED_BACKUP_FILE = path.join(DATA_DIR, "seed-backup.json");

/**
 * Events ingested before this moment are ignored. They belong to the earlier Serbian dataset, whose
 * persons were deleted; PostHog removes their events asynchronously (hours to days), and until then
 * they would still show up in queries. Filters on ingestion time (created_at), not on the event timestamp,
 * because the seed back-dates its events over 30 days. Override with POSTHOG_IGNORE_BEFORE (ISO time).
 */
const IGNORE_BEFORE = "2026-11-08T12:30:00Z";
/** Read lazily: scripts load .env.local after their imports run. */
function fresh() {
  const since = new Date(process.env.POSTHOG_IGNORE_BEFORE || IGNORE_BEFORE);
  if (Number.isNaN(since.getTime())) throw new Error(`POSTHOG_IGNORE_BEFORE is not a valid time: ${process.env.POSTHOG_IGNORE_BEFORE}`);
  return `created_at >= toDateTime('${since.toISOString().slice(0, 19).replace("T", " ")}', 'UTC')`;
}

const qUsage = () => `
SELECT distinct_id, properties.feature AS feature, count() AS n,
       min(timestamp) AS first_used, max(timestamp) AS last_used
FROM events
WHERE event = 'feature_used' AND timestamp > now() - INTERVAL 30 DAY AND ${fresh()}
GROUP BY distinct_id, feature
LIMIT 50000`;

const qPeople = () => `
SELECT distinct_id, any(properties.role) AS role, any(person.properties.name) AS name,
       countIf(event = 'document_opened') AS opened,
       min(timestamp) AS first_seen, max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY AND ${fresh()}
  AND event IN ('app_opened', 'profile_switched', 'document_opened', 'feature_used')
GROUP BY distinct_id
LIMIT 50000`;

const qToday = () => `
SELECT distinct_id, event, ifNull(properties.feature, '') AS feature,
       ifNull(properties.doc_kind, '') AS doc_kind, count() AS n
FROM events
WHERE timestamp >= toStartOfDay(now()) AND ${fresh()}
  AND event IN ('document_opened', 'feature_used')
GROUP BY distinct_id, event, feature, doc_kind
LIMIT 50000`;

export function posthogReadConfigured() {
  return Boolean(process.env.POSTHOG_PERSONAL_KEY && process.env.POSTHOG_PROJECT_ID);
}

async function hogql(query: string): Promise<{ columns: string[]; results: unknown[][] }> {
  const host = (process.env.POSTHOG_API_HOST || "https://eu.posthog.com").replace(/\/$/, "");
  const res = await fetch(`${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`PostHog query ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return (await res.json()) as { columns: string[]; results: unknown[][] };
}

/** Turns [columns] + [[row]] into objects. */
function rows<T>(r: { columns: string[]; results: unknown[][] }): T[] {
  return r.results.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])) as T);
}

/** PostHog returns times as ISO strings; just in case, also accept "YYYY-MM-DD HH:MM:SS" (UTC). */
function iso(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const d2 = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d2.getTime()) ? "" : d2.toISOString();
}

/** Pulls everything from PostHog (3 queries, one at a time) and writes the cache. */
export async function refreshFromPosthog(): Promise<EventCache> {
  if (!posthogReadConfigured()) throw new Error("POSTHOG_PERSONAL_KEY and POSTHOG_PROJECT_ID are missing.");
  const usage = rows<UsageRow>(await hogql(qUsage())).map((r) => ({
    ...r, n: Number(r.n), first_used: iso(r.first_used), last_used: iso(r.last_used),
  }));
  const people = rows<PersonRow>(await hogql(qPeople())).map((r) => ({
    ...r, role: r.role ?? "", name: r.name ?? "", opened: Number(r.opened),
    first_seen: iso(r.first_seen), last_seen: iso(r.last_seen),
  }));
  const today = rows<TodayRow>(await hogql(qToday())).map((r) => ({ ...r, n: Number(r.n) }));
  const cache: EventCache = { fetchedAt: new Date().toISOString(), source: "posthog", usage, people, today };
  writeJson(CACHE_FILE, cache);
  return cache;
}

/** Cache from PostHog; if there is none, the local seed backup; if that is missing too, empty. */
export function loadCache(): EventCache {
  for (const f of [CACHE_FILE, SEED_BACKUP_FILE]) {
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8")) as EventCache;
  }
  return { fetchedAt: "", source: "seed-local", usage: [], people: [], today: [] };
}

export function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}
