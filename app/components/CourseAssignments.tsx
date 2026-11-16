"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { ErrorNote } from "@/components/Charts";
import { useT } from "@/components/LangProvider";

type Sub = { id: string; attemptNo: number; at: string; late: boolean; text: string; file: { name: string; size: number; url: string } | null; status: "submitted" | "graded"; points: number | null; feedback: string };
type A = { id: string; title: string; instructions: string; kind: "file" | "test"; dueAt: string | null; allowLate: boolean; maxPoints: number; maxSubmissions: number; canSubmit: boolean; reason: string | null; test: { id: string; name: string; best: number | null } | null; submissions: Sub[] };
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) + " WIB";
const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Tugas sebuah course: petunjuk, tenggat, kiriman sendiri dengan nilai, dan formulir pengumpulan (berkas dan/atau teks). */
export function CourseAssignments({ courseId }: { courseId: string }) {
  const tr = useT();
  const { data, error, reload } = useApi<{ assignments: A[] }>(`/api/courses/${courseId}/assignments`);
  const list = data?.assignments ?? [];
  if (error || list.length === 0) return error ? <ErrorNote text={error} /> : null;
  return (
    <section className="mt-4 flex flex-col gap-3" aria-label="Assignments">
      <h3 className="font-display text-lg font-extrabold text-navy">{tr("Assignments")}</h3>
      {list.map((a) => <Card key={a.id} a={a} onDone={reload} />)}
    </section>
  );
}

function Card({ a, onDone }: { a: A; onDone: () => void }) {
  const tr = useT();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function submit() {
    setErr(""); setMsg("");
    if (file && file.size > 10 * 1024 * 1024) return setErr(tr("The file is larger than 10 MB."));
    setBusy(true);
    try {
      const fd = new FormData();
      if (text.trim()) fd.set("text", text);
      if (file) fd.set("file", file);
      const r = await fetch(`/api/assignments/${a.id}/submit`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Could not submit");
      setText(""); setFile(null); setMsg(d.late ? tr("Submitted (marked as late).") : tr("Submitted.")); onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-brand">{a.kind === "test" ? tr("TEST ASSIGNMENT") : tr("ASSIGNMENT")}</p>
          <h4 className="font-display text-base font-extrabold text-navy">{a.title}</h4>
        </div>
        <p className="text-xs text-ink-soft">{a.dueAt ? `${tr("Due {when}", { when: when(a.dueAt) })}${a.allowLate ? tr(" (late allowed)") : ""}` : tr("No deadline")} · {tr("{n} points", { n: a.maxPoints })}</p>
      </div>
      {a.instructions && <p className="mt-2 whitespace-pre-line text-sm">{a.instructions}</p>}
      {a.kind === "test" && a.test && <p className="mt-2 text-sm">Take <b>{a.test.name}</b> from the tests of this course.{a.test.best != null ? ` Your best score: ${a.test.best}%.` : ""} <Link href="/tests" className="font-semibold text-brand">{tr("Go to My Tests")}</Link></p>}
      {a.submissions.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2" aria-label={tr("Your submissions")}>
          {a.submissions.map((s) => (
            <li key={s.id} className="rounded-lg bg-canvas p-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><b className="text-navy">{tr("Submission {n}", { n: s.attemptNo })}</b><span>{when(s.at)}</span>{s.late && <span className="badge-warn">{tr("late")}</span>}{s.status === "graded" ? <span className="badge-ok">{tr("Graded: {points} / {max}", { points: s.points ?? "", max: a.maxPoints })}</span> : <span className="badge-muted">{tr("Waiting for grading")}</span>}</p>
              {s.text && <p className="mt-1 whitespace-pre-line break-words">{s.text}</p>}
              {s.file && <p className="mt-1"><a className="font-semibold text-brand" href={s.file.url}>{s.file.name}</a> <span className="text-xs text-ink-soft">{kb(s.file.size)}</span></p>}
              {s.feedback && <p className="mt-1 rounded bg-white p-2 text-sm"><b>{tr("Feedback:")}</b> {s.feedback}</p>}
            </li>
          ))}
        </ul>
      )}
      {a.kind === "file" && (a.canSubmit ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-sm font-semibold text-navy" htmlFor={`t-${a.id}`}>{tr("Your answer (optional if you attach a file)")}</label>
          <textarea id={`t-${a.id}`} className="field h-24 py-2 font-normal" maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          <label className="text-sm font-semibold text-navy">{tr("File (PDF, PNG, JPEG, or Word/Excel/PowerPoint/ZIP, up to 10 MB)")}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.zip,.docx,.xlsx,.pptx" className="mt-1 block text-sm font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <ErrorNote text={err} />
          {msg && <p role="status" className="text-sm text-success">{msg}</p>}
          <button className="btn-solid self-start" disabled={busy || (!text.trim() && !file)} onClick={submit}>{busy ? tr("Submitting…") : a.submissions.length ? tr("Submit again") : tr("Submit")}</button>
          {a.maxSubmissions > 0 && <p className="text-xs text-ink-soft">{tr("{left} of {max} submissions left.", { left: a.maxSubmissions - a.submissions.length, max: a.maxSubmissions })}</p>}
        </div>
      ) : <p className="mt-3 text-sm text-ink-soft">{a.reason}</p>)}
    </div>
  );
}
