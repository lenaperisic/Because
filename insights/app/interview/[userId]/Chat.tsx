"use client";
import { useEffect, useRef, useState } from "react";
import type { ChatMessage, InterviewRecord, InterviewResult } from "@/lib/types";

const SENTIMENT = { neg: "negativan", neu: "neutralan", pos: "pozitivan" } as const;

type Props = { userId: string; consent: string; previous: InterviewRecord | null };
type Finished = InterviewResult & { posthog?: InterviewRecord["posthog"] };

export default function Chat({ userId, consent, previous }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<Finished | null>(null);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages, result]);

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
      setResult(await post<Finished>("/api/interview/finish", { userId, messages: history }));
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

  const shown: Finished | null = result ?? (messages.length === 0 && previous ? { ...previous.result, posthog: previous.posthog } : null);

  return (
    <div>
      <div className="chat">
        <div className="msg assistant">{consent}</div>
        {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
        {busy && <div className="muted">{done ? "Pravim sažetak..." : "AI piše..."}</div>}
        <div ref={bottom} />
      </div>
      {error && <p className="error">{error}</p>}
      {!done && (
        <div className="composer">
          <textarea
            value={input}
            placeholder="Vaš odgovor..."
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={busy}
          />
          <button onClick={send} disabled={busy || !input.trim()}>Pošalji</button>
          {messages.length >= 2 && (
            <button className="secondary" disabled={busy} onClick={() => finish(messages)}>Završi</button>
          )}
        </div>
      )}
      {shown && <ResultView result={shown} earlier={!result} />}
    </div>
  );
}

function ResultView({ result, earlier }: { result: Finished; earlier: boolean }) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>{earlier ? "Prethodni rezultat" : "Rezultat intervjua"} {result.simulated && <span className="pill">simulirano</span>}</h2>
      <dl className="result">
        <dt>Glavni razlog</dt><dd>{result.mainReason}</dd>
        <dt>Sažetak</dt><dd>{result.summary}</dd>
        {result.reasons.length > 0 && <><dt>Razlozi</dt><dd>{result.reasons.join(" · ")}</dd></>}
        {result.quotes.length > 0 && <><dt>Citati</dt><dd>{result.quotes.map((q) => `„${q}“`).join(" ")}</dd></>}
        <dt>Predlog promene</dt><dd>{result.suggestedChange}</dd>
        <dt>Ton</dt><dd>{SENTIMENT[result.sentiment]}</dd>
        <dt>Korišćene činjenice</dt><dd>{result.factsUsed.join(", ") || "nijedna"}</dd>
        <dt>PostHog</dt>
        <dd>
          {!result.posthog ? "nije upisano" : result.posthog.ok
            ? <>✓ <code>ai_interview_completed</code> + osobine <code>ai_segment</code>, <code>ai_main_reason</code></>
            : <span className="error">✗ {result.posthog.error}</span>}
        </dd>
      </dl>
    </div>
  );
}
