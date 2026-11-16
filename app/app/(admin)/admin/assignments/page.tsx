"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { askConfirm } from "@/components/Feedback";
import { Loading, ErrorNote } from "@/components/Charts";

type Course = { id: string; title: string; track?: string; units: { id: string; title: string }[] };
type A = { id: string; courseId: string; unitId: string | null; title: string; instructions: string; kind: "file" | "test"; testId: string | null; dueAt: string | null; allowLate: boolean; maxSubmissions: number; maxPoints: number; active: boolean; submissions: number; ungraded: number };
type S = { id: string; attemptNo: number; name: string | null; email: string; institution: string | null; text: string; file: { name: string; size: number; url: string } | null; at: string; late: boolean; status: string; points: number | null; feedback: string };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
// <input type="datetime-local"> memakai waktu lokal tanpa zona: dikonversi dari dan ke WIB agar sama dengan tampilan peserta.
const toInput = (d: string | null) => (d ? new Date(+new Date(d) + 7 * 3600_000).toISOString().slice(0, 16) : "");
const fromInput = (v: string) => (v ? new Date(v + ":00+07:00").toISOString() : null);

/** Tugas course umum: buat dan atur tugas, lihat kiriman, dan beri nilai. */
export default function Tugas() {
  const courses = useApi<{ courses: Course[] }>("/api/admin/courses");
  const [courseId, setCourseId] = useState("");
  const general = (courses.data?.courses ?? []).filter((c) => c.track === "general");
  const cid = courseId || general[0]?.id || "";
  const list = useApi<{ assignments: A[] }>(cid ? `/api/admin/assignments?courseId=${cid}` : null);
  const [edit, setEdit] = useState<Partial<A> | null>(null);
  const [open, setOpen] = useState<A | null>(null);
  const [err, setErr] = useState("");
  if (courses.loading && !courses.data) return <Loading />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Assignments</h1><p className="text-sm text-ink-soft">Tasks inside a general course: participants upload a file or write an answer, and you grade it. A test assignment points to a general test.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Course" className="field w-auto" value={cid} onChange={(e) => setCourseId(e.target.value)}>{general.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          <button className="btn-solid" disabled={!cid} onClick={() => setEdit({ courseId: cid, kind: "file", maxPoints: 100, maxSubmissions: 1, allowLate: false, active: true })}>+ New assignment</button>
        </div>
      </div>
      <ErrorNote text={courses.error || list.error || err} />
      {general.length === 0 && <p className="card text-sm text-ink-soft">No general courses yet. Create one under Courses &amp; Units first.</p>}
      <ul className="flex flex-col gap-2">
        {list.data?.assignments.map((a) => (
          <li key={a.id} className={`card flex flex-wrap items-center justify-between gap-2 ${a.active ? "" : "opacity-60"}`}>
            <div><b className="text-navy">{a.title}</b> {!a.active && <span className="badge-muted">inactive</span>} {a.ungraded > 0 && <span className="badge-warn">{a.ungraded} to grade</span>}<p className="text-xs text-ink-soft">{a.kind === "test" ? "Test assignment" : "File assignment"} · {a.dueAt ? `due ${new Date(a.dueAt).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })} WIB` : "no deadline"} · {a.submissions} submissions · {a.maxPoints} points</p></div>
            <div className="flex gap-3 text-sm font-semibold">
              {a.kind === "file" && <button className="text-brand" onClick={() => setOpen(a)}>Submissions</button>}
              <button className="text-brand" onClick={() => setEdit(a)}>Edit</button>
              <button className="text-red-700" onClick={() => void askConfirm("Delete this assignment? Assignments with submissions cannot be deleted; deactivate them instead.").then((ok) => { if (ok) api(`/api/admin/assignments/${a.id}`, { method: "DELETE", silent: true }).then(list.reload).catch((e) => setErr((e as Error).message)); })}>Delete</button>
            </div>
          </li>
        ))}
        {list.data && list.data.assignments.length === 0 && <li className="card text-sm text-ink-soft">No assignments for this course yet.</li>}
      </ul>
      {edit && <Editor init={edit} course={general.find((c) => c.id === (edit.courseId ?? cid))} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); }} />}
      {open && <Submissions a={open} onClose={() => { setOpen(null); list.reload(); }} />}
    </div>
  );
}

