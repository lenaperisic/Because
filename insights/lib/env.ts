/** Skripte (tsx) ne učitavaju .env.local same, Next.js da. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try { process.loadEnvFile(f); } catch { /* nema fajla */ }
  }
}
