"use client";

import { QuestionKeyEditor, defaultKey } from "@/components/QuestionKeyEditor";
import { QUESTION_KINDS, KIND_LABEL, type QuestionKind } from "@/lib/question-kinds";
import { SECTION_SHORT } from "@/lib/exam-format";
import { askConfirm } from "@/components/Feedback";
import { useCallback, useEffect, useState } from "react";
import { QuestionHistoryDialog } from "@/components/QuestionHistoryDialog";
import { QuestionPreviewDialog } from "@/components/QuestionPreviewDialog";
import { QuestionTypesDialog, type QType } from "@/components/QuestionTypesDialog";
import { AiQuestionDialog } from "@/components/AiQuestionDialog";
import { uploadImage } from "@/lib/compress-image";
import { CollectionsDialog, ImportDialog, type Cat, type Coll } from "@/components/QuestionCollections";
import { VideoLibrary } from "@/components/VideoLibrary";
import { BankPicker } from "@/components/BankPicker";
import { readWorkspace } from "@/components/WorkspaceSwitch";
import { sectionFromSubject } from "@/lib/section-key";
import { useT } from "@/components/LangProvider";

type Row = { _id: string; section: string; type: string; stem: string; status: string; difficulty: string; issues?: string[] };
type Group = { id: string; section: string; instruction?: string; passageTitle?: string; audioId: string | null; questions: number };
const SKILLS = ["knowledge", "application", "reasoning", "comprehension"]; // saran saja; skill bebas
type AudioRow = { id: string; title: string; durationSec: number; inUse: boolean };
type Form = {
  id?: string; section: string; type: string; groupId: string; stem: string; options: string[]; answerKey: number;
  explanation: string; tags: { skill: string; topic: string }[]; difficulty: string; status: string; assetIds: string[]; source: string;
  kind: QuestionKind; points: number; key?: unknown; stemFormat?: "text" | "html"; categoryId?: string; collectionId?: string;
};

const SECTION = SECTION_SHORT;
const empty = (section = ""): Form => ({ section, type: "", groupId: "", stem: "", options: ["", "", "", ""], answerKey: 0, explanation: "", tags: [], difficulty: "medium", status: "draft", assetIds: [], source: "", kind: "mcq", points: 1 });
const json = (body: unknown) => ({ headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? "Something went wrong");
  return d;
}

