import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// One model call, through one of two routes:
//  - Perplexity Agent API (hackathon credits), model anthropic/<INTERVIEW_MODEL>, if PERPLEXITY_API_KEY is set
//  - the Anthropic API directly, otherwise
// Same model (Claude) either way; only the billing changes.

export type Turn = { role: "user" | "assistant" | "system"; content: string };

type Opts<T> = {
  instructions: string;
  turns: Turn[];
  maxTokens: number;
  effort: "low" | "medium";
  /** If set, the answer is JSON following this schema and is returned parsed. */
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

// The hackathon account allows 1 request per ~3 s (x-ratelimit-limit: 1, x-ratelimit-reset = request start + ~3 s).
// So in this process requests go one at a time and wait for the reset; 429/5xx and network failures are retried with a pause.
const MAX_ATTEMPTS = 6;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let queue: Promise<unknown> = Promise.resolve();
let nextAllowedAt = 0;

function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

function postAgent(body: unknown): Promise<Response> {
  return oneAtATime(async () => {
    for (let attempt = 1; ; attempt++) {
      const wait = nextAllowedAt - Date.now();
      if (wait > 0) await sleep(wait);
      let res: Response;
      try {
        res = await fetch("https://api.perplexity.ai/v1/agent", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (e) {
        // A timeout is not retried (it already took 90 s); a network failure is.
        const name = e instanceof Error ? e.name : "";
        if (name === "TimeoutError" || name === "AbortError" || attempt >= MAX_ATTEMPTS) throw e;
        console.warn(`Perplexity: ${e instanceof Error ? e.message : e}, attempt ${attempt}/${MAX_ATTEMPTS}`);
        nextAllowedAt = Date.now() + 1000 * 2 ** (attempt - 1);
        continue;
      }
      const reset = Number(res.headers.get("x-ratelimit-reset"));
      if (reset > 0) nextAllowedAt = reset * 1000 + 1000;
      if ((res.status !== 429 && res.status < 500) || attempt >= MAX_ATTEMPTS) return res;
      const retryAfter = Number(res.headers.get("retry-after"));
      const pause = Math.max(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, 1000 * 2 ** (attempt - 1));
      console.warn(`Perplexity ${res.status}, attempt ${attempt}/${MAX_ATTEMPTS}, waiting ${Math.round(pause / 1000)} s`);
      await res.body?.cancel();
      nextAllowedAt = Math.max(nextAllowedAt, Date.now() + pause);
    }
  });
}

async function viaPerplexity<T>(o: Opts<T>): Promise<string | T> {
  const body: Record<string, unknown> = {
    model: MODEL.includes("/") ? MODEL : `anthropic/${MODEL}`,
    max_output_tokens: o.maxTokens, // required for anthropic/* models
    instructions: o.instructions,
    input: o.turns.map((t) => ({ type: "message", role: t.role, content: t.content })),
    tool_choice: "none", // no web search: the model may only use our facts
  };
  if (o.schema) {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(o.schema) as Record<string, unknown>;
    body.response_format = { type: "json_schema", json_schema: { name: o.schemaName ?? "result", strict: true, schema } };
  }
  const res = await postAgent(body);
  const data = (await res.json().catch(() => ({}))) as {
    output?: { type: string; content?: { type: string; text?: string }[] }[];
    error?: { message?: string };
  };
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${data.error?.message ?? "unknown error"}`);
  const text = (data.output ?? [])
    .filter((x) => x.type === "message")
    .flatMap((x) => x.content ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  if (!text) throw new RefusalError("The model returned no answer.");
  return o.schema ? o.schema.parse(JSON.parse(text)) : text;
}

// ---- Anthropic API directly ----

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
