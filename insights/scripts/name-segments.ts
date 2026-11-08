// Claude gives each group a name and a research question -> data/segment-names.json
// (membership is still decided by the rules in code). Delete the file to get the default names.
//   npm run name-segments
import { loadEnv } from "../lib/env";

loadEnv();

async function main() {
  const { loadCache } = await import("../lib/posthog");
  const { nameSegments } = await import("../lib/naming");
  const names = await nameSegments(loadCache());
  for (const [id, n] of Object.entries(names)) console.log(`${id.padEnd(13)} ${n!.name}\n${"".padEnd(13)} ${n!.researchQuestion}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
