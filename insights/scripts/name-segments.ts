// Claude daje ime i istraživačko pitanje svakoj grupi -> data/segment-names.json
// (članstvo i dalje određuju pravila iz koda). Obrišite fajl za podrazumevana imena.
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
