"use client";

import { useState } from "react";
import { api, tgl } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; code: string; test: string; finishedAt: string; essayPending: number };
type Item = {
  qid: string; stem: string; rubric: { criterion: string; points: number }[]; guide: string | null; max: number; maxWords: number | null;
  answer: string; points: number | null; feedback: string | null; aiDraft: { points: number; rationale: string } | null;
};
type Detail = { code: string; status: string; pending: number; items: Item[] };

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function EssayCard({ attemptId, it, onSaved }: { attemptId: string; it: Item; onSaved: (done: boolean) => void }) {
  const [points, setPoints] = useState<string>(it.points != null ? String(it.points) : "");
  const [feedback, setFeedback] = useState(it.feedback ?? "");
  const [draft, setDraft] = useState(it.aiDraft);
  const [busy, setBusy] = useState<"" | "save" | "ai">("");
  const [err, setErr] = useState("");
  const n = Number(points), valid = points !== "" && Number.isFinite(n) && n >= 0 && n <= it.max;

  async function save() {
    setBusy("save"); setErr("");
    try { const r = await api(`/api/admin/grading/${attemptId}`, { method: "PUT", json: { qid: it.qid, points: n, feedback: feedback || undefined } }); onSaved(!!r.done); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function ask() {
    setBusy("ai"); setErr("");
    try { const r = await api(`/api/admin/grading/${attemptId}/draft`, { method: "POST", json: { qid: it.qid } }); setDraft({ points: r.draft.points, rationale: r.draft.rationale }); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  return (
    <section className="card flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-wider text-brand">QUESTION · {it.max} POINTS</p>
        <h2 className="mt-1 text-lg font-semibold text-navy">{it.stem}</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-xs font-semibold text-ink-soft">ANSWER · {words(it.answer)} words{it.maxWords ? ` (limit ${it.maxWords})` : ""}</p>
          <div className="mt-1 max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-canvas p-4 text-[15px] leading-relaxed">{it.answer}</div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-line p-3 text-sm">
            <p className="text-xs font-semibold text-ink-soft">RUBRIC</p>
            <ul className="mt-1 flex flex-col gap-1">{it.rubric.map((c) => <li key={c.criterion} className="flex justify-between gap-3"><span>{c.criterion}</span><b>{c.points}</b></li>)}</ul>
            {it.guide && <p className="mt-2 border-t border-line pt-2 text-xs text-ink-soft">{it.guide}</p>}
          </div>
          {draft && (
            <div className="rounded-xl border border-accent bg-accent-tint p-3 text-sm">
              <p className="text-xs font-semibold text-accent-dark">AI DRAFT · a suggestion only</p>
              <p className="mt-1"><b className="font-display text-xl text-navy">{draft.points}</b> / {it.max}</p>
              <p className="mt-1 text-ink-soft">{draft.rationale}</p>
              <button type="button" className="mt-2 text-sm font-semibold text-brand" onClick={() => setPoints(String(draft.points))}>Use this score</button>
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm font-semibold text-navy">Score (0 to {it.max})
            <input className="field font-normal" type="number" min={0} max={it.max} step="0.5" value={points} onChange={(e) => setPoints(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-navy">Feedback for the participant (optional)
            <textarea className="field h-20 py-2 font-normal" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </label>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button className="btn-solid" disabled={!valid || !!busy} onClick={save}>{busy === "save" ? "Saving…" : it.points != null ? "Update grade" : "Save grade"}</button>
            <button className="btn-outline" disabled={!!busy} onClick={ask}>{busy === "ai" ? "Asking AI…" : draft ? "Redo AI draft" : "AI draft"}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Attempt({ id, onBack }: { id: string; onBack: (released: boolean) => void }) {
  const { data, error, loading, reload } = useApi<Detail>(`/api/admin/grading/${id}`);
  const [released, setReleased] = useState(false);
  if (loading && !data) return <Loading text="Loading answers…" />;
  if (error && !data) return <ErrorNote text={error} />;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-4">
      <button className="self-start text-sm font-semibold text-brand" onClick={() => onBack(released)}>← Back to the queue</button>
      <div>
        <h1 className="page-title">Grade essays · {data.code}</h1>
        <p className="text-sm text-ink-soft">Participant names are hidden while grading. {data.pending > 0 ? `${data.pending} essay${data.pending === 1 ? "" : "s"} still waiting.` : "All essays are graded."}</p>
      </div>
      {released && <p role="status" className="rounded-xl bg-success-tint p-3 font-semibold text-success">All essays graded. The score was recalculated and the result is released to the participant.</p>}
      {data.items.map((it) => <EssayCard key={it.qid} attemptId={id} it={it} onSaved={(done) => { if (done) setReleased(true); reload(); }} />)}
    </div>
  );
}

export default function Grading() {
  const { data, error, loading, reload } = useApi<{ items: Row[] }>("/api/admin/grading");
  const [open, setOpen] = useState<string | null>(null);
  if (open) return <Attempt id={open} onBack={() => { setOpen(null); reload(); }} />;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="page-title">Grading</h1>
        <p className="max-w-3xl text-sm text-ink-soft">Essay answers wait here for a grade. A participant&apos;s result stays on hold until every essay is graded, then the score is recalculated and the result is released. The AI draft is only a suggestion.</p>
      </div>
      {loading && !data && <Loading text="Loading the queue…" />}
      {error && <ErrorNote text={error} />}
      {data && !data.items.length && <div className="card text-center text-ink-soft">Nothing is waiting for a grade. Essays appear here after participants submit a test that contains essay questions.</div>}
      {data && data.items.length > 0 && (
        <div className="table-wrap card !p-0">
          <table className="w-full text-sm">
            <thead><tr><th>Attempt</th><th>Test</th><th>Submitted</th><th className="text-right">Essays waiting</th><th /></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.id}><td className="font-semibold text-navy">{r.code}</td><td>{r.test}</td><td>{tgl(r.finishedAt)}</td><td className="text-right">{r.essayPending}</td><td className="text-right"><button className="btn-solid !min-h-[36px]" onClick={() => setOpen(r.id)}>Grade</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