function Editor({ init, course, onClose, onSaved }: { init: Partial<A>; course?: Course; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: init.title ?? "", instructions: init.instructions ?? "", kind: init.kind ?? "file", testId: init.testId ?? "", unitId: init.unitId ?? "", dueAt: toInput(init.dueAt ?? null), allowLate: !!init.allowLate, maxSubmissions: init.maxSubmissions ?? 1, maxPoints: init.maxPoints ?? 100, active: init.active ?? true });
  const [err, setErr] = useState("");
  const tests = useApi<{ tests: { id: string; name: string; kind: string }[] }>("/api/admin/tests");
  async function save() {
    try {
      await api(init.id ? `/api/admin/assignments/${init.id}` : "/api/admin/assignments", { method: init.id ? "PATCH" : "POST", json: { courseId: init.courseId, title: v.title, instructions: v.instructions || undefined, kind: v.kind, testId: v.kind === "test" ? v.testId || null : null, unitId: v.unitId || null, dueAt: fromInput(v.dueAt), allowLate: v.allowLate, maxSubmissions: Number(v.maxSubmissions), maxPoints: Number(v.maxPoints), active: v.active }, silent: true });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit assignment" : "New assignment"} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <label className={label}>Title<input className="field font-normal" maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Instructions<textarea className="field h-24 py-2 font-normal" maxLength={3000} value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Type<select className="field font-normal" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as "file" | "test" })}><option value="file">File or written answer</option><option value="test">Based on a test</option></select></label>
          {v.kind === "test" && <label className={label}>Test<select className="field font-normal" value={v.testId} onChange={(e) => setV({ ...v, testId: e.target.value })}><option value="">Choose a general test</option>{(tests.data?.tests ?? []).filter((t) => t.kind === "general").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
          <label className={label}>Unit (optional)<select className="field font-normal" value={v.unitId} onChange={(e) => setV({ ...v, unitId: e.target.value })}><option value="">Whole course</option>{(course?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}</select></label>
          <label className={label}>Deadline (WIB, optional)<input type="datetime-local" className="field font-normal" value={v.dueAt} onChange={(e) => setV({ ...v, dueAt: e.target.value })} /></label>
          <label className={label}>Points<input type="number" min={1} max={1000} className="field font-normal" value={v.maxPoints} onChange={(e) => setV({ ...v, maxPoints: Number(e.target.value) })} /></label>
          {v.kind === "file" && <label className={label}>Submissions per participant<input type="number" min={0} max={20} className="field font-normal" value={v.maxSubmissions} onChange={(e) => setV({ ...v, maxSubmissions: Number(e.target.value) })} /><span className="text-xs font-normal text-ink-soft">0 means unlimited.</span></label>}
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={v.allowLate} onChange={(e) => setV({ ...v, allowLate: e.target.checked })} />Accept late submissions (marked as late)</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active (visible to participants)</label>
        <ErrorNote text={err} />
        <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.title.trim()} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function Submissions({ a, onClose }: { a: A; onClose: () => void }) {
  const { data, error, reload } = useApi<{ submissions: S[] }>(`/api/admin/assignments/${a.id}/submissions`);
  const [err, setErr] = useState("");
  const [pts, setPts] = useState<Record<string, string>>({});
  const [fb, setFb] = useState<Record<string, string>>({});
  async function grade(s: S) {
    setErr("");
    try { await api(`/api/admin/assignments/${a.id}/submissions/${s.id}`, { method: "PATCH", json: { points: Number(pts[s.id] ?? s.points), feedback: fb[s.id] ?? s.feedback }, silent: true }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={`Submissions: ${a.title}`} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <ErrorNote text={error || err} />
        {data?.submissions.map((s) => (
          <div key={s.id} className="rounded-xl border border-line p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><b className="text-navy">{s.name ?? s.email}</b><span>{s.institution}</span><span>#{s.attemptNo}</span><span>{new Date(s.at).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}</span>{s.late && <span className="badge-warn">late</span>}{s.status === "graded" ? <span className="badge-ok">graded</span> : <span className="badge-muted">to grade</span>}</p>
            {s.text && <p className="mt-1 whitespace-pre-line break-words">{s.text}</p>}
            {s.file && <p className="mt-1"><a className="font-semibold text-brand" href={s.file.url}>{s.file.name}</a></p>}
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Points (max {a.maxPoints})<input type="number" min={0} max={a.maxPoints} className="field !h-10 w-24 font-normal" value={pts[s.id] ?? (s.points ?? "")} onChange={(e) => setPts({ ...pts, [s.id]: e.target.value })} /></label>
              <label className="flex flex-1 flex-col gap-1 text-xs font-semibold text-navy">Feedback<input className="field !h-10 font-normal" maxLength={2000} value={fb[s.id] ?? s.feedback} onChange={(e) => setFb({ ...fb, [s.id]: e.target.value })} /></label>
              <button className="btn-solid !min-h-[40px]" disabled={(pts[s.id] ?? s.points ?? "") === ""} onClick={() => grade(s)}>Save grade</button>
            </div>
          </div>
        ))}
        {data && data.submissions.length === 0 && <p className="text-ink-soft">No submissions yet.</p>}
      </div>
    </Modal>
  );
}
