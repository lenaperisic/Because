import Link from "next/link";
import { CONSENT_MESSAGE } from "@/lib/interview";
import { getProfile } from "@/lib/profiles";
import { SEGMENT_DEFS, type SegmentId } from "@/lib/segments";
import { loadInterview } from "@/lib/store";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const userId = decodeURIComponent((await params).userId);
  const profile = await getProfile(userId);
  if (!profile) {
    return (
      <main>
        <h1>Nema osobe {userId}</h1>
        <p className="muted">
          Proverite da je Folio pokrenut sa <code>--user</code> i da PostHog ima događaje, pa osvežite. <Link href="/">Nazad</Link>
        </p>
      </main>
    );
  }
  const seg = SEGMENT_DEFS[profile.segmentId as SegmentId];
  const previous = loadInterview(userId);

  return (
    <main>
      <p className="muted"><Link href="/">← Grupe</Link></p>
      <h1>Intervju · {userId}</h1>
      <p className="muted">{profile.role} · grupa <b>{seg.name}</b> · {seg.researchQuestion}</p>
      <div className="split">
        <section className="card">
          <Chat userId={userId} consent={CONSENT_MESSAGE} previous={previous} />
        </section>
        <aside className="card">
          <h2>Činjenice (računa kod)</h2>
          <p className="muted">AI sme da se poziva samo na ove činjenice.</p>
          <ul className="facts">
            {profile.facts.map((f) => <li key={f.id}><code>{f.id}</code>{f.text}</li>)}
          </ul>
        </aside>
      </div>
    </main>
  );
}
