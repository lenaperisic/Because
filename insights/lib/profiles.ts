import { buildProfile } from "./facts";
import { loadCache, posthogReadConfigured, refreshFromPosthog } from "./posthog";
import type { Profile } from "./types";

/**
 * Profil iz keša. Ako osobe nema (npr. nova osoba iz Folio-a sa --user) ili se traži sveže,
 * povuče ponovo iz PostHoga jednom.
 */
export async function getProfile(userId: string, opts: { refresh?: boolean } = {}): Promise<Profile | null> {
  let cache = loadCache();
  let profile = opts.refresh ? null : buildProfile(cache, userId);
  if (!profile && posthogReadConfigured()) {
    cache = await refreshFromPosthog();
    profile = buildProfile(cache, userId);
  }
  return profile;
}
