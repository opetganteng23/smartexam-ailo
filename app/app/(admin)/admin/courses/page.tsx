"use client";

import { askConfirm, toast } from "@/components/Feedback";
import { useEffect, useState } from "react";
import { readWorkspace, type Workspace } from "@/components/WorkspaceSwitch";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { Modal } from "@/components/Modal";
import { uploadImage } from "@/lib/compress-image";
import { Loading, ErrorNote } from "@/components/Charts";
import { PART_LABEL } from "@/lib/exam-format";

type Unit = { id: string; title: string; description: string; order: number; active: boolean; materialIds: string[]; quizTestId: string | null; moduleId: string | null; unlockAfterDays: number };
type Mod = { id: string; title: string; description: string; order: number; active: boolean };
type Course = { whatYouLearn?: string[]; requirements?: string[]; targetAudience?: string; tags?: string[]; previewVideoUrl?: string | null; id: string; levelId: string | null; track?: "general" | "itp"; categoryId?: string | null; institutionIds?: string[]; classIds?: string[]; accessMode?: "assigned" | "paid"; priceIdr?: number | null; title: string; description: string; order: number; active: boolean; archived: boolean; previewMode?: boolean; part?: string | null; sectionTestId?: string | null; requireSectionTest?: boolean; secureMode?: boolean; coverAssetId: string | null; prerequisiteCourseIds: string[]; modules: Mod[]; units: Unit[] };
type Data = { itpPack?: boolean; categories: { id: string; name: string; active: boolean }[]; institutions: { id: string; name: string }[]; classes: { id: string; name: string; institutionId: string | null }[]; levels: { id: string; name: string }[]; materials: { id: string; title: string; status: string; kind: string }[]; quizzes: { id: string; kind?: string; name: string; unitId: string | null }[]; courses: Course[] };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";
const lines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

/** Yang masih kosong di sebuah course (daftar periksa sebelum dirilis). */
const todo = (c: Course) => {
  const out: string[] = [];
  const activeUnits = c.units.filter((u) => u.active);
  if (activeUnits.some((u) => u.materialIds.length === 0)) out.push("materials");
  if (activeUnits.some((u) => !u.quizTestId)) out.push("unit quizzes");
  if (!c.sectionTestId) out.push("section test");
  return out;
};

