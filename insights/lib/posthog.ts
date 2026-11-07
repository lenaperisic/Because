import fs from "node:fs";
import path from "node:path";
import type { EventCache, PersonRow, TodayRow, UsageRow } from "./types";

// Čitanje: PostHog query API (personal key, Query Read).
// Ograničenja: bez LIMIT vraća 100 redova (sa LIMIT do 50.000), 240 upita/min, 3 istovremeno,
// upit do 10 s. Zato upite puštamo jedan po jedan i rezultat odmah keširamo u fajl.

const DATA_DIR = path.join(process.cwd(), "data");
export const CACHE_FILE = path.join(DATA_DIR, "cache.json");
/** Seed skripta ovde upisuje isti oblik, kao rezervu ako PostHog zakaže. */
export const SEED_BACKUP_FILE = path.join(DATA_DIR, "seed-backup.json");

const Q_USAGE = `
SELECT distinct_id, properties.feature AS feature, count() AS n,
       min(timestamp) AS first_used, max(timestamp) AS last_used
FROM events
WHERE event = 'feature_used' AND timestamp > now() - INTERVAL 30 DAY
GROUP BY distinct_id, feature
LIMIT 50000`;

const Q_PEOPLE = `
SELECT distinct_id, any(properties.role) AS role, any(person.properties.name) AS name,
       countIf(event = 'document_opened') AS opened,
       min(timestamp) AS first_seen, max(timestamp) AS last_seen
FROM events
WHERE timestamp > now() - INTERVAL 30 DAY
  AND event IN ('app_opened', 'profile_switched', 'document_opened', 'feature_used')
GROUP BY distinct_id
LIMIT 50000`;

const Q_TODAY = `
SELECT distinct_id, event, ifNull(properties.feature, '') AS feature,
       ifNull(properties.doc_kind, '') AS doc_kind, count() AS n
FROM events
WHERE timestamp >= toStartOfDay(now())
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

/** Pretvara [kolone] + [[red]] u objekte. */
function rows<T>(r: { columns: string[]; results: unknown[][] }): T[] {
  return r.results.map((row) => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])) as T);
}

/** PostHog vraća vreme kao ISO string; za svaki slučaj podrži i „YYYY-MM-DD HH:MM:SS“ (UTC). */
function iso(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString();
  const d2 = new Date(s.replace(" ", "T") + "Z");
  return Number.isNaN(d2.getTime()) ? "" : d2.toISOString();
}

/** Povuče sve iz PostHoga (3 upita, jedan po jedan) i upiše keš. */
export async function refreshFromPosthog(): Promise<EventCache> {
  if (!posthogReadConfigured()) throw new Error("Nedostaju POSTHOG_PERSONAL_KEY i POSTHOG_PROJECT_ID.");
  const usage = rows<UsageRow>(await hogql(Q_USAGE)).map((r) => ({
    ...r, n: Number(r.n), first_used: iso(r.first_used), last_used: iso(r.last_used),
  }));
  const people = rows<PersonRow>(await hogql(Q_PEOPLE)).map((r) => ({
    ...r, role: r.role ?? "", name: r.name ?? "", opened: Number(r.opened),
    first_seen: iso(r.first_seen), last_seen: iso(r.last_seen),
  }));
  const today = rows<TodayRow>(await hogql(Q_TODAY)).map((r) => ({ ...r, n: Number(r.n) }));
  const cache: EventCache = { fetchedAt: new Date().toISOString(), source: "posthog", usage, people, today };
  writeJson(CACHE_FILE, cache);
  return cache;
}

/** Keš iz PostHoga; ako ga nema, lokalna rezerva iz seed skripte; ako ni nje nema, prazno. */
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
