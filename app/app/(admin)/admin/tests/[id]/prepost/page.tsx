"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type Topic = { skill: string; topic: string; pre: number | null; post: number | null; delta: number | null };
type Row = { userId: string; name: string | null; email: string; institution: string | null; pre: number | null; post: number | null; delta: number | null; topics: Topic[] };
type Data = {
  pre: { id: string; name: string }; post: { id: string; name: string };
  summary: { participants: number; withBoth: number; avgPre: number | null; avgPost: number | null; avgDelta: number | null; improved: number; declined: number };
  topics: { skill: string; topic: string; n: number; pre: number; post: number; delta: number }[]; rows: Row[];
};
const pct = (n: number | null) => (n === null ? "-" : `${n}%`);
const sign = (n: number | null) => (n === null ? "-" : `${n > 0 ? "+" : ""}${n}`);
const tone = (n: number | null) => (n === null ? "" : n > 0 ? "text-success" : n < 0 ? "text-red-700" : "text-ink-soft");

export default function PrePost() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<Data>(`/api/admin/tests/${id}/prepost`);
  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/admin/tests/${id}`} className="text-sm font-semibold text-brand">Back to the test</Link>
        <h1 className="page-title">Pre/post improvement</h1>
        {data && <p className="text-sm text-ink-soft">{data.pre.name} compared with {data.post.name}. Each person&apos;s best attempt is used. Admins and QA testers are left out.</p>}
      </div>
      <ErrorNote text={error} />
      {data && (
        <>
          <section className="grid gap-3 sm:grid-cols-4" aria-label="Summary">
            {[["Participants", String(data.summary.participants)], ["Average pre-test", pct(data.summary.avgPre)], ["Average post-test", pct(data.summary.avgPost)], ["Average change", sign(data.summary.avgDelta)]].map(([k, v]) => (
              <div key={k} className="card !p-3"><p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{k}</p><p className="font-display text-2xl font-extrabold text-navy">{v}</p></div>
            ))}
          </section>
          <p className="text-sm text-ink-soft">{data.summary.withBoth} of {data.summary.participants} took both tests · {data.summary.improved} improved · {data.summary.declined} declined.</p>
          {data.rows.length === 0 && <p className="card text-sm text-ink-soft">Nobody has finished either test yet.</p>}
          {data.topics.length > 0 && (
            <section className="card" aria-label="By topic">
              <h2 className="mb-2 font-display text-lg font-extrabold text-navy">By topic (people with both results)</h2>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-ink-soft"><tr><th className="py-1 pr-3">Topic</th><th>People</th><th>Pre</th><th>Post</th><th>Change</th></tr></thead>
                <tbody>{data.topics.map((t) => <tr key={t.skill + t.topic} className="border-t border-line"><td className="py-1.5 pr-3 font-semibold text-navy">{t.topic}</td><td>{t.n}</td><td>{pct(t.pre)}</td><td>{pct(t.post)}</td><td className={`font-semibold ${tone(t.delta)}`}>{sign(t.delta)}</td></tr>)}</tbody>
              </table></div>
            </section>
          )}
          {data.rows.length > 0 && (
            <section className="card" aria-label="By participant">
              <h2 className="mb-2 font-display text-lg font-extrabold text-navy">By participant</h2>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-ink-soft"><tr><th className="py-1 pr-3">Participant</th><th>Institution</th><th>Pre</th><th>Post</th><th>Change</th></tr></thead>
                <tbody>{data.rows.map((r) => (
                  <tr key={r.userId} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3"><b className="text-navy">{r.name ?? r.email}</b><br /><span className="text-xs text-ink-soft">{r.email}</span>
                      {r.topics.some((t) => t.delta !== null) && <details className="mt-1 text-xs"><summary className="cursor-pointer font-semibold text-brand">Topics</summary><ul>{r.topics.map((t) => <li key={t.skill + t.topic}>{t.topic}: {pct(t.pre)} to {pct(t.post)} <span className={tone(t.delta)}>({sign(t.delta)})</span></li>)}</ul></details>}</td>
                    <td>{r.institution ?? "-"}</td><td>{pct(r.pre)}</td><td>{pct(r.post)}</td><td className={`font-semibold ${tone(r.delta)}`}>{r.pre === null || r.post === null ? <span className="font-normal text-ink-soft">{r.pre === null ? "no pre-test" : "no post-test"}</span> : sign(r.delta)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
