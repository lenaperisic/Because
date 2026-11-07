import fs from "node:fs";
import path from "node:path";
import { writeJson } from "./posthog";
import type { ChatMessage, InterviewRecord, InterviewResult, SegmentSynthesis } from "./types";

const RESULTS_DIR = path.join(process.cwd(), "data", "results");
const SYNTHESIS_DIR = path.join(process.cwd(), "data", "synthesis");
const safe = (userId: string) => userId.replace(/[^a-zA-Z0-9_.-]/g, "_");

export function saveInterview(result: InterviewResult, transcript: ChatMessage[], extra: Partial<InterviewRecord> = {}): InterviewRecord {
  const record: InterviewRecord = { result, transcript, completedAt: new Date().toISOString(), ...extra };
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

export function saveSynthesis(s: SegmentSynthesis) {
  writeJson(path.join(SYNTHESIS_DIR, `${safe(s.segmentId)}.json`), s);
}

export function loadSynthesis(segmentId: string): SegmentSynthesis | null {
  const f = path.join(SYNTHESIS_DIR, `${safe(segmentId)}.json`);
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as SegmentSynthesis) : null;
}
