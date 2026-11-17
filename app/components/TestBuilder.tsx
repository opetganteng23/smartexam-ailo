"use client";

import { SECTION_SHORT } from "@/lib/exam-format";
import { BankPicker } from "@/components/BankPicker";
import type { Cat, Coll } from "@/components/QuestionCollections";
import { useT } from "@/components/LangProvider";
import { useEffect, useState } from "react";

export type T = { id: string; name: string; kind: string; active: boolean; archived?: boolean; updatedAt?: string; testMode?: boolean; questions: number; durationSec: number; attempts: number };
export type QRow = { _id: string; section: string; type: string; stem: string };
export type Draw = { collectionId: string; count: number; topics: string[]; difficulties: ("easy" | "medium" | "hard")[] };
export type Sec = { name: string; durationSec: number; questionIds: string[]; draw?: Draw | null };
export type Daily = { start: string; end: string; maxPerDay: number };
export type Draft = { id?: string; name: string; kind: string; levelId: string; active: boolean; testMode?: boolean; resultDelayMin?: number; sections: Sec[]; attempts: number; shuffleQuestions?: boolean; shuffleWithinParts?: boolean; shuffleOptions?: boolean; requirePlacement?: boolean; secureMode?: boolean; secureBack?: boolean; screenWatch?: boolean; maxAttempts?: number; scoringProfileId?: string; purpose?: string; courseId?: string; categoryId?: string; bankId?: string; extraBankIds?: string[]; pairedTestId?: string; daily?: Daily | null };

const SECTION = SECTION_SHORT;
export const KIND: Record<string, string> = { placement: "Placement", sim: "Simulation", final: "Final Test", practice: "Practice", quiz: "Unit quiz", section: "Section test", general: "General test" };
export const PURPOSE: Record<string, string> = { daily: "Daily quiz", pretest: "Pre-test", posttest: "Post-test", midterm: "Midterm (UTS)", final: "Final exam (UAS)" };
const DEFAULT_MIN: Record<string, number> = { listening: 35, structure: 25, reading: 55 };

export async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong");
  return d;
}

/** Tes jenis ini milik program belajar (dipasang di unit atau course), bukan tes terjadwal. */
export const LEARNING_KINDS = ["quiz", "section"];

export const NEW_DRAFT = (kind = "placement"): Draft => ({ name: "", kind, levelId: "", active: false, testMode: true, attempts: 0, sections: [] });

export async function loadDraft(id: string): Promise<Draft> {
  const t = await api(`/api/admin/tests/${id}`);
  return { id, name: t.name, kind: t.kind, levelId: t.levelId ? String(t.levelId) : "", active: t.active, testMode: !!t.testMode, resultDelayMin: t.resultDelayMin ?? 0, attempts: t.attempts, scoringProfileId: t.scoringProfileId ? String(t.scoringProfileId) : "", shuffleQuestions: !!t.shuffleQuestions, shuffleWithinParts: !!t.shuffleWithinParts, secureMode: !!t.secureMode, secureBack: !!t.secureBack, screenWatch: !!t.screenWatch, shuffleOptions: !!t.shuffleOptions, requirePlacement: t.requirePlacement !== false, maxAttempts: t.maxAttempts ?? 0, purpose: t.purpose ?? "", courseId: t.courseId ? String(t.courseId) : "", categoryId: t.categoryId ? String(t.categoryId) : "", bankId: t.bankId ? String(t.bankId) : "", extraBankIds: (t.extraBankIds ?? []).map(String), pairedTestId: t.pairedTestId ? String(t.pairedTestId) : "", daily: t.daily?.start ? { start: t.daily.start, end: t.daily.end, maxPerDay: t.daily.maxPerDay ?? 0 } : null,
    sections: t.sections.map((s: Sec) => ({ name: s.name, durationSec: s.durationSec, questionIds: s.questionIds.map(String), draw: s.draw?.collectionId ? { collectionId: String(s.draw.collectionId), count: s.draw.count, topics: s.draw.topics ?? [], difficulties: s.draw.difficulties ?? [] } : null })) };
}

