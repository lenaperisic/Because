import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Jedan poziv modela, preko jednog od dva puta:
//  - Perplexity Agent API (hakaton krediti), model anthropic/<INTERVIEW_MODEL>, ako postoji PERPLEXITY_API_KEY
//  - direktno Anthropic API, inače
// Isti model (Claude) u oba slučaja; menja se samo ko naplaćuje.

export type Turn = { role: "user" | "assistant" | "system"; content: string };

type Opts<T> = {
  instructions: string;
  turns: Turn[];
  maxTokens: number;
  effort: "low" | "medium";
  /** Ako je zadato, odgovor je JSON po ovoj šemi i vraća se parsiran. */
  schema?: z.ZodType<T>;
  schemaName?: string;
};

const MODEL = process.env.INTERVIEW_MODEL || "claude-opus-5-5";

export const provider = () => (process.env.PERPLEXITY_API_KEY ? "perplexity" : "anthropic");

export class RefusalError extends Error {}

export async function complete(opts: Opts<never> & { schema?: undefined }): Promise<string>;
export async function complete<T>(opts: Opts<T> & { schema: z.ZodType<T> }): Promise<T>;
export async function complete<T>(opts: Opts<T>): Promise<string | T> {
  return provider() === "perplexity" ? viaPerplexity(opts) : viaAnthropic(opts);
}

// ---- Perplexity Agent API: POST /v1/agent ----

async function viaPerplexity<T>(o: Opts<T>): Promise<string | T> {
  const body: Record<string, unknown> = {
    model: MODEL.includes("/") ? MODEL : `anthropic/${MODEL}`,
    max_output_tokens: o.maxTokens, // obavezno za anthropic/* modele
    instructions: o.instructions,
    input: o.turns.map((t) => ({ type: "message", role: t.role, content: t.content })),
    tool_choice: "none", // bez web pretrage: model sme da koristi samo naše činjenice
  };
  if (o.schema) {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(o.schema) as Record<string, unknown>;
    body.response_format = { type: "json_schema", json_schema: { name: o.schemaName ?? "rezultat", strict: true, schema } };
  }
  const res = await fetch("https://api.perplexity.ai/v1/agent", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${data.error?.message ?? "nepoznata greška"}`);
  const text = (data.output ?? [])
    .filter((x) => x.type === "message")
    .flatMap((x) => x.content ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new RefusalError("Model nije vratio odgovor.");
  return o.schema ? o.schema.parse(JSON.parse(text)) : text;
}

// ---- Anthropic API direktno ----

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

async function viaAnthropic<T>(o: Opts<T>): Promise<string | T> {
  const params = {
    model: MODEL.replace(/^anthropic\//, ""),
    max_tokens: o.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default" as const,
    system: [{ type: "text" as const, text: o.instructions, cache_control: { type: "ephemeral" as const } }],
    messages: o.turns,
  };
  if (o.schema) {
    const res = await anthropic().beta.messages.parse({
      ...params,
      output_config: { effort: o.effort, format: betaZodOutputFormat(o.schema) },
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new RefusalError(`stop_reason: ${res.stop_reason}`);
    return res.parsed_output as T;
  }
  const res = await anthropic().beta.messages.create({ ...params, output_config: { effort: o.effort } });
  if (res.stop_reason === "refusal") throw new RefusalError("refusal");
  return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
}