export default function Kursus() {
  const { data, loading, error, reload } = useApi<Data>("/api/admin/courses");
  const [course, setCourse] = useState<Partial<Course> | null>(null);
  const [unit, setUnit] = useState<(Partial<Unit> & { courseId: string }) | null>(null);
  const [mod, setMod] = useState<(Partial<Mod> & { courseId: string }) | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [wsCookie, setWs] = useState<Workspace>("general");
  const [tplDlg, setTplDlg] = useState(false);
  // Tanpa paket TOEFL ITP (saklar di Settings) ruang kerjanya selalu Umum. Course ITP yang sudah ada tetap terjangkau di bagian bawah.
  const ws: Workspace = data?.itpPack ? wsCookie : "general";
  const legacyItp = !!data && !data.itpPack && data.courses.some((c) => c.track !== "general");
  useEffect(() => { const f = () => setWs(readWorkspace()); f(); window.addEventListener("workspace-change", f); return () => window.removeEventListener("workspace-change", f); }, []);
  const [err, setErr] = useState("");
  const run = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } };

  const scaffold = async (levelId: string, name: string) => {
    if (!(await askConfirm(`Create the TOEFL ITP course template for ${name}? This adds one course per exam part (Listening A, B, C, Structure, Written Expression, Reading) with fixed modules. New courses are Preview only. Parts that already exist are skipped.`, { confirmLabel: "Create" }))) return;
    await run(async () => { const r = await api<{ created: number; skipped: number }>("/api/admin/courses/scaffold", { json: { levelId }, silent: true }); toast(`${r.created} course(s) created, ${r.skipped} already existed.`); });
  };
  const sectionTests = data?.quizzes.filter((q) => q.kind === "section") ?? [];

  const renderCourse = (c: Course) => (
      <div key={c.id} className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {c.coverAssetId ? <img src={`/api/assets/${c.coverAssetId}`} alt="" className="h-12 w-20 shrink-0 rounded-lg object-cover" /> : <span className="h-12 w-20 shrink-0 rounded-lg bg-canvas" aria-hidden />}
            <div className="min-w-0"><b className="text-navy">{c.title}</b> {c.part && <span className="badge-muted ml-1">{PART_LABEL[c.part] ?? c.part}</span>}{c.previewMode && <span className="badge-warn ml-1" title="Only admins and QA testers can see this course">preview only</span>}{todo(c).length > 0 && <span className="badge-warn ml-1" title={todo(c).join("; ")}>needs: {todo(c).join(", ")}</span>}{!c.active && <span className="badge-muted ml-1">inactive</span>}{c.archived && <span className="badge-warn ml-1">archived</span>}{c.secureMode && <span className="badge-muted ml-1">secure</span>}{c.prerequisiteCourseIds.length > 0 && <span className="badge-muted ml-1">needs {c.prerequisiteCourseIds.length} prerequisite{c.prerequisiteCourseIds.length > 1 ? "s" : ""}</span>}{c.description && <p className="text-sm text-ink-soft">{c.description}</p>}</div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold"><button className="text-brand" onClick={() => setMod({ courseId: c.id, active: true, order: c.modules.length })}>+ Module</button><button className="text-brand" onClick={() => setUnit({ courseId: c.id, active: true, order: c.units.length, materialIds: [], unlockAfterDays: 0 })}>+ Unit</button><button className="text-brand" onClick={() => setCourse(c)}>Edit</button><button className="text-brand" onClick={() => run(() => api(`/api/admin/courses/${c.id}`, { method: "PATCH", json: { levelId: c.levelId, title: c.title, description: c.description || undefined, order: c.order, active: c.active, archived: !c.archived, secureMode: !!c.secureMode, coverAssetId: c.coverAssetId, prerequisiteCourseIds: c.prerequisiteCourseIds } }))}>{c.archived ? "Restore" : "Archive"}</button><button className="text-red-700" onClick={() => void askConfirm("Delete this course?").then((ok) => { if (ok) run(() => api(`/api/admin/courses/${c.id}`, { method: "DELETE" })); })}>Delete</button></div>
        </div>
        {c.modules.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Modules">
            {c.modules.map((m) => (
              <li key={m.id} className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm"><b className="text-navy">{m.title}</b><span className="text-xs text-ink-soft">{c.units.filter((u) => u.moduleId === m.id).length} units</span>{!m.active && <span className="badge-muted">inactive</span>}
                <button className="font-semibold text-brand" onClick={() => setMod({ ...m, courseId: c.id })}>Edit</button>
                <button className="font-semibold text-red-700" onClick={() => void askConfirm("Delete this module? Its units stay in the course without a module.").then((ok) => { if (ok) run(() => api(`/api/admin/modules/${m.id}`, { method: "DELETE" })); })}>Delete</button></li>
            ))}
          </ul>
        )}
        <ul className="mt-3 divide-y divide-line">
          {c.units.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span><b className="text-navy">{u.order}. {u.title}</b>{!u.active && <span className="badge-muted ml-2">inactive</span>}<br /><span className="text-xs text-ink-soft">{c.modules.find((m) => m.id === u.moduleId)?.title ?? "No module"} · {u.materialIds.length} required materials{u.quizTestId ? " · has quiz" : ""}{u.unlockAfterDays > 0 ? ` · opens ${u.unlockAfterDays} days after start` : ""}</span></span>
              <span className="flex gap-3 font-semibold"><button className="text-brand" onClick={() => setUnit({ ...u, courseId: c.id })}>Edit</button><button className="text-red-700" onClick={() => void askConfirm("Delete this unit?").then((ok) => { if (ok) run(() => api(`/api/admin/units/${u.id}`, { method: "DELETE" })); })}>Delete</button></span>
            </li>
          ))}
          {c.units.length === 0 && <li className="py-2 text-sm text-ink-soft">No units yet.</li>}
        </ul>
      </div>
  );

  if (loading && !data) return <Loading />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Courses & Units</h1><p className="text-sm text-ink-soft">Build Level, Course, Module, then Unit (lesson) with its required materials (sub-lessons). A unit is complete when all required materials are done and its quiz is passed (pass mark in System Parameters).</p></div>
        <div className="flex items-center gap-4"><label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Show archived</label>
        <Link href="/learn" className="btn-outline">Preview as learner</Link>
        <button className="btn-outline" onClick={() => setTplDlg(true)}>New from template</button>
        <button className="btn-solid" onClick={() => setCourse(ws === "itp" ? { track: "itp", active: true, previewMode: true, order: 0, levelId: data?.levels[0]?.id } : { track: "general", active: true, previewMode: true, order: 0 })}>+ New course</button></div>
      </div>
      <ErrorNote text={error || err} />
      {data && data.itpPack && ws === "general" && data.courses.some((c) => c.track !== "general") && (
        <p role="note" className="rounded-xl border border-accent bg-accent-tint p-3 text-sm text-navy">{data.courses.filter((c) => c.track !== "general").length} TOEFL ITP course(s) are kept in the TOEFL ITP workspace. <button className="font-semibold underline" onClick={() => { document.cookie = "ws=itp; path=/; max-age=31536000; SameSite=Lax"; window.location.reload(); }}>Open the TOEFL ITP workspace</button></p>
      )}
      {data && <CategoriesPanel categories={data.categories} onChanged={reload} />}
      {data && ws === "general" && (() => {
        const gs = data.courses.filter((c) => c.track === "general" && (showArchived || !c.archived));
        return (
          <section className="flex flex-col gap-3" aria-label="General courses">
            <h2 className="font-display text-xl font-extrabold text-navy">General courses</h2>
            {gs.length === 0 && <p className="card text-sm text-ink-soft">No general courses yet. Create a category above, then choose &quot;+ New course&quot; and pick which institutions and classes can see it.</p>}
            {gs.map((c) => renderCourse(c))}
          </section>
        );
      })()}
      {data && (ws === "itp" || legacyItp) && data.levels.map((l) => {
        const cs = data.courses.filter((c) => c.track !== "general" && c.levelId === l.id && (showArchived || !c.archived));
        return (
          <section key={l.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-xl font-extrabold text-navy">{l.name}</h2>
              <button className="btn-outline !min-h-[40px] text-sm" onClick={() => scaffold(l.id, l.name)}>Add TOEFL ITP course template</button></div>
            {cs.length === 0 && <p className="text-sm text-ink-soft">No courses for this level yet.</p>}
            {cs.map((c) => renderCourse(c))}
          </section>
        );
      })}

      <RemedialMapSection />

      {mod && <ModuleEditor init={mod} onClose={() => setMod(null)} onSaved={() => { setMod(null); reload(); }} />}
      {tplDlg && data && <TemplateDialog ws={ws} data={data} onClose={() => setTplDlg(false)} onDone={(m) => { setTplDlg(false); toast(m); reload(); }} />}
      {course && data && <CourseEditor init={course} data={data} levels={data.levels} sectionTests={sectionTests} others={data.courses.filter((x) => x.id !== course.id)} onClose={() => setCourse(null)} onSaved={() => { setCourse(null); reload(); }} />}
      {unit && data && <UnitEditor init={unit} data={data} onClose={() => setUnit(null)} onSaved={() => { setUnit(null); reload(); }} />}
    </div>
  );
}

