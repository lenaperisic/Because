/** Scripts (tsx) do not load .env.local on their own; Next.js does. */
export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    try { process.loadEnvFile(f); } catch { /* no file */ }
  }
}