export default function BankSoal() {
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [f, setF] = useState({ section: "", type: "", status: "", q: "", categoryId: "", collectionId: "" });
  const [cats, setCats] = useState<Cat[]>([]);
  const [colls, setColls] = useState<Coll[]>([]);
  const [collDlg, setCollDlg] = useState(false);
  const [videoDlg, setVideoDlg] = useState(false);
  const [types, setTypes] = useState<QType[]>([]);
  const [secCounts, setSecCounts] = useState<Record<string, number>>({});
  const [typesDlg, setTypesDlg] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [err, setErr] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [groupDlg, setGroupDlg] = useState(false);
  const [importDlg, setImportDlg] = useState(false);
  const [aiDlg, setAiDlg] = useState(false);
  const tr = useT();
  // Ruang kerja Umum: dua dropdown Mata pelajaran lalu Bank soal, hanya isi bank terpilih yang tampil. Ruang kerja ITP tetap tab bagian.
  const [umum, setUmum] = useState<boolean | null>(null);
  const [me, setMe] = useState("");
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [ungrouped, setUngrouped] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [moveDlg, setMoveDlg] = useState(false);
  useEffect(() => { Promise.all([api("/api/features"), api("/api/me")]).then(([ft, m]) => { setUmum(!(ft.itpPack && readWorkspace() === "itp")); setMe(m.id); }).catch(() => setUmum(true)); }, []);

  const load = useCallback(async () => {
    if (umum === null || (umum && !ready)) return;
    if (umum && !f.collectionId) { setRows([]); setTotal(0); setPages(1); return; }
    const sp = new URLSearchParams({ page: String(page) });
    Object.entries(f).forEach(([k, v]) => v && sp.set(k, v));
    try { const d = await api(`/api/admin/questions?${sp}`); setRows(d.items); setPages(d.pages); setTotal(d.total); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, [page, f, umum, ready]);
  const loadTypes = useCallback(async () => {
    try { const d = await api("/api/admin/question-types"); setTypes(d.types); setSecCounts(d.sectionCounts); } catch { /* daftar jenis opsional bagi tampilan */ }
  }, []);
  const loadMeta = useCallback(async () => {
    try { const [c, k] = await Promise.all([api("/api/admin/categories"), api("/api/admin/collections")]); setCats(c.categories); setColls(k.collections); } catch { /* kategori dan koleksi opsional bagi tampilan */ } finally { setMetaLoaded(true); }
  }, []);
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => {
    if (!umum || !me || !metaLoaded || ready) return;
    let last: { categoryId?: string; collectionId?: string } | null = null;
    try { last = JSON.parse(localStorage.getItem(`qb:last:${me}`) ?? "null"); } catch { /* penyimpanan browser tidak tersedia */ }
    const ok = last && (last.collectionId === "none" || colls.some((c) => c.id === last!.collectionId && c.categoryId === last!.categoryId));
    const first = colls.find((c) => c.categoryId && cats.some((k) => k.id === c.categoryId && k.active));
    const pick = ok ? last : first ? { categoryId: first.categoryId ?? "", collectionId: first.id } : null;
    if (pick) setF((x) => ({ ...x, categoryId: pick.categoryId ?? "", collectionId: pick.collectionId ?? "" }));
    setReady(true);
  }, [umum, me, metaLoaded, ready, colls, cats]);
  useEffect(() => {
    if (!umum || !me || !ready) return;
    try { localStorage.setItem(`qb:last:${me}`, JSON.stringify({ categoryId: f.categoryId, collectionId: f.collectionId })); } catch { /* abaikan */ }
  }, [umum, me, ready, f.categoryId, f.collectionId]);
  useEffect(() => { setSel(new Set()); }, [f.collectionId, page]);
  useEffect(() => { if (umum) api("/api/admin/questions?collectionId=none&page=1").then((d) => setUngrouped(d.total ?? 0)).catch(() => {}); }, [umum, rows]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadTypes(); }, [loadTypes]);
  useEffect(() => { api("/api/admin/questions?status=review&page=1").then((d) => setReviewCount(d.total ?? 0)).catch(() => {}); }, [rows]);

  async function edit(id: string) {
    try {
      const q = await api(`/api/admin/questions/${id}`);
      setForm({ id, section: q.section, type: q.type, groupId: q.groupId ?? "", stem: q.stem, options: q.options, answerKey: q.answerKey, explanation: q.explanation ?? "", tags: (q.tags ?? []).map((t: { skill: string; topic: string }) => ({ skill: t.skill, topic: t.topic })), difficulty: q.difficulty, status: q.status, source: q.source ?? "", assetIds: q.assetIds ?? [], kind: q.kind ?? "mcq", points: q.points ?? 1, key: q.key, stemFormat: q.stemFormat ?? "text", categoryId: q.categoryId ?? "", collectionId: q.collectionId ?? "" });
    } catch (e) { setErr((e as Error).message); }
  }
  async function setStatus(id: string, status: "published" | "draft") {
    try {
      const q = await api(`/api/admin/questions/${id}`);
      await api(`/api/admin/questions/${id}`, { method: "PATCH", ...json({ section: q.section, type: q.type, groupId: q.groupId ?? null, stem: q.stem, options: q.options, answerKey: q.answerKey, kind: q.kind ?? "mcq", points: q.points ?? 1, key: q.key, stemFormat: q.stemFormat ?? "text", explanation: q.explanation || undefined, tags: q.tags ?? [], difficulty: q.difficulty, status, assetIds: q.assetIds ?? [], source: q.source || undefined }) });
      load();
    } catch (e) { setErr((e as Error).message); }
  }
  async function duplicate(id: string) {
    try { const d = await api(`/api/admin/questions/${id}/duplicate`, { method: "POST" }); await load(); await edit(d.id); } catch (e) { setErr((e as Error).message); }
  }
  async function remove(id: string) {
    if (!(await askConfirm("Delete this question?"))) return;
    try { await api(`/api/admin/questions/${id}`, { method: "DELETE" }); load(); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-navy">Question Bank</h1>
          <p className="text-sm text-ink-soft">{umum ? tr("{n} questions in this question bank. Published questions must have a skill + topic tag.", { n: total }) : `${total} questions · used for Placement, Simulation, Practice, and Unit quizzes. Published questions must have a skill + topic tag.`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!(umum && f.collectionId === "none") && <a href={`/api/admin/questions/export?${new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "q") as [string, string][])}`} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Export CSV</a>}
          <button onClick={() => setTypesDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Manage types</button>
          <button onClick={() => setAiDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Draft with AI</button>
          <button onClick={() => setImportDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Import questions</button>
          <button onClick={() => setCollDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">{umum ? tr("Question banks") : "Collections"}</button>
          <button onClick={() => setVideoDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">Videos</button>
          <button onClick={() => setGroupDlg(true)} className="rounded-xl border border-line-strong px-4 py-2.5 text-sm font-semibold text-navy">+ Audio/passage group</button>
          <button onClick={() => setForm({ ...empty(f.section || ""), categoryId: f.collectionId === "none" ? "" : f.categoryId, collectionId: f.collectionId === "none" ? "" : f.collectionId })} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white">+ New question</button>
        </div>
      </div>

      {umum && <UmumPicker cats={cats} colls={colls} f={f} ungrouped={ungrouped} onPick={(categoryId, collectionId) => { setPage(1); setF({ ...f, categoryId, collectionId, type: "" }); }} />}
      {umum === false && <div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 text-sm" role="tablist" aria-label="Section">
        {[["", "All"], ...Object.keys(secCounts).sort().map((k) => [k, SECTION[k]] as [string, string])].map(([k, n]) => (
          <button key={k || "all"} role="tab" aria-selected={f.section === k} onClick={() => { setPage(1); setF({ ...f, section: k, type: "" }); }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-semibold transition ${f.section === k ? "bg-navy text-white" : "text-ink-soft hover:bg-canvas"}`}>
            {n}<span className={`rounded-full px-2 py-0.5 text-xs ${f.section === k ? "bg-white/20" : "bg-canvas"}`}>{k ? secCounts[k] ?? 0 : Object.values(secCounts).reduce((x, y) => x + y, 0)}</span>
          </button>
        ))}
      </div>}

      {umum === false && <div className="flex flex-wrap items-center gap-2 text-sm" role="tablist" aria-label="Subject">
        <span className="font-semibold text-ink-soft">Subject</span>
        {[{ id: "", name: "All subjects" }, ...cats.filter((c) => c.active)].map((c) => (
          <button key={c.id || "all"} role="tab" aria-selected={f.categoryId === c.id} onClick={() => { setPage(1); setF({ ...f, categoryId: c.id, collectionId: "" }); }}
            className={`rounded-lg border px-3 py-1.5 font-semibold transition ${f.categoryId === c.id ? "border-navy bg-navy text-white" : "border-line-strong text-ink-soft hover:bg-canvas"}`}>{c.name}</button>
        ))}
        <select className="field w-auto" aria-label="Collection" value={f.collectionId} onChange={(e) => { setPage(1); setF({ ...f, collectionId: e.target.value }); }}>
          <option value="">All collections</option>
          {colls.filter((c) => !f.categoryId || c.categoryId === f.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.questions})</option>)}
        </select>
      </div>}
      {umum === false && cats.length === 0 && <p className="rounded-xl border border-line bg-white p-3 text-sm text-ink-soft">No subjects yet. Create a category under Courses &amp; Units, then use Collections to organise questions per subject.</p>}

      {reviewCount > 0 && f.status !== "review" && (
        <button onClick={() => { setPage(1); setF({ ...f, status: "review" }); }} className="flex items-center justify-between gap-3 rounded-xl border border-accent bg-accent-tint px-4 py-3 text-left text-sm font-semibold text-accent-dark hover:brightness-95">
          <span>Review queue: {reviewCount} question{reviewCount === 1 ? "" : "s"} waiting for approval</span><span>Open queue</span>
        </button>
      )}
      <div className="flex flex-wrap gap-3">
        <input className="field max-w-xs" placeholder="Search question text" value={f.q} onChange={(e) => { setPage(1); setF({ ...f, q: e.target.value }); }} />
        <select className="field w-auto" aria-label="Question type" value={f.type} onChange={(e) => { setPage(1); setF({ ...f, type: e.target.value }); }}>
          <option value="">All types</option>
          {types.filter((t) => (umum ? t.section === sectionFromSubject(cats.find((c) => c.id === f.categoryId)?.name) : !f.section || t.section === f.section)).map((t) => <option key={t.id} value={t.name}>{f.section ? t.name : `${SECTION[t.section]}: ${t.name}`} ({t.count})</option>)}
        </select>
        <select className="field w-auto" value={f.status} onChange={(e) => { setPage(1); setF({ ...f, status: e.target.value }); }}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="archived">Archived</option>
        </select>
      </div>

      {err && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</p>}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-xs uppercase text-ink-soft"><tr>{umum && f.collectionId === "none" && <th className="p-3"><input type="checkbox" aria-label={tr("Select all on this page")} checked={rows.length > 0 && sel.size === rows.length} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r._id)) : new Set())} /></th>}{!umum && <th className="p-3">Section</th>}<th className={umum ? "p-3" : ""}>Type</th><th>Question</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id} className="border-t border-line">
                {umum && f.collectionId === "none" && <td className="p-3"><input type="checkbox" aria-label={tr("Select question")} checked={sel.has(r._id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(r._id); else n.delete(r._id); return n; })} /></td>}{!umum && <td className="p-3 font-semibold text-navy">{SECTION[r.section]}</td>}<td className={umum ? "p-3" : ""}>{r.type}</td>
                <td className="max-w-md"><p className="truncate">{r.stem}</p>{!!r.issues?.length && <p className="mt-0.5 flex flex-wrap gap-1">{r.issues.map((x) => <span key={x} className="rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-accent-dark">{x}</span>)}</p>}</td>
                <td><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${r.status === "published" ? "bg-success-tint text-success" : r.status === "archived" ? "bg-canvas text-ink-soft" : "bg-accent-tint text-accent-dark"}`}>{r.status}</span></td>
                <td className="whitespace-nowrap p-3 text-right"><button className="mr-3 font-semibold text-brand" onClick={() => edit(r._id)}>Edit</button>{r.status === "review" && <><button className="mr-3 font-semibold text-success" onClick={() => setStatus(r._id, "published")}>Approve</button><button className="mr-3 font-semibold text-accent-dark" onClick={() => setStatus(r._id, "draft")}>Send back</button></>}<button className="mr-3 font-semibold text-brand" onClick={() => duplicate(r._id)}>Duplicate</button><button className="font-semibold text-red-700" onClick={() => remove(r._id)}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-ink-soft">{umum ? (cats.length === 0 ? tr("No subjects yet. Create a category under Courses & Units first.") : f.collectionId === "" ? tr("Choose a subject and a question bank to see its questions.") : f.collectionId === "none" ? tr("Every question is in a question bank.") : tr("No questions in this question bank yet. Click “New question” or import a file.")) : "No questions yet. Click “New question”."}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-ink-soft">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-line-strong px-3 py-1.5 disabled:opacity-40">Previous</button>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-lg border border-line-strong px-3 py-1.5 disabled:opacity-40">Next</button>
        </div>
      </div>

      {form && <Editor umum={!!umum} cats={cats} colls={colls} types={types} onTypesChanged={loadTypes} form={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); load(); }} onNewGroup={() => setGroupDlg(true)} />}
      {typesDlg && <QuestionTypesDialog types={types} onClose={() => setTypesDlg(false)} onChanged={() => { loadTypes(); load(); }} />}
      {groupDlg && <GroupDialog onClose={() => setGroupDlg(false)} />}
      {aiDlg && <AiQuestionDialog types={types} onClose={() => setAiDlg(false)} onSaved={() => { setAiDlg(false); load(); }} />}
      {umum && f.collectionId === "none" && sel.size > 0 && <div role="status" className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand bg-white p-3 shadow-lg"><span className="text-sm font-semibold text-navy">{tr("{n} selected", { n: sel.size })}</span><button className="btn-solid" onClick={() => setMoveDlg(true)}>{tr("Move to a question bank")}</button></div>}
      {moveDlg && <MoveDialog cats={cats} colls={colls} ids={[...sel]} onClose={() => setMoveDlg(false)} onMoved={() => { setMoveDlg(false); setSel(new Set()); load(); loadMeta(); }} onCreated={(c) => setColls((x) => [...x, c])} />}
      {importDlg && <ImportDialog umum={!!umum} cats={cats} colls={colls} defaults={{ categoryId: f.collectionId === "none" ? "" : f.categoryId, collectionId: f.collectionId === "none" ? "" : f.collectionId }} onClose={() => { setImportDlg(false); load(); loadMeta(); loadTypes(); }} />}
      {videoDlg && <VideoLibrary onClose={() => setVideoDlg(false)} />}
      {collDlg && <CollectionsDialog umum={!!umum} cats={cats} colls={colls} onClose={() => setCollDlg(false)} onChanged={() => { loadMeta(); load(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div role="dialog" aria-modal className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-navy">{title}</h2><button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-ink-soft">×</button></div>
        {children}
      </div>
    </div>
  );
}
const Label = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="flex flex-col gap-1.5 text-sm font-semibold text-navy">{t}{children}</label>;

function Editor({ umum, cats, colls, form, types, onTypesChanged, onClose, onSaved, onNewGroup }: { umum: boolean; cats: Cat[]; colls: Coll[]; form: Form; types: QType[]; onTypesChanged: () => void; onClose: () => void; onSaved: () => void; onNewGroup: () => void }) {
  const [v, setV] = useState(form);
  const [groups, setGroups] = useState<Group[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, val: Form[K]) => setV((x) => ({ ...x, [k]: val }));
  const [sub, setSub] = useState<null | "preview" | "history">(null);

  const section = umum ? sectionFromSubject(cats.find((c) => c.id === v.categoryId)?.name) : v.section; // Umum: section diturunkan dari mata pelajaran bank
  useEffect(() => { api(`/api/admin/groups?section=${section}`).then((d) => setGroups(d.groups)).catch(() => {}); }, [section]);

  async function save() {
    if (umum && !v.collectionId) return setErr("Choose a question bank for this question.");
    setBusy(true); setErr("");
    try {
      const body = {
        ...(umum ? {} : { section: v.section }), type: v.type, groupId: v.groupId || null, stem: v.stem, stemFormat: v.stemFormat ?? "text", categoryId: v.categoryId || null, collectionId: v.collectionId || null, kind: v.kind, points: v.points,
        ...(v.kind === "mcq" ? { options: v.options, answerKey: v.answerKey } : { key: v.key }),
        explanation: v.explanation || undefined, tags: v.tags.filter((t) => t.skill.trim() && t.topic.trim()), difficulty: v.difficulty, status: v.status, assetIds: v.assetIds, source: v.source || undefined,
      };
      const d = await api(v.id ? `/api/admin/questions/${v.id}` : "/api/admin/questions", { method: v.id ? "PATCH" : "POST", ...json(body) });
      if (d.usedInTest) alert("This question is used by a test. Changing the key or options affects future test scores; saved results are not recalculated.");
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function attach(file?: File) {
    if (!file) return;
    try { const a = await uploadImage(file); set("assetIds", [...v.assetIds, a.id]); } catch (e) { setErr((e as Error).message); }
  }

  return (
    <Modal title={v.id ? "Edit question" : "New question"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {umum && <div className="sm:col-span-2"><BankPicker cats={cats} colls={colls} value={{ categoryId: v.categoryId ?? "", collectionId: v.collectionId ?? "" }} onChange={(b) => setV((x) => ({ ...x, categoryId: b.categoryId, collectionId: b.collectionId, groupId: "" }))} /></div>}
          {!umum && <><Label t="Section"><input className="field font-normal" list="qb-sections" maxLength={32} placeholder="e.g. math, logic, reading" value={v.section} onChange={(e) => { set("section", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_")); set("groupId", ""); }} /><datalist id="qb-sections">{Object.keys(SECTION).map((k) => <option key={k} value={k}>{SECTION[k]}</option>)}</datalist></Label>
          <Label t="Subject"><select className="field font-normal" value={v.categoryId ?? ""} onChange={(e) => { set("categoryId", e.target.value); set("collectionId", ""); }}><option value="">No subject</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label>
          <Label t="Collection"><select className="field font-normal" value={v.collectionId ?? ""} onChange={(e) => set("collectionId", e.target.value)}><option value="">No collection</option>{colls.filter((c) => !v.categoryId || !c.categoryId || c.categoryId === v.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Label></>}
          <TypePicker section={section} value={v.type} types={types} onChange={(t) => set("type", t)} onCreated={onTypesChanged} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label t="Question kind"><select className="field font-normal" value={v.kind} onChange={(e) => { const k = e.target.value as QuestionKind; setV((x) => ({ ...x, kind: k, key: defaultKey(k) })); }}>{QUESTION_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Label>
          <Label t="Points"><input className="field font-normal" type="number" min={0} max={100} step="0.5" value={v.points} onChange={(e) => set("points", Number(e.target.value))} /></Label>
        </div>
        <Label t="Group (audio / passage)">
          <div className="flex gap-2">
            <select className="field font-normal" value={v.groupId} onChange={(e) => set("groupId", e.target.value)}>
              <option value="">No group</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.passageTitle || g.instruction || g.id.slice(-6)}{g.audioId ? " 🔊" : ""} ({g.questions} questions)</option>)}
            </select>
            <button type="button" onClick={onNewGroup} className="shrink-0 rounded-lg border border-line-strong px-3 text-sm">+ New</button>
          </div>
        </Label>
        <Label t="Question text"><textarea className={`field py-2 font-normal ${v.stemFormat === "html" ? "h-40 font-mono text-sm" : "h-24"}`} value={v.stem} onChange={(e) => set("stem", e.target.value)} />
          {v.stemFormat === "html" && <span className="text-xs font-normal text-ink-soft">This question keeps its formatting (code, images, tables), so the text above is HTML. Use Preview to see how participants will see it.</span>}</Label>
        {v.kind !== "mcq" && <QuestionKeyEditor kind={v.kind} value={v.key} points={v.points} onChange={(k) => set("key", k)} />}
        {v.kind === "mcq" && <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy">Answer options (select the correct one)</legend>
          {v.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="key" aria-label={`Correct answer ${"ABCDEF"[i]}`} checked={v.answerKey === i} onChange={() => set("answerKey", i)} />
              <span className="w-5 text-sm font-semibold">{"ABCDEF"[i]}</span>
              <input className="field" value={o} onChange={(e) => set("options", v.options.map((x, j) => (j === i ? e.target.value : x)))} />
              {v.options.length > 2 && <button type="button" aria-label="Remove option" className="text-red-700" onClick={() => { set("options", v.options.filter((_, j) => j !== i)); set("answerKey", v.answerKey >= i && v.answerKey > 0 ? v.answerKey - 1 : v.answerKey); }}>×</button>}
            </div>
          ))}
          {v.options.length < 6 && <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => set("options", [...v.options, ""])}>+ Add option</button>}
        </fieldset>}
        <Label t="Source / usage rights (optional)"><input className="field font-normal" maxLength={200} placeholder="e.g. written in-house, adapted from ..." value={v.source} onChange={(e) => set("source", e.target.value)} /></Label>
        <Label t="Explanation"><textarea className="field h-20 py-2 font-normal" value={v.explanation} onChange={(e) => set("explanation", e.target.value)} /></Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label t="Difficulty"><select className="field" value={v.difficulty} onChange={(e) => set("difficulty", e.target.value)}><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></Label>
          <Label t="Status"><select className="field" value={v.status} onChange={(e) => set("status", e.target.value)}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option><option value="archived">Archived</option></select></Label>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold text-navy">Tag skill + topic {v.status === "published" && <span className="font-normal text-red-700">(at least one required for published)</span>}</legend>
          <datalist id="skills">{SKILLS.map((k) => <option key={k} value={k} />)}</datalist>
          {v.tags.map((t, i) => (
            <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-2">
              <input aria-label="Skill" list="skills" className="field font-normal" placeholder="skill" value={t.skill} onChange={(e) => set("tags", v.tags.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)))} />
              <input aria-label="Topic" className="field font-normal" placeholder="topic, e.g. subject-verb agreement" value={t.topic} onChange={(e) => set("tags", v.tags.map((x, j) => (j === i ? { ...x, topic: e.target.value } : x)))} />
              <button type="button" aria-label="Remove tag" className="px-2 text-red-700" onClick={() => set("tags", v.tags.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {v.tags.length < 10 && <button type="button" className="self-start text-sm font-semibold text-brand" onClick={() => set("tags", [...v.tags, { skill: v.section, topic: "" }])}>+ Add tag</button>}
        </fieldset>
        {<AudioPicker groups={groups} groupId={v.groupId} onGroup={(id, g) => { set("groupId", id); if (g) setGroups((x) => [...x, g]); }} />}
        <div>
          <p className="mb-1 text-sm font-semibold text-navy">Images (auto-compressed to 300 KB or less)</p>
          <div className="flex flex-wrap items-center gap-3">
            {v.assetIds.map((id) => (
              <span key={id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/assets/${id}`} alt="Question attachment" className="h-16 rounded-lg border border-line" />
                <button type="button" aria-label="Remove image" onClick={() => set("assetIds", v.assetIds.filter((x) => x !== id))} className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-red-600 text-xs text-white">×</button>
              </span>
            ))}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => attach(e.target.files?.[0])} className="text-sm" />
          </div>
        </div>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {v.kind === "mcq" && <button type="button" onClick={() => setSub("preview")} className="mr-auto rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-navy">Preview</button>}
          {v.id && <button type="button" onClick={() => setSub("history")} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold text-navy">History</button>}
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
      {sub === "preview" && <QuestionPreviewDialog q={{ section: v.section, type: v.type, groupId: v.groupId, stem: v.stem, stemFormat: v.stemFormat, options: v.options, answerKey: v.answerKey, explanation: v.explanation, assetIds: v.assetIds }} onClose={() => setSub(null)} />}
      {sub === "history" && v.id && <QuestionHistoryDialog questionId={v.id} onClose={() => setSub(null)} onRestored={() => { setSub(null); onSaved(); }} />}
    </Modal>
  );
}

/** T-AUD: audio langsung di soal kategori mana pun. Memilih/mengunggah audio otomatis memakai grup yang sudah ada untuk audio itu, atau membuatnya. */
function AudioPicker({ groups, groupId, onGroup }: { groups: Group[]; groupId: string; onGroup: (id: string, created?: Group) => void }) {
  const [audios, setAudios] = useState<AudioRow[]>([]);
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const current = groups.find((g) => g.id === groupId);
  const audioId = current?.audioId ?? "";

  const loadAudio = useCallback(() => api("/api/admin/audio").then((d) => setAudios(d.audio)).catch(() => {}), []);
  useEffect(() => { loadAudio(); }, [loadAudio]);

  async function pickAudio(id: string) {
    setErr("");
    if (!id) return onGroup("");
    const existing = groups.find((g) => g.audioId === id);
    if (existing) return onGroup(existing.id);
    try {
      const g = await api("/api/admin/groups", { method: "POST", ...json({ section: "listening", audioId: id }) });
      onGroup(g.id, { id: g.id, section: "listening", audioId: id, questions: 0 });
    } catch (e) { setErr((e as Error).message); }
  }
  async function upload(file?: File) {
    if (!file) return;
    setErr(""); setMsg("Uploading…");
    if (file.size > 15 * 1024 * 1024) { setMsg(""); return setErr("Maximum 15 MB"); }
    const fd = new FormData(); fd.append("file", file); if (title) fd.append("title", title); if (transcript) fd.append("transcript", transcript);
    try { const d = await api("/api/audio", { method: "POST", body: fd }); setMsg(d.deduped ? "The same file already exists and was reused." : `Uploaded (${d.durationSec} sec).`); await loadAudio(); await pickAudio(d.audioId); }
    catch (e) { setMsg(""); setErr((e as Error).message); }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <p className="text-sm font-semibold text-navy">Audio for this question (optional)</p>
      <select aria-label="Saved audio" className="field font-normal" value={audioId} onChange={(e) => pickAudio(e.target.value)}>
        <option value="">Choose saved audio</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec} sec){a.inUse ? " · in use" : ""}</option>)}
      </select>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-brand">Upload new audio</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input aria-label="Audio title" className="field font-normal" placeholder="Audio title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea aria-label="Transcript" className="field h-16 py-2 font-normal" placeholder="Transcript (admin only; shown to participants after the test)" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
          <input type="file" aria-label="File MP3" accept=".mp3,audio/mpeg" className="text-sm" onChange={(e) => upload(e.target.files?.[0])} />
          <p className="text-xs text-ink-soft">MP3, max 15 MB / 10 minutes.</p>
        </div>
      </details>
      {msg && <p className="text-sm text-success">{msg}</p>}
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {audioId && <audio controls controlsList="nodownload" src={`/api/audio/${audioId}`} className="w-full" />}
      {current && <p className="text-xs text-ink-soft">This question is part of that audio group{current.questions ? `, together with ${current.questions} other questions` : ""}. Several questions can share one audio.</p>}
    </div>
  );
}

function GroupDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState("listening");
  const [instruction, setInstruction] = useState("");
  const [audioId, setAudioId] = useState("");
  const [title, setTitle] = useState("");
  const [transcript, setTranscript] = useState("");
  const [passageTitle, setPassageTitle] = useState("");
  const [passageHtml, setPassageHtml] = useState("");
  const [audios, setAudios] = useState<AudioRow[]>([]);
  const [videoId, setVideoId] = useState("");
  const [videos, setVideos] = useState<{ id: string; title: string; kind: string }[]>([]);
  useEffect(() => { api("/api/admin/videos").then((d) => setVideos(d.videos)).catch(() => {}); }, []);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const loadAudio = useCallback(() => api("/api/admin/audio").then((d) => setAudios(d.audio)).catch(() => {}), []);
  useEffect(() => { loadAudio(); }, [loadAudio]);

  async function upload(file?: File) {
    if (!file) return;
    setErr(""); setMsg("Uploading…");
    if (file.size > 15 * 1024 * 1024) { setMsg(""); return setErr("Maximum 15 MB"); }
    const fd = new FormData(); fd.append("file", file); if (title) fd.append("title", title); if (transcript) fd.append("transcript", transcript);
    try { const d = await api("/api/audio", { method: "POST", body: fd }); setAudioId(d.audioId); setMsg(d.deduped ? "The same file already exists and was reused." : `Uploaded (${d.durationSec} sec).`); loadAudio(); }
    catch (e) { setMsg(""); setErr((e as Error).message); }
  }
  async function save() {
    setBusy(true); setErr("");
    try {
      await api("/api/admin/groups", { method: "POST", ...json({ section, instruction: instruction || undefined, audioId: audioId || null, videoId: videoId || null, passageTitle: passageTitle || undefined, passageHtml: passageHtml || undefined }) });
      onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <Modal title="Audio / passage group" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">One audio or passage can be used by several questions. Create a group here, then select it when creating questions.</p>
        <Label t="Category"><select className="field" value={section} onChange={(e) => setSection(e.target.value)}>{Object.entries(SECTION).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Label>
        <Label t="Instruction"><input className="field font-normal" placeholder="Listen to the conversation." value={instruction} onChange={(e) => setInstruction(e.target.value)} /></Label>
        {section === "listening" ? (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <Label t="Saved audio">
              <select className="field font-normal" value={audioId} onChange={(e) => setAudioId(e.target.value)}>
                <option value="">Choose or upload new</option>{audios.map((a) => <option key={a.id} value={a.id}>{a.title} ({a.durationSec} sec){a.inUse ? " · in use" : ""}</option>)}
              </select>
            </Label>
            <Label t="Audio title (optional)"><input className="field font-normal" value={title} onChange={(e) => setTitle(e.target.value)} /></Label>
            <Label t="Transcript (admin only; shown to participants after the test)"><textarea className="field h-20 py-2 font-normal" value={transcript} onChange={(e) => setTranscript(e.target.value)} /></Label>
            <label className="text-sm font-semibold text-navy">Upload MP3 (max 15 MB, 10 minutes)
              <input type="file" accept=".mp3,audio/mpeg" className="mt-1 block text-sm font-normal" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {msg && <p className="text-sm text-success">{msg}</p>}
            {audioId && <audio controls controlsList="nodownload" src={`/api/audio/${audioId}`} className="w-full" />}
          </div>
        ) : (
          <>
            <Label t="Passage title"><input className="field font-normal" value={passageTitle} onChange={(e) => setPassageTitle(e.target.value)} /></Label>
            <Label t="Passage content (simple HTML: p, b, i, u, ul, ol, table; sanitized on the server)"><textarea className="field h-40 py-2 font-mono text-sm font-normal" value={passageHtml} onChange={(e) => setPassageHtml(e.target.value)} /></Label>
          </>
        )}
        <Label t="Video (optional)">
          <select className="field font-normal" value={videoId} onChange={(e) => setVideoId(e.target.value)}>
            <option value="">No video</option>{videos.map((v) => <option key={v.id} value={v.id}>{v.title} ({v.kind === "upload" ? "uploaded clip" : "link"})</option>)}
          </select>
          <span className="text-xs font-normal text-ink-soft">Participants watch the video above the questions. Add videos under Videos.</span>
        </Label>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg border border-line-strong px-4 py-2 text-sm font-semibold">Cancel</button>
          <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Save group</button>
        </div>
      </div>
    </Modal>
  );
}


/** Jenis soal dipilih dari daftar kategori; "+ New type" membuat jenis baru tanpa meninggalkan form. */
function TypePicker({ section, value, types, onChange, onCreated }: { section: string; value: string; types: QType[]; onChange: (t: string) => void; onCreated: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const list = types.filter((t) => t.section === section && (t.active || t.name.toLowerCase() === value.toLowerCase()));
  const known = list.some((t) => t.name.toLowerCase() === value.toLowerCase());
  async function create() {
    setErr("");
    try { await api("/api/admin/question-types", { method: "POST", ...json({ section, name }) }); onChange(name.trim()); setAdding(false); setName(""); onCreated(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Label t="Question type">
      {adding ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input className="field font-normal" autoFocus placeholder="New type name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            <button type="button" className="btn-solid shrink-0" disabled={!name.trim()} onClick={create}>Add</button>
            <button type="button" className="btn-outline shrink-0" onClick={() => { setAdding(false); setErr(""); }}>Cancel</button>
          </div>
          {err && <span role="alert" className="text-xs font-normal text-red-700">{err}</span>}
        </div>
      ) : (
        <select className="field font-normal" value={known ? list.find((t) => t.name.toLowerCase() === value.toLowerCase())!.name : value} onChange={(e) => (e.target.value === "__new" ? setAdding(true) : onChange(e.target.value))}>
          <option value="">Choose a type</option>
          {!known && value && <option value={value}>{value} (not in the list yet)</option>}
          {list.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
          <option value="__new">+ New type…</option>
        </select>
      )}
    </Label>
  );
}

/** Ruang kerja Umum: pilih Mata pelajaran lalu Bank soal. "Belum dikelompokkan" memuat soal lama tanpa bank (untuk dipindah massal). */
function UmumPicker({ cats, colls, f, ungrouped, onPick }: { cats: Cat[]; colls: Coll[]; f: { categoryId: string; collectionId: string }; ungrouped: number; onPick: (categoryId: string, collectionId: string) => void }) {
  const tr = useT();
  const none = f.collectionId === "none";
  const banks = colls.filter((c) => c.categoryId === f.categoryId);
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-3">
      <label className="flex flex-col gap-1 text-xs font-semibold text-navy">{tr("Subject")}
        <select className="field !h-10 w-auto min-w-[13rem] font-normal" value={none ? "__none" : f.categoryId} onChange={(e) => {
          const v = e.target.value;
          if (v === "__none") return onPick("", "none");
          onPick(v, colls.find((c) => c.categoryId === v)?.id ?? "");
        }}>
          {!none && !f.categoryId && <option value="">{tr("Choose a subject")}</option>}
          {cats.filter((c) => c.active || c.id === f.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          {(ungrouped > 0 || none) && <option value="__none">{tr("Not grouped yet")} ({ungrouped})</option>}
        </select>
      </label>
      {!none && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-navy">{tr("Question bank")}
          <select className="field !h-10 w-auto min-w-[13rem] font-normal" disabled={!f.categoryId} value={f.collectionId} onChange={(e) => onPick(f.categoryId, e.target.value)}>
            {!f.collectionId && <option value="">{f.categoryId ? (banks.length ? tr("Choose a question bank") : tr("No question bank in this subject yet")) : tr("Choose a subject first")}</option>}
            {banks.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.questions})</option>)}
          </select>
        </label>
      )}
      {none && <p className="text-sm text-ink-soft">{tr("These older questions are not in a question bank yet. Select them and move them to a bank.")}</p>}
    </div>
  );
}

/** Pindah massal soal terpilih ke sebuah bank (hanya soal yang boleh diubah pengguna yang pindah). */
function MoveDialog({ cats, colls, ids, onClose, onMoved, onCreated }: { cats: Cat[]; colls: Coll[]; ids: string[]; onClose: () => void; onMoved: () => void; onCreated: (c: Coll) => void }) {
  const tr = useT();
  const [pick, setPick] = useState({ categoryId: "", collectionId: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr("");
    try {
      const d = await api("/api/admin/questions/move", { method: "POST", ...json({ ids, collectionId: pick.collectionId }) });
      if (d.skipped > 0) alert(tr("{moved} moved. {skipped} could not be moved because you cannot change them.", { moved: d.moved, skipped: d.skipped }));
      onMoved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title={tr("Move to a question bank")} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-soft">{tr("{n} selected", { n: ids.length })}</p>
        <BankPicker cats={cats} colls={colls} value={pick} onChange={setPick} allowNew onCreated={onCreated} />
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <div className="flex justify-end gap-2"><button className="btn-outline" onClick={onClose}>{tr("Cancel")}</button><button className="btn-solid" disabled={busy || !pick.collectionId} onClick={go}>{tr("Move")}</button></div>
      </div>
    </Modal>
  );
}
