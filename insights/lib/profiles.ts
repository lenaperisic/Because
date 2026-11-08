import { buildProfile } from "./facts";
import { loadCache, posthogReadConfigured, refreshFromPosthog } from "./posthog";
import type { Profile } from "./types";

/**
 * Profile from the cache. If the person is missing (e.g. a new person from Folio with --user) or fresh data is requested,
 * pulls from PostHog again, once.
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
