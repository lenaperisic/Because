import Link from "next/link";
import { CONSENT_MESSAGE } from "@/lib/interview";
import { getProfile } from "@/lib/profiles";
import { segmentDef } from "@/lib/segments";
import { loadInterview } from "@/lib/store";
import Chat from "./Chat";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const userId = decodeURIComponent((await params).userId);
  const profile = await getProfile(userId);
  if (!profile) {
    return (
      <main>
        <h1>No person {userId}</h1>
        <p className="muted">
          Check that Folio was started with <code>--user</code> and that PostHog has its events, then refresh. <Link href="/">Back</Link>
        </p>
      </main>
    );
  }
  const seg = segmentDef(profile.segmentId);
  const previous = loadInterview(userId);

  return (
    <main>
      <p className="muted"><Link href="/">← Groups</Link> · <Link href={`/segment/${seg.id}`}>{seg.name}</Link></p>
      <h1>Interview · {userId}</h1>
      <p className="muted">{profile.role} · group <Link href={`/segment/${seg.id}`}><b>{seg.name}</b></Link> · {seg.researchQuestion}</p>
      <div className="split">
        <section className="card">
          <Chat userId={userId} consent={CONSENT_MESSAGE} previous={previous} />
        </section>
        <aside className="card">
          <h2>Facts (computed by code)</h2>
          <p className="muted">The AI may only refer to these facts.</p>
          <ul className="facts">
            {profile.facts.map((f) => <li key={f.id}><code>{f.id}</code>{f.text}</li>)}
          </ul>
        </aside>
      </div>
    </main>
  );
}
