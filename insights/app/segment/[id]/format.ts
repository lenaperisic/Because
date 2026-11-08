// Zajedničko za ekran grupe (server) i sintezu (klijent).

/** 1 osoba, 2 osobe, 5 osoba, 22 osobe. */
export function personCount(n: number) {
  const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
  return `${n} ${few ? "osobe" : "osoba"}`;
}

/** Parovi navodnika kojima model ponekad obavije ceo citat. */
const QUOTE_PAIRS = ["„“", "„”", "“”", "«»", "»«", '""'];

/** Citat bez navodnika, samo ako je njima obavijen ceo citat; navodnike unutar citata ne dira. */
export function cleanQuote(q: string) {
  const t = q.trim();
  const open = t.charAt(0), close = t.charAt(t.length - 1), inner = t.slice(1, -1);
  const wrapped = t.length >= 2 && QUOTE_PAIRS.includes(open + close) && !inner.includes(open) && !inner.includes(close);
  return wrapped ? inner.trim() : t;
}