/** Editor tes. inline: tampil di dalam tab halaman tes (tanpa jendela dan tombol Cancel). onSaved menerima id tes. */
export function Builder({ draft, onClose, onSaved, inline, kinds }: { draft: Draft; onClose?: () => void; onSaved: (id: string) => void; inline?: boolean; kinds?: string[] }) {
  const [v, setV] = useState(draft);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [levels, setLevels] = useState<{ id: string; name: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; name: string; verified: boolean; isDefault: boolean; status: string }[]>([]);
  useEffect(() => { api("/api/admin/scoring").then((d) => setProfiles(d.profiles)).catch(() => {}); }, []);
  useEffect(() => { api("/api/admin/levels").then((d) => setLevels(d.levels)).catch(() => {}); }, []);
  const locked = v.attempts > 0; // susunan dikunci bila sudah dikerjakan

  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { name: v.name, kind: v.kind, levelId: v.levelId || null, active: v.active, testMode: !!v.testMode, resultDelayMin: Math.max(0, Math.min(1440, Number(v.resultDelayMin) || 0)), scoringProfileId: v.scoringProfileId || null, shuffleQuestions: !!v.shuffleQuestions, shuffleWithinParts: !!v.shuffleWithinParts, shuffleOptions: !!v.shuffleOptions, requirePlacement: v.requirePlacement !== false, secureMode: !!v.secureMode, secureBack: !!v.secureBack, screenWatch: !!v.screenWatch, maxAttempts: Number(v.maxAttempts) || 0,
        ...(v.kind === "general" ? { purpose: v.purpose || null, courseId: v.courseId || null, categoryId: v.categoryId || null, bankId: v.bankId || null, extraBankIds: v.bankId ? v.extraBankIds ?? [] : [], pairedTestId: v.purpose === "posttest" ? v.pairedTestId || null : null, daily: v.purpose === "daily" && v.daily?.start && v.daily?.end ? { start: v.daily.start, end: v.daily.end, maxPerDay: Number(v.daily.maxPerDay) || 0 } : null } : {}),
        sections: v.sections.filter((s) => s.questionIds.length || s.draw).map((s) => ({ name: s.name, durationSec: s.durationSec, questionIds: s.draw ? [] : s.questionIds, draw: s.draw ?? null })) };
      const d = await api(v.id ? `/api/admin/tests/${v.id}` : "/api/admin/tests", { method: v.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      setBusy(false);
      onSaved(v.id ?? d.id);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  const setSec = (i: number, s: Sec) => setV((x) => ({ ...x, sections: x.sections.map((o, j) => (j === i ? s : o)) }));

  const body = (
      <>
        {locked && <p className="mb-4 rounded-lg bg-accent-tint p-3 text-sm text-accent-dark">This test has been taken {v.attempts} times. The question set and durations are locked so earlier scores stay valid. You can still change the name and active status.</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy sm:col-span-2">Test name<input className="field font-normal" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">Type<select disabled={locked} className="field" value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>{Object.entries(KIND).filter(([k]) => !kinds || kinds.includes(k) || k === v.kind).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        </div>
        {v.kind === "general" && <GeneralFields v={v} setV={setV} locked={locked} />}
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active (shown in the test list)</label>
        <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!v.testMode} onChange={(e) => setV({ ...v, testMode: e.target.checked })} /><span><b className="text-navy">Test mode</b> (for QA only). Only admins and QA testers can see and start this test, even when Active is on. Turn it off when the test has been checked and is ready for participants.</span></label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-navy sm:max-w-md">Release results after (minutes)<input type="number" min={0} max={1440} className="field w-32 font-normal" value={v.resultDelayMin ?? 0} onChange={(e) => setV({ ...v, resultDelayMin: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-xs font-normal text-ink-soft">Counted from when each participant starts. 0 = results appear right after submitting; 120 = two hours after they start, so early finishers cannot share answers with people still taking the test. Until then the score, review, and analysis stay hidden and nothing is emailed. Admins and QA testers always see results immediately.</span></label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-navy sm:max-w-md">Scoring profile<select className="field font-normal" value={v.scoringProfileId ?? ""} onChange={(e) => setV({ ...v, scoringProfileId: e.target.value })}><option value="">Default profile{profiles.find((p) => p.isDefault) ? ` (${profiles.find((p) => p.isDefault)!.name})` : ""}</option>{profiles.filter((p) => p.status === "active" && !p.isDefault).map((p) => <option key={p.id} value={p.id}>{p.name}{p.verified ? " · verified" : " · provisional"}</option>)}</select><span className="text-xs font-normal text-ink-soft">How raw scores become section and total scores. Manage profiles in Scoring Profiles.</span></label>
        {(
          <fieldset className="mt-3 rounded-xl border border-line p-4">
            <legend className="px-2 text-sm font-semibold text-navy">Test rules</legend>
            <label className="flex min-h-[40px] items-start gap-2 rounded-lg bg-accent-tint p-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!v.secureMode} onChange={(e) => setV({ ...v, secureMode: e.target.checked })} /><span><b>Secure mode</b><br /><span className="text-xs text-ink-soft">Strict mode: participants cannot go back to previous questions, and copying, pasting, right-click, and the browser Back button are turned off.</span></span></label>
            {v.secureMode && <label className="ml-6 flex min-h-[40px] items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!v.secureBack} onChange={(e) => setV({ ...v, secureBack: e.target.checked })} /><span>Allow going back to previous questions<br /><span className="text-xs text-ink-soft">Lenient secure mode: copying, pasting, right-click, and the browser Back button stay off, but participants can return to earlier questions in the current section. Leave off for strict one-way mode.</span></span></label>}
            <label className="flex min-h-[40px] items-start gap-2 rounded-lg bg-brand-tint p-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!v.screenWatch} onChange={(e) => setV({ ...v, screenWatch: e.target.checked })} /><span><b>Live screen view</b><br /><span className="text-xs text-ink-soft">On laptops and PCs, participants share their entire screen before the questions appear; admins see a live thumbnail (about every 12 seconds) in Monitoring. Nothing is recorded or stored. Phones and tablets can still take the test and are marked &quot;No screen share&quot;.</span></span></label>
            <label className="flex min-h-[40px] items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={!!v.shuffleQuestions} onChange={(e) => setV({ ...v, shuffleQuestions: e.target.checked, shuffleWithinParts: e.target.checked ? false : v.shuffleWithinParts })} /><span>Shuffle question order for each participant<br /><span className="text-xs text-ink-soft">Questions that share a passage or audio stay together, in their original order. Sections stay in the order you set.</span></span></label>
            {v.kind !== "general" && <label className="flex min-h-[40px] items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={v.requirePlacement !== false} onChange={(e) => setV({ ...v, requirePlacement: e.target.checked })} /><span><b>Participants take the placement test first</b><span className="block text-xs text-ink-soft">Turn this off for general exams that are not part of a level program.</span></span></label>}
            <label className="flex min-h-[40px] items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" disabled={v.attempts > 0} checked={!!v.shuffleOptions} onChange={(e) => setV({ ...v, shuffleOptions: e.target.checked })} /><span>Shuffle answer options<br /><span className="text-xs text-ink-soft">Each participant sees the answer options in a different order. Cannot be changed after the test has been taken.</span></span></label>
            {v.kind !== "placement" && <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-navy">Attempt limit per participant<input type="number" min={0} max={50} className="field w-24" value={v.maxAttempts ?? 0} onChange={(e) => setV({ ...v, maxAttempts: Math.max(0, Number(e.target.value) || 0) })} /><span className="text-xs font-normal text-ink-soft">0 = unlimited</span></label>}
          </fieldset>
        )}
        {v.kind !== "general" && <label className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-navy sm:max-w-xs">Target level<select disabled={locked || v.kind === "placement"} className="field font-normal" value={v.kind === "placement" ? "" : v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}><option value="">All levels</option>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>}
        {v.kind === "placement" && <p className="mt-2 text-xs text-ink-soft">Placement is taken once per participant and determines their level, so it is not limited by level.</p>}
        {v.kind === "quiz" && <p className="mt-2 text-xs text-ink-soft">Unit quizzes do not appear in My Tests; they are taken from learning units.</p>}
        {v.kind === "section" && <p className="mt-2 text-xs text-ink-soft">Section tests (one per exam part) do not appear in My Tests; attach one to a course and learners take it at the end of that course.</p>}

        <div className="mt-5 flex flex-col gap-5">
          {v.sections.map((s, i) => <SectionBox key={s.name} s={s} locked={locked} generalKind={v.kind === "general"} bankIds={v.kind === "general" && v.bankId ? [v.bankId, ...(v.extraBankIds ?? [])] : undefined} onChange={(n) => setSec(i, n)} onRemove={locked ? undefined : () => setV((x) => ({ ...x, sections: x.sections.filter((_, j) => j !== i) }))} />)}
          {!v.sections.length && <p className="rounded-xl bg-canvas p-4 text-sm text-ink-soft">No sections yet. Add at least one section below. A section is a part of the exam (for example Math or Logic); its name is the question category its questions come from.</p>}
          {!locked && <AddSection general={v.kind === "general"} existing={v.sections.map((x) => x.name)} onAdd={(list) => setV((x) => ({ ...x, sections: [...x.sections, ...list.map((o) => ({ name: o.name, durationSec: o.min * 60, questionIds: [] }))] }))} />}
        </div>
        <div className={`mt-5 flex items-center justify-end gap-3 ${inline ? "sticky bottom-0 -mx-1 border-t border-line bg-white px-1 py-3" : ""}`}>
          {err && <p role="alert" className="mr-auto text-sm text-red-700">{err}</p>}
          {onClose && <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>}
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : v.id ? "Save changes" : "Create test"}</button>
        </div>
      </>
  );
  if (inline) return <div className="card">{body}</div>;
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal className="my-6 w-full max-w-3xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-navy">{v.id ? "Edit test" : "New test"}</h2><button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-ink-soft">×</button></div>
        {body}
      </div>
    </div>
  );
}

function SectionBox({ s, locked, generalKind, bankIds, onChange, onRemove }: { s: Sec; locked: boolean; generalKind?: boolean; bankIds?: string[]; onChange: (s: Sec) => void; onRemove?: () => void }) {
  const [chosen, setChosen] = useState<QRow[]>([]);
  const [q, setQ] = useState("");
  const [pool, setPool] = useState<QRow[]>([]);
  const [auto, setAuto] = useState({ count: 10, type: "", difficulty: "" });
  const [autoMsg, setAutoMsg] = useState("");
  const [typeNames, setTypeNames] = useState<string[]>([]);
  useEffect(() => { api(`/api/admin/question-types`).then((d) => setTypeNames(d.types.filter((t: { section: string; active: boolean }) => t.section === s.name && t.active).map((t: { name: string }) => t.name))).catch(() => {}); }, [s.name]);
  async function autoFill() {
    setAutoMsg("");
    try {
      const d = await api("/api/admin/questions/pick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(bankIds ? { collectionIds: bankIds } : { section: s.name }), count: auto.count, types: auto.type ? [auto.type] : undefined, difficulties: auto.difficulty ? [auto.difficulty] : undefined, excludeIds: s.questionIds }) });
      if (d.ids.length) onChange({ ...s, questionIds: [...s.questionIds, ...d.ids] });
      setAutoMsg(d.picked === 0 ? `No published questions match (${d.available} available).` : d.short ? `Added ${d.picked}. Only ${d.picked} fit the criteria (${d.available} matching questions, passage groups kept whole).` : `Added ${d.picked} random questions.`);
    } catch (e) { setAutoMsg((e as Error).message); }
  }

  // Muat detail soal terpilih (urutan mengikuti questionIds).
  useEffect(() => {
    if (!s.questionIds.length) return setChosen([]);
    api(`/api/admin/questions?ids=${s.questionIds.join(",")}`).then((d) => setChosen(d.items)).catch(() => {});
  }, [s.questionIds]);

  useEffect(() => {
    if (locked) return;
    const scope = bankIds ? `collectionIds=${bankIds.join(",")}` : `section=${s.name}`; // tes umum: hanya bank tes (dan bank lain yang sengaja dipilih)
    const t = setTimeout(() => api(`/api/admin/questions?${scope}&status=published&q=${encodeURIComponent(q)}`).then((d) => setPool(d.items)).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, s.name, locked, bankIds?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = s.questionIds;
  const move = (i: number, d: number) => { const a = [...ids]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange({ ...s, questionIds: a }); };

  if (s.draw) return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-2 font-display font-extrabold text-navy">{SECTION[s.name]} · {s.draw.count} random questions</legend>
      {onRemove && <button type="button" onClick={onRemove} className="float-right text-sm font-semibold text-red-700">Remove section</button>}
      <label className="flex items-center gap-2 text-sm font-semibold text-navy">Duration (minutes)
        <input type="number" min={1} max={180} disabled={locked} className="field w-24" value={Math.round(s.durationSec / 60)} onChange={(e) => onChange({ ...s, durationSec: Math.max(1, Number(e.target.value) || DEFAULT_MIN[s.name]) * 60 })} />
      </label>
      <DrawEditor draw={s.draw} locked={locked} onChange={(d) => onChange({ ...s, draw: d })} />
      {!locked && <button type="button" className="mt-3 text-sm font-semibold text-brand" onClick={() => onChange({ ...s, draw: null })}>Use fixed questions instead</button>}
    </fieldset>
  );
  return (
    <fieldset className="rounded-xl border border-line p-4">
      <legend className="px-2 font-display font-extrabold text-navy">{SECTION[s.name]} · {ids.length} questions</legend>
      {generalKind && !locked && ids.length === 0 && <button type="button" className="float-right mr-4 text-sm font-semibold text-brand" onClick={() => onChange({ ...s, draw: { collectionId: "", count: 10, topics: [], difficulties: [] } })}>Draw randomly from a collection</button>}
      {onRemove && <button type="button" onClick={onRemove} className="float-right text-sm font-semibold text-red-700">Remove section</button>}
      <label className="flex items-center gap-2 text-sm font-semibold text-navy">Duration (minutes)
        <input type="number" min={1} max={180} disabled={locked} className="field w-24" value={Math.round(s.durationSec / 60)} onChange={(e) => onChange({ ...s, durationSec: Math.max(1, Number(e.target.value) || DEFAULT_MIN[s.name]) * 60 })} />
      </label>
      <ol className="mt-3 flex flex-col gap-1.5">
        {ids.map((id, i) => {
          const r = chosen.find((c) => c._id === id);
          return (
            <li key={id} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-1.5 text-sm">
              <span className="w-6 font-semibold text-ink-soft">{i + 1}</span>
              <span className="flex-1 truncate">{r ? r.stem : id}</span>
              {!locked && <>
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="px-1 text-xs font-semibold disabled:opacity-30">Up</button>
                <button disabled={i === ids.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="px-1 text-xs font-semibold disabled:opacity-30">Down</button>
                <button onClick={() => onChange({ ...s, questionIds: ids.filter((x) => x !== id) })} aria-label="Remove" className="px-1 text-red-700">×</button>
              </>}
            </li>
          );
        })}
        {ids.length === 0 && <li className="text-sm text-ink-soft">No questions yet. Choose from the list below.</li>}
      </ol>
      {!locked && (
        <div className="mt-3 rounded-xl bg-brand-tint/50 p-3">
          <p className="text-sm font-semibold text-navy">Auto-fill by criteria</p>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-navy">How many<input type="number" min={1} max={100} className="field !h-10 w-20" value={auto.count} onChange={(e) => setAuto({ ...auto, count: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Type<select className="field !h-10 w-auto" value={auto.type} onChange={(e) => setAuto({ ...auto, type: e.target.value })}><option value="">Any type</option>{typeNames.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Difficulty<select className="field !h-10 w-auto" value={auto.difficulty} onChange={(e) => setAuto({ ...auto, difficulty: e.target.value })}><option value="">Any</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label>
            <button type="button" className="btn-solid !min-h-[40px]" onClick={autoFill}>Add random questions</button>
          </div>
          {autoMsg && <p role="status" className="mt-2 text-xs text-ink-soft">{autoMsg}</p>}
        </div>
      )}
      {!locked && (
        <div className="mt-3">
          <input className="field mb-2" placeholder={bankIds ? "Search published questions in the selected question bank" : `Search ${SECTION[s.name]} questions (published)`} value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="max-h-48 overflow-y-auto rounded-lg border border-line">
            {pool.filter((p) => !ids.includes(p._id)).map((p) => (
              <li key={p._id} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-sm last:border-0">
                <span className="flex-1 truncate">{p.stem}</span><span className="text-xs text-ink-soft">{p.type}</span>
                <button onClick={() => onChange({ ...s, questionIds: [...ids, p._id] })} className="font-semibold text-brand">+ Add</button>
              </li>
            ))}
            {pool.filter((p) => !ids.includes(p._id)).length === 0 && <li className="p-3 text-sm text-ink-soft">No matching published questions.</li>}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

/** Tambah bagian ujian: nama bebas (sama dengan kategori soal) dan durasi. */
function AddSection({ general, existing, onAdd }: { general?: boolean; existing: string[]; onAdd: (list: { name: string; min: number }[]) => void }) {
  const [name, setName] = useState("");
  const [min, setMin] = useState(30);
  const [cats, setCats] = useState<string[]>([]);
  const [err, setErr] = useState("");
  useEffect(() => { api("/api/admin/question-types").then((d) => setCats(Array.from(new Set((d.types as { section: string }[]).map((t) => t.section))))).catch(() => {}); }, []);
  const key = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
  function add() {
    if (!/^[a-z][a-z0-9_]{1,31}$/.test(key)) return setErr("Use 2 to 32 letters, numbers, or underscores, starting with a letter (for example math).");
    if (existing.includes(key)) return setErr("This section is already in the test.");
    setErr(""); onAdd([{ name: key, min: Math.max(1, Math.min(180, Number(min) || 30)) }]); setName("");
  }
  return (
    <div className="rounded-xl border border-dashed border-line-strong p-4">
      <p className="text-sm font-semibold text-navy">Add a section</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-navy">{general ? "Section name" : "Section name (question category)"}
          <input className="field w-56 font-normal" list={general ? undefined : "tb-cats"} placeholder={general ? "e.g. part_1" : "e.g. math"} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />{!general && <datalist id="tb-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>}
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Minutes
          <input type="number" min={1} max={180} className="field w-24 font-normal" value={min} onChange={(e) => setMin(Number(e.target.value))} />
        </label>
        <button type="button" className="btn-solid" onClick={add}>+ Add section</button>
      </div>
      {err && <p role="alert" className="mt-2 text-xs text-red-700">{err}</p>}
    </div>
  );
}

const lbl = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Pengaturan tes umum: tujuan, course, kategori, pasangan pre-test, dan jendela harian kuis. */
function GeneralFields({ v, setV, locked }: { v: Draft; setV: (d: Draft) => void; locked: boolean }) {
  const tr = useT();
  type CourseRow = { id: string; title: string; track?: string; categoryId?: string | null; bankId?: string | null };
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [colls, setColls] = useState<Coll[]>([]);
  const [bankErr, setBankErr] = useState("");
  const [pre, setPre] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    api("/api/admin/courses").then((d) => setCourses((d.courses as CourseRow[]).filter((c) => c.track === "general"))).catch(() => {});
    api("/api/admin/collections").then((d) => setColls(d.collections)).catch(() => {});
    api("/api/admin/categories").then((d) => setCats(d.categories)).catch(() => {});
    api("/api/admin/tests?kind=general").then((d) => setPre((d.tests as { id: string; name: string; kind: string; purpose?: string }[]).filter((t) => t.kind === "general" && t.purpose === "pretest" && t.id !== v.id))).catch(() => {});
  }, [v.id]);
  const d = v.daily ?? { start: "07:00", end: "21:00", maxPerDay: 0 };
  // Memilih course memasang bank bawaannya (dibuat bila course lama belum punya) dan mata pelajarannya.
  async function pickCourse(courseId: string) {
    setBankErr("");
    const c = courses.find((x) => x.id === courseId);
    if (!c) return setV({ ...v, courseId });
    let bankId = c.bankId ?? "";
    try {
      if (!bankId) { const r = await api("/api/admin/courses/" + courseId + "/bank", { method: "POST" }); bankId = r.bankId; api("/api/admin/collections").then((x) => setColls(x.collections)).catch(() => {}); }
      setV({ ...v, courseId, bankId, categoryId: c.categoryId ?? v.categoryId ?? "", extraBankIds: [] });
    } catch (e) { setBankErr((e as Error).message); setV({ ...v, courseId }); }
  }
  const others = colls.filter((c) => c.id !== v.bankId && (c.categoryId === v.categoryId || (v.extraBankIds ?? []).includes(c.id)));
  return (
    <fieldset className="mt-3 rounded-xl border border-line p-4">
      <legend className="px-2 text-sm font-semibold text-navy">General test</legend>
      <p className="mb-3 text-xs text-ink-soft">Scored as a percentage with a pass mark of 60 unless you choose another scoring profile. No placement or level is needed.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={lbl}>Purpose<select disabled={locked} className="field font-normal" value={v.purpose ?? ""} onChange={(e) => setV({ ...v, purpose: e.target.value, daily: e.target.value === "daily" ? v.daily ?? { start: "07:00", end: "21:00", maxPerDay: 0 } : null })}><option value="">Choose a purpose</option>{Object.entries(PURPOSE).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label className={lbl}>Course (optional)<select disabled={locked} className="field font-normal" value={v.courseId ?? ""} onChange={(e) => pickCourse(e.target.value)}><option value="">Not inside a course</option>{courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select><span className="text-xs font-normal text-ink-soft">Inside a course, only participants who can open that course can take the test.</span></label>
        <div className="sm:col-span-2"><BankPicker disabled={locked} cats={cats} colls={colls} value={{ categoryId: v.categoryId ?? "", collectionId: v.bankId ?? "" }} onChange={(b) => setV({ ...v, categoryId: b.categoryId, bankId: b.collectionId, extraBankIds: [] })} allowNew onCreated={(c) => setColls((x) => [...x, c])} />
          <p className="mt-1 text-xs text-ink-soft">{tr("Fixed questions for this test are chosen from this question bank. A test inside a course uses the course's question bank.")}</p>
          {bankErr && <p role="alert" className="text-xs text-red-700">{bankErr}</p>}
        </div>
        {v.bankId && others.length > 0 && !locked && (
          <fieldset className="sm:col-span-2 rounded-lg border border-line p-3"><legend className="px-1 text-xs font-semibold text-navy">{tr("Also allow questions from other question banks")}</legend>
            {others.map((c) => <label key={c.id} className="mr-4 inline-flex items-center gap-1.5 text-sm"><input type="checkbox" checked={(v.extraBankIds ?? []).includes(c.id)} onChange={(e) => setV({ ...v, extraBankIds: e.target.checked ? [...(v.extraBankIds ?? []), c.id] : (v.extraBankIds ?? []).filter((x) => x !== c.id) })} />{c.name}</label>)}
          </fieldset>
        )}
        {v.purpose === "posttest" && <label className={lbl}>Paired pre-test<select className="field font-normal" value={v.pairedTestId ?? ""} onChange={(e) => setV({ ...v, pairedTestId: e.target.value })}><option value="">None</option>{pre.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select><span className="text-xs font-normal text-ink-soft">Used for the pre/post improvement report.</span></label>}
      </div>
      {v.purpose === "daily" && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className={lbl}>Opens every day (WIB, 24-hour)<input className="field w-28 text-center font-normal tabular-nums" inputMode="numeric" placeholder="HH:mm" maxLength={5} value={d.start} onChange={(e) => setV({ ...v, daily: { ...d, start: e.target.value } })} /></label>
          <label className={lbl}>Closes<input className="field w-28 text-center font-normal tabular-nums" inputMode="numeric" placeholder="HH:mm" maxLength={5} value={d.end} onChange={(e) => setV({ ...v, daily: { ...d, end: e.target.value } })} /></label>
          <label className={lbl}>Attempts per day<input type="number" min={0} max={50} className="field w-24 font-normal" value={d.maxPerDay} onChange={(e) => setV({ ...v, daily: { ...d, maxPerDay: Math.max(0, Number(e.target.value) || 0) } })} /><span className="text-xs font-normal text-ink-soft">0 means unlimited.</span></label>
        </div>
      )}
    </fieldset>
  );
}

/** Bagian yang soalnya ditarik acak dari koleksi bank soal tiap percobaan. */
function DrawEditor({ draw, locked, onChange }: { draw: Draw; locked: boolean; onChange: (d: Draw) => void }) {
  const tr = useT();
  const [colls, setColls] = useState<Coll[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [topicsText, setTopicsText] = useState(draw.topics.join(", ")); // teks mentah: koma yang baru diketik tidak boleh hilang
  useEffect(() => { api("/api/admin/collections").then((d) => setColls(d.collections)).catch(() => {}); api("/api/admin/categories").then((d) => setCats(d.categories)).catch(() => {}); }, []);
  const catOf = colls.find((c) => c.id === draw.collectionId)?.categoryId ?? "";
  return (
    <div className="mt-3 rounded-xl bg-brand-tint/50 p-3 text-sm">
      <p className="font-semibold text-navy">Questions are drawn at random from a question bank each time a participant starts.</p>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <BankPicker compact disabled={locked} cats={cats} colls={colls} value={{ categoryId: catOf, collectionId: draw.collectionId }} onChange={(b) => onChange({ ...draw, collectionId: b.collectionId })} />
        <label className="flex flex-col gap-1 text-xs font-semibold text-navy">How many<input disabled={locked} type="number" min={1} max={200} className="field !h-10 w-20" value={draw.count} onChange={(e) => onChange({ ...draw, count: Math.max(1, Number(e.target.value) || 1) })} /></label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-navy">Topics (comma separated, optional)<input disabled={locked} className="field !h-10 w-56 font-normal" value={topicsText} onChange={(e) => { setTopicsText(e.target.value); onChange({ ...draw, topics: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }); }} /></label>
        <fieldset className="flex items-center gap-3 text-xs font-semibold text-navy"><legend className="sr-only">Difficulty</legend>{(["easy", "medium", "hard"] as const).map((k) => <label key={k} className="flex items-center gap-1"><input disabled={locked} type="checkbox" checked={draw.difficulties.includes(k)} onChange={() => onChange({ ...draw, difficulties: draw.difficulties.includes(k) ? draw.difficulties.filter((x) => x !== k) : [...draw.difficulties, k] })} />{k}</label>)}</fieldset>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Only published questions are drawn. The number asked cannot exceed what matches; leave topics and difficulty empty to draw from the whole collection.</p>
    </div>
  );
}