type RM = { entries: { id: string; skill: string; topic: string; unitId: string; unit: string }[]; units: { id: string; label: string }[]; topics: { skill: string; topic: string; questions: number }[] };

/** Remedial map: topik lemah → unit. Dipakai study plan untuk menautkan item rencana ke unit perbaikan. */
function RemedialMapSection() {
  const { data, error, reload } = useApi<RM>("/api/admin/remedial-map");
  const [v, setV] = useState({ key: "", unitId: "" });
  const [err, setErr] = useState("");
  async function add() {
    const [skill, topic] = v.key.split("|");
    setErr("");
    try { await api("/api/admin/remedial-map", { json: { skill, topic, unitId: v.unitId } }); setV({ key: "", unitId: "" }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <section className="card flex flex-col gap-3">
      <div><h2 className="font-display text-lg font-extrabold text-navy">Remedial map</h2><p className="text-sm text-ink-soft">Weak topics are pointed to a remedial unit. Participants’ study plan items automatically show an “Open unit” button.</p></div>
      <ErrorNote text={err || error} />
      <ul className="divide-y divide-line text-sm">
        {data?.entries.map((e) => <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b className="text-navy">{e.topic}</b> <span className="text-xs text-ink-soft">({e.skill})</span> to {e.unit}</span><button className="font-semibold text-red-700" onClick={() => void askConfirm(`Delete the mapping ${e.topic} to ${e.unit}?`).then((ok) => { if (ok) api(`/api/admin/remedial-map/${e.id}`, { method: "DELETE" }).then(reload).catch((x) => setErr(x.message)); })}>Delete</button></li>)}
        {data?.entries.length === 0 && <li className="py-2 text-ink-soft">No mappings yet.</li>}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <select aria-label="Topic" className="field" value={v.key} onChange={(e) => setV({ ...v, key: e.target.value })}><option value="">Choose a topic (from question tags)</option>{data?.topics.map((t) => <option key={t.skill + t.topic} value={`${t.skill}|${t.topic}`}>{t.topic} ({t.skill}, {t.questions} questions)</option>)}</select>
        <select aria-label="Unit" className="field" value={v.unitId} onChange={(e) => setV({ ...v, unitId: e.target.value })}><option value="">Choose a unit</option>{data?.units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}</select>
        <button className="btn-outline" disabled={!v.key || !v.unitId} onClick={add}>Add</button>
      </div>
    </section>
  );
}

function CategoriesPanel({ categories, onChanged }: { categories: Data["categories"]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); setName(""); onChanged(); } catch (e) { setErr((e as Error).message); } };
  return (
    <details className="card" open={categories.length === 0}>
      <summary className="cursor-pointer font-display text-lg font-extrabold text-navy">Categories (subjects) <span className="text-sm font-semibold text-ink-soft">{categories.length}</span></summary>
      <p className="mt-1 text-sm text-ink-soft">A category is a subject or course name, such as Data Structures. Courses, question collections, and tests are filed under a category.</p>
      <ul className="mt-2 flex flex-wrap gap-2" aria-label="Categories">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm"><b className="text-navy">{c.name}</b>{!c.active && <span className="badge-muted">inactive</span>}
            <button className="font-semibold text-brand" onClick={() => { const n = window.prompt("Category name", c.name)?.trim(); if (n && n !== c.name) void act(() => api(`/api/admin/categories/${c.id}`, { method: "PATCH", json: { name: n, active: c.active } })); }}>Rename</button>
            <button className="font-semibold text-red-700" onClick={() => void askConfirm("Delete this category? Categories still used by a course cannot be deleted.").then((ok) => { if (ok) void act(() => api(`/api/admin/categories/${c.id}`, { method: "DELETE" })); })}>Delete</button></li>
        ))}
        {categories.length === 0 && <li className="text-sm text-ink-soft">No categories yet.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <input className="field w-64" aria-label="New category name" placeholder="e.g. Data Structures" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-outline" disabled={!name.trim()} onClick={() => act(() => api("/api/admin/categories", { json: { name: name.trim() } }))}>Add category</button>
      </div>
      <ErrorNote text={err} />
    </details>
  );
}

