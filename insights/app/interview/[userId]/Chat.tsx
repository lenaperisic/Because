"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, InterviewRecord, InterviewResult } from "@/lib/types";

const SENTIMENT = { neg: "negative", neu: "neutral", pos: "positive" } as const;

type Props = { userId: string; consent: string; previous: InterviewRecord | null };

export default function Chat({ userId, consent, previous }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [inPosthog, setInPosthog] = useState<boolean>(!!previous?.posthogSentAt);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  // Body in braces: scrollIntoView returns a Promise in newer Chromium, and React would call it as a cleanup and crash.
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, result]);

  async function post<T>(url: string, body: unknown): Promise<T> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data as T;
  }

  async function finish(history: ChatMessage[]) {
    setDone(true);
    setBusy(true);
    try {
      const res = await fetch("/api/interview/finish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setInPosthog(res.headers.get("X-Posthog") === "sent");
      setResult(data as InterviewResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || done) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const { reply, done: isDone } = await post<{ reply: string; done: boolean }>("/api/interview", { userId, messages: history });
      const next: ChatMessage[] = [...history, { role: "assistant", content: reply }];
      setMessages(next);
      if (isDone) return finish(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const shown = result ?? (messages.length === 0 ? previous?.result ?? null : null);

  return (
    <div>
      <div className="chat">
        <div className="msg assistant">{consent}</div>
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="muted">{done ? "Summarizing..." : "AI is typing..."}</div>}
        <div ref={bottom} />
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <div className="composer">
          <textarea
            value={input}
            placeholder="Your answer..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={busy}
          />
          <button onClick={send} disabled={busy || !input.trim()}>Send</button>
          {messages.length >= 2 && (
            <button className="secondary" disabled={busy} onClick={() => finish(messages)}>Finish</button>
          )}
        </div>
      )}
      {shown && <ResultView result={shown} earlier={!result} inPosthog={inPosthog} />}
    </div>
  );
}

function ResultView({ result, earlier, inPosthog }: { result: InterviewResult; earlier: boolean; inPosthog: boolean }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>{earlier ? "Previous result" : "Interview result"} {result.simulated && <span className="pill">simulated</span>}{" "}
        <span className="pill">{inPosthog ? "✓ written to PostHog (ai_main_reason)" : "not written to PostHog"}</span></h2>
      <dl className="result">
        <dt>Main reason</dt><dd>{result.mainReason}</dd>
        <dt>Summary</dt><dd>{result.summary}</dd>
        {result.reasons.length > 0 && <><dt>Reasons</dt><dd>{result.reasons.join(" · ")}</dd></>}
        {result.quotes.length > 0 && <><dt>Quotes</dt><dd>{result.quotes.map((q) => `“${q}”`).join(" ")}</dd></>}
        <dt>Suggested change</dt><dd>{result.suggestedChange}</dd>
        <dt>Tone</dt><dd>{SENTIMENT[result.sentiment]}</dd>
        <dt>Facts used</dt><dd>{result.factsUsed.join(", ") || "none"}</dd>
      </dl>
    </div>
  );
}
