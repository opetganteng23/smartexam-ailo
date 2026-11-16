"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { qid: string; stem: string; kind: string; section: string | null; declared: string | null; used: number; answered: number; p: number | null; discrimination: number | null; distribution: number[] | null; flags: string[] };
const FLAG: Record<string, string> = { too_easy: "Too easy", too_hard: "Too hard", weak_discrimination: "Weak discrimination", negative_discrimination: "Negative discrimination", many_blank: "Often left blank" };
const pct = (p: number | null) => (p === null ? "-" : `${Math.round(p * 100)}%`);

/** Statistik butir soal sebuah tes: seberapa sulit soal sebenarnya, seberapa baik membedakan peserta kuat dan lemah, dan butir yang perlu ditinjau. */
export default function Butir() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<{ test: { name: string }; attempts: number; rows: Row[] }>(`/api/admin/tests/${id}/item-stats`);
  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/admin/tests/${id}`} className="text-sm font-semibold text-brand">Back to the test</Link>
        <h1 className="page-title">Item analysis</h1>
        {data && <p className="text-sm text-ink-soft">{data.test.name} · {data.attempts} finished attempts (admins and QA testers excluded). Difficulty (p) is the share of points earned. Discrimination compares the top and bottom 27% of participants; it needs at least 10 attempts, and quality flags need at least 30.</p>}
      </div>
      <ErrorNote text={error} />
      {data && data.rows.length === 0 && <p className="card text-sm text-ink-soft">No finished attempts yet.</p>}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas text-xs uppercase text-ink-soft"><tr><th className="p-3">Question</th><th>Used</th><th>Answered</th><th>Difficulty (p)</th><th>Discrimination</th><th>Options chosen</th><th>Review</th></tr></thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.qid} className="border-t border-line align-top">
                  <td className="max-w-md p-3"><p className="line-clamp-2">{r.stem}</p><p className="mt-0.5 text-xs text-ink-soft">{r.kind}{r.section ? ` · ${r.section}` : ""}{r.declared ? ` · set as ${r.declared}` : ""}</p></td>
                  <td>{r.used}</td><td>{r.answered}</td><td className="font-semibold text-navy">{pct(r.p)}</td><td>{r.discrimination === null ? "-" : r.discrimination.toFixed(2)}</td>
                  <td className="text-xs">{r.distribution ? r.distribution.map((n, i) => `${"ABCDEF"[i]} ${n}`).join(" · ") : "-"}</td>
                  <td>{r.flags.length ? <span className="flex flex-wrap gap-1">{r.flags.map((f) => <span key={f} className="badge-warn">{FLAG[f] ?? f}</span>)}</span> : <span className="text-ink-soft">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