function CourseEditor({ init, data, levels, others, sectionTests, onClose, onSaved }: { init: Partial<Course>; data: Data; levels: Data["levels"]; others: Course[]; sectionTests: Data["quizzes"]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ whatYouLearn: (init.whatYouLearn ?? []).join("\n"), requirements: (init.requirements ?? []).join("\n"), targetAudience: init.targetAudience ?? "", tagsText: (init.tags ?? []).join(", "), previewVideoUrl: init.previewVideoUrl ?? "", track: init.track ?? (init.id ? "itp" : "general") as "general" | "itp", levelId: init.levelId ?? (init.id || init.track === "general" ? "" : levels[0]?.id ?? ""), categoryId: init.categoryId ?? "", institutionIds: init.institutionIds ?? [] as string[], classIds: init.classIds ?? [] as string[], accessMode: init.accessMode ?? "assigned" as "assigned" | "paid", priceIdr: init.priceIdr ?? null as number | null, title: init.title ?? "", description: init.description ?? "", order: init.order ?? 0, active: init.active ?? true, archived: init.archived ?? false, previewMode: init.previewMode ?? false, part: init.part ?? "", sectionTestId: init.sectionTestId ?? "", requireSectionTest: init.requireSectionTest ?? false, secureMode: init.secureMode ?? false, coverAssetId: init.coverAssetId ?? null as string | null, prerequisiteCourseIds: init.prerequisiteCourseIds ?? [] as string[] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"info" | "curriculum" | "settings" | "access">("info");
  async function pickCover(f: File | undefined) {
    if (!f) return;
    setErr(""); setBusy(true);
    try { const a = await uploadImage(f, { maxSide: 1000, maxBytes: 200 * 1024 }); setV((x) => ({ ...x, coverAssetId: a.id })); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }
  async function save() {
    try { await api(init.id ? `/api/admin/courses/${init.id}` : "/api/admin/courses", { method: init.id ? "PATCH" : "POST", json: { ...v, whatYouLearn: lines(v.whatYouLearn), requirements: lines(v.requirements), tags: v.tagsText.split(",").map((t) => t.trim()).filter(Boolean), previewVideoUrl: v.previewVideoUrl.trim() || null, targetAudience: v.targetAudience.trim() || undefined, levelId: v.track === "itp" ? v.levelId || null : null, categoryId: v.categoryId || null, priceIdr: v.accessMode === "paid" ? v.priceIdr : null, part: v.track === "itp" ? v.part || null : null, sectionTestId: v.sectionTestId || null, order: Number(v.order), description: v.description || undefined } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit course" : "New course"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div role="tablist" aria-label="Course settings" className="flex flex-wrap gap-1 rounded-xl bg-canvas p-1 text-sm">
          {(["info", "curriculum", "settings", "access"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${tab === k ? "bg-navy text-white" : "text-ink-soft hover:bg-white"}`}>{{ info: "Info", curriculum: "Curriculum", settings: "Settings", access: "Access" }[k]}</button>
          ))}
        </div>
        {tab === "info" && <>
        <label className={label}>Course type<select className="field font-normal" value={v.track} disabled={!!init.id} onChange={(e) => setV({ ...v, track: e.target.value as "general" | "itp" })}><option value="general">General subject (any course or subject)</option><option value="itp">TOEFL ITP (by level)</option></select></label>
        {v.track === "itp" ? <>
          <label className={label}>Level<select className="field font-normal" value={v.levelId} onChange={(e) => setV({ ...v, levelId: e.target.value })}>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          <label className={label}>Exam part<select className="field font-normal" value={v.part} onChange={(e) => setV({ ...v, part: e.target.value })}><option value="">Not tied to a part</option>{Object.entries(PART_LABEL).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        </> : <>
          <label className={label}>Category<select className="field font-normal" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}><option value="">No category</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        </>}
        <label className={label}>Title<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Description<textarea className="field h-20 py-2 font-normal" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <div className={label}>Cover image
          <div className="flex items-center gap-3">
            {v.coverAssetId ? <img src={`/api/assets/${v.coverAssetId}`} alt="Course cover" className="h-16 w-28 rounded-lg object-cover" /> : <span className="flex h-16 w-28 items-center justify-center rounded-lg bg-canvas text-xs font-normal text-ink-soft">No cover</span>}
            <div className="flex flex-col gap-1 font-normal"><input type="file" accept="image/*" aria-label="Upload cover image" disabled={busy} onChange={(e) => pickCover(e.target.files?.[0])} className="text-sm" />{v.coverAssetId && <button type="button" className="self-start text-sm font-semibold text-red-700" onClick={() => setV({ ...v, coverAssetId: null })}>Remove cover</button>}</div>
          </div>
        </div>

        <label className={label}>What participants will learn (one per line, up to 8)<textarea className="field h-24 py-2 font-normal" value={v.whatYouLearn} onChange={(e) => setV({ ...v, whatYouLearn: e.target.value })} /></label>
        <label className={label}>Before starting (knowledge needed, one per line, up to 8)<textarea className="field h-20 py-2 font-normal" value={v.requirements} onChange={(e) => setV({ ...v, requirements: e.target.value })} /></label>
        <label className={label}>Who this course is for<input className="field font-normal" maxLength={300} value={v.targetAudience} onChange={(e) => setV({ ...v, targetAudience: e.target.value })} /></label>
        <label className={label}>Tags (comma separated, up to 8)<input className="field font-normal" value={v.tagsText} onChange={(e) => setV({ ...v, tagsText: e.target.value })} /></label>
        <label className={label}>Introduction video (YouTube or Vimeo link, optional)<input className="field font-normal" placeholder="https://www.youtube.com/watch?v=..." value={v.previewVideoUrl} onChange={(e) => setV({ ...v, previewVideoUrl: e.target.value })} /></label>
        </>}
        {tab === "curriculum" && (
          <div className="flex flex-col gap-3 text-sm">
            {!init.id ? <p className="rounded-lg bg-canvas p-3 text-ink-soft">Save the course first. Then add modules and units with <b>+ Module</b> and <b>+ Unit</b> on the course card.</p> : <>
              <p className="text-ink-soft">{(init.modules ?? []).length} modules · {(init.units ?? []).length} units. Add or edit them with <b>+ Module</b> and <b>+ Unit</b> on the course card, after closing this window.</p>
              <ul className="divide-y divide-line rounded-lg border border-line">
                {(init.units ?? []).map((u, i) => <li key={u.id} className="flex items-center justify-between gap-2 px-3 py-2"><span><span className="text-xs font-semibold text-ink-soft">UNIT {i + 1}</span> <b className="text-navy">{u.title}</b></span><span className="text-xs text-ink-soft">{u.materialIds.length} materials{u.quizTestId ? " · quiz" : ""}</span></li>)}
                {(init.units ?? []).length === 0 && <li className="p-3 text-ink-soft">No units yet.</li>}
              </ul>
            </>}
          </div>
        )}
        {tab === "settings" && <>
        <label className={label}>Order<input className="field font-normal" type="number" min={0} value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} /></label>
        <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Prerequisites ({v.prerequisiteCourseIds.length})</legend>
          <ul className="max-h-40 overflow-y-auto rounded-lg border border-line">
            {others.map((o) => <li key={o.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-0"><input type="checkbox" className="h-5 w-5" checked={v.prerequisiteCourseIds.includes(o.id)} onChange={() => setV((x) => ({ ...x, prerequisiteCourseIds: x.prerequisiteCourseIds.includes(o.id) ? x.prerequisiteCourseIds.filter((i) => i !== o.id) : [...x.prerequisiteCourseIds, o.id] }))} /><span className="flex-1">{o.title}</span></label></li>)}
            {others.length === 0 && <li className="p-3 text-sm text-ink-soft">No other courses yet.</li>}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">Participants can open this course after finishing every unit of the courses ticked here.</p>
        </fieldset>
        <label className={label}>Section test (end of course)<select className="field font-normal" value={v.sectionTestId} onChange={(e) => setV({ ...v, sectionTestId: e.target.value })}><option value="">None</option>{sectionTests.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={v.requireSectionTest} disabled={!v.sectionTestId} onChange={(e) => setV({ ...v, requireSectionTest: e.target.checked })} /><span><b>Require passing the section test</b><br /><span className="text-xs text-ink-soft">When on, courses that list this one as a prerequisite open only after its section test is passed. Off by default: the score is shown as progress only.</span></span></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active</label>
        <label className="flex items-start gap-2 rounded-lg bg-brand-tint p-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={v.previewMode} onChange={(e) => setV({ ...v, previewMode: e.target.checked })} /><span><b>Preview only</b><br /><span className="text-xs text-ink-soft">While this is on, participants (including AirNav) cannot see this course or the materials used only in it, even if Active is on. Admins and QA testers can open it from Learn, at every level, without prerequisites or unlock days. Turn it off to release the course.</span></span></label>
        <label className="flex items-start gap-2 rounded-lg bg-accent-tint p-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5" checked={v.secureMode} onChange={(e) => setV({ ...v, secureMode: e.target.checked })} /><span><b>Secure mode</b><br /><span className="text-xs text-ink-soft">In this course&apos;s units and materials, copying, pasting, right-click, and the browser Back button are turned off.</span></span></label>
        </>}
        {tab === "access" && (v.track === "general" ? <>
          <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Institutions ({v.institutionIds.length === 0 ? "all" : v.institutionIds.length})</legend>
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line">
              {data.institutions.map((o) => <li key={o.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-0"><input type="checkbox" className="h-5 w-5" checked={v.institutionIds.includes(o.id)} onChange={() => setV((x) => ({ ...x, institutionIds: x.institutionIds.includes(o.id) ? x.institutionIds.filter((i) => i !== o.id) : [...x.institutionIds, o.id] }))} /><span className="flex-1">{o.name}</span></label></li>)}
            </ul>
            <p className="mt-1 text-xs text-ink-soft">Leave all unticked to open the course to every institution. The Learning module must also be on for the institution.</p>
          </fieldset>
          <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Classes ({v.classIds.length === 0 ? "all" : v.classIds.length})</legend>
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line">
              {data.classes.filter((c) => !v.institutionIds.length || !c.institutionId || v.institutionIds.includes(c.institutionId)).map((o) => <li key={o.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-0"><input type="checkbox" className="h-5 w-5" checked={v.classIds.includes(o.id)} onChange={() => setV((x) => ({ ...x, classIds: x.classIds.includes(o.id) ? x.classIds.filter((i) => i !== o.id) : [...x.classIds, o.id] }))} /><span className="flex-1">{o.name}</span></label></li>)}
              {data.classes.length === 0 && <li className="p-3 text-sm text-ink-soft">No classes yet. Create classes under Classes.</li>}
            </ul>
            <p className="mt-1 text-xs text-ink-soft">Leave all unticked to open the course to every class of the chosen institutions.</p>
          </fieldset>
          <label className={label}>Access<select className="field font-normal" value={v.accessMode} onChange={(e) => setV({ ...v, accessMode: e.target.value as "assigned" | "paid" })}><option value="assigned">Assigned to institutions and classes</option><option value="paid">Paid by individuals (preparation only, not offered yet)</option></select></label>
          {v.accessMode === "paid" && <label className={label}>Price (IDR)<input className="field font-normal" inputMode="numeric" value={v.priceIdr ?? ""} onChange={(e) => setV({ ...v, priceIdr: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} /></label>}
        </> : <p className="rounded-lg bg-canvas p-3 text-sm text-ink-soft">TOEFL ITP courses are opened by level and placement. Institution and class access applies to general courses.</p>)}
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.title.trim() || busy} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function ModuleEditor({ init, onClose, onSaved }: { init: Partial<Mod> & { courseId: string }; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ title: init.title ?? "", description: init.description ?? "", order: init.order ?? 0, active: init.active ?? true });
  const [err, setErr] = useState("");
  async function save() {
    try { await api(init.id ? `/api/admin/modules/${init.id}` : "/api/admin/modules", { method: init.id ? "PATCH" : "POST", json: { courseId: init.courseId, ...v, order: Number(v.order), description: v.description || undefined } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={init.id ? "Edit module" : "New module"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <label className={label}>Module title<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Description<textarea className="field h-16 py-2 font-normal" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <label className={label}>Order<input className="field font-normal" type="number" min={0} value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} /></label>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.title.trim()} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function UnitEditor({ init, data, onClose, onSaved }: { init: Partial<Unit> & { courseId: string }; data: Data; onClose: () => void; onSaved: () => void }) {
  const mods = data.courses.find((c) => c.id === init.courseId)?.modules ?? [];
  const [v, setV] = useState({ title: init.title ?? "", description: init.description ?? "", order: init.order ?? 0, active: init.active ?? true, materialIds: init.materialIds ?? [], quizTestId: init.quizTestId ?? "", moduleId: init.moduleId ?? "", unlockAfterDays: init.unlockAfterDays ?? 0 });
  const [err, setErr] = useState("");
  const toggle = (id: string) => setV((x) => ({ ...x, materialIds: x.materialIds.includes(id) ? x.materialIds.filter((m) => m !== id) : [...x.materialIds, id] }));
  async function save() {
    try { await api(init.id ? `/api/admin/units/${init.id}` : "/api/admin/units", { method: init.id ? "PATCH" : "POST", json: { courseId: init.courseId, ...v, order: Number(v.order), description: v.description || undefined, quizTestId: v.quizTestId || null, moduleId: v.moduleId || null, unlockAfterDays: Number(v.unlockAfterDays) || 0 } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  }
  const freeQuizzes = data.quizzes.filter((q) => (q.kind ?? "quiz") === "quiz" && (!q.unitId || q.unitId === init.id));
  return (
    <Modal title={init.id ? "Edit unit" : "New unit"} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <label className={label}>Unit title<input className="field font-normal" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></label>
        <label className={label}>Description<textarea className="field h-16 py-2 font-normal" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Order<input className="field font-normal" type="number" min={0} value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) })} /></label>
          <label className={label}>Module<select className="field font-normal" value={v.moduleId} onChange={(e) => setV({ ...v, moduleId: e.target.value })}><option value="">No module</option>{mods.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</select></label>
          <label className={label}>Opens after (days)<input className="field font-normal" type="number" min={0} max={365} value={v.unlockAfterDays} onChange={(e) => setV({ ...v, unlockAfterDays: Number(e.target.value) })} /><span className="text-xs font-normal text-ink-soft">0 = open from the start. Counted from the day the participant starts the course.</span></label>
          <label className={label}>Unit quiz<select className="field font-normal" value={v.quizTestId} onChange={(e) => setV({ ...v, quizTestId: e.target.value })}><option value="">No quiz</option>{freeQuizzes.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}</select></label>
        </div>
        <fieldset><legend className="mb-1 text-sm font-semibold text-navy">Required materials ({v.materialIds.length})</legend>
          <ul className="max-h-56 overflow-y-auto rounded-lg border border-line">
            {data.materials.map((m) => (
              <li key={m.id}><label className="flex min-h-[44px] cursor-pointer items-center gap-3 border-b border-line px-3 text-sm last:border-0"><input type="checkbox" className="h-5 w-5" checked={v.materialIds.includes(m.id)} onChange={() => toggle(m.id)} /><span className="flex-1">{m.title}</span>{m.status !== "published" && <span className="badge-warn">not published</span>}</label></li>
            ))}
            {data.materials.length === 0 && <li className="p-3 text-sm text-ink-soft">No materials yet.</li>}
          </ul>
          <p className="mt-1 text-xs text-ink-soft">Unpublished materials are not shown to participants until published. No quiz yet? <a href="/admin/tests?group=learning&new=quiz" target="_blank" rel="noopener" className="font-semibold text-brand">Create a quiz</a> (opens a new tab), then come back and pick it here.</p>
        </fieldset>
        <label className="flex min-h-[44px] items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />Active</label>
        <ErrorNote text={err} />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!v.title.trim()} onClick={save}>Save</button></div>
      </div>
    </Modal>
  );
}

function TemplateDialog({ ws, data, onClose, onDone }: { ws: Workspace; data: Data; onClose: () => void; onDone: (msg: string) => void }) {
  const tpl = useApi<{ templates: { key: string; name: string; description: string; track: "general" | "itp"; modules: { title: string; units: number }[] }[] }>("/api/admin/course-templates");
  const list = (tpl.data?.templates ?? []).filter((t) => t.track === ws);
  const [key, setKey] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [levelId, setLevelId] = useState(data.levels[0]?.id ?? "");
  const [err, setErr] = useState("");
  const cur = list.find((t) => t.key === key) ?? list[0];
  async function create() {
    setErr("");
    try {
      const r = await api<{ id?: string; created?: number; skipped?: number; modules?: number; units?: number }>("/api/admin/course-templates", { json: cur?.track === "itp" ? { templateKey: cur.key, levelId } : { templateKey: cur?.key, title: title.trim(), categoryId: categoryId || null }, silent: true });
      onDone(cur?.track === "itp" ? `${r.created} course(s) created, ${r.skipped} already existed.` : `Course created with ${r.modules} modules and ${r.units} units. It is Preview only until you release it.`);
    } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title="New course from a template" onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-ink-soft">A template creates the modules and empty units for you. The new course is Preview only: participants cannot see it until you release it.</p>
        <ul className="flex flex-col gap-2" aria-label="Templates">
          {list.map((t) => (
            <li key={t.key}><label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${cur?.key === t.key ? "border-brand bg-brand-tint" : "border-line"}`}>
              <input type="radio" name="tpl" className="mt-1 h-4 w-4" checked={cur?.key === t.key} onChange={() => setKey(t.key)} />
              <span><b className="text-navy">{t.name}</b><br /><span className="text-xs text-ink-soft">{t.description}</span>{t.modules.length > 0 && <span className="mt-1 block text-xs text-ink-soft">{t.modules.length} modules · {t.modules.reduce((n, m) => n + m.units, 0)} units</span>}</span>
            </label></li>
          ))}
        </ul>
        {cur?.track === "itp"
          ? <label className={label}>Level<select className="field font-normal" value={levelId} onChange={(e) => setLevelId(e.target.value)}>{data.levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
          : <>
            <label className={label}>Course title<input className="field font-normal" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label className={label}>Category<select className="field font-normal" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">No category</option>{data.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          </>}
        <ErrorNote text={err} />
        <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>Cancel</button><button className="btn-solid" disabled={!cur || (cur.track === "general" && !title.trim())} onClick={create}>Create course</button></div>
      </div>
    </Modal>
  );
}
