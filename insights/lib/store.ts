import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./posthog";
import type { ChatMessage, InterviewRecord, InterviewResult } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "data", "results");
const safe = (userId: string) => userId.replace(/[^a-zA-Z0-9_.-]/g, "_");

export function saveInterview(result: InterviewResult, transcript: ChatMessage[]): InterviewRecord {
  const record: InterviewRecord = { result, transcript, completedAt: new Date().toISOString() };
  writeJson(path.join(RESULTS_DIR, `${safe(result.userId)}.json`), record);
  return record;
}

export function loadInterview(userId: string): InterviewRecord | null {
  const f = path.join(RESULTS_DIR, `${safe(userId)}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as InterviewRecord) : null;
}

export function listInterviews(): InterviewRecord[] {
  if (!fs.existsSync(RESULTS_DIR)) return [];
  return fs.readdirSync(RESULTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), "utf8")) as InterviewRecord);
}
