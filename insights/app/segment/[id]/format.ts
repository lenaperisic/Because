// Shared by the group screen (server) and the synthesis (client).

/** 1 person, 2 people. */
export function personCount(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

/** Quote pairs the model sometimes wraps an entire quote in. */
const QUOTE_PAIRS = ["„“", "„”", "“”", "«»", "»«", '""'];

/** The quote without quotation marks, only if they wrap the whole quote; marks inside the quote stay. */
export function cleanQuote(q: string) {
  const t = q.trim();
  const open = t.charAt(0), close = t.charAt(t.length - 1), inner = t.slice(1, -1);
  const wrapped = t.length >= 2 && QUOTE_PAIRS.includes(open + close) && !inner.includes(open) && !inner.includes(close);
  return wrapped ? inner.trim() : t;
}
