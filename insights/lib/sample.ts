/**
 * Seeded (sample) people have IDs like sample_doctor_017; everyone else is a live Folio user.
 * The prefix differs from the old Serbian seed (seed_lekar_017...), so the two datasets never share a person.
 */
export const SAMPLE_PREFIX = "sample_";

export const isSample = (id: string) => id.startsWith(SAMPLE_PREFIX);
