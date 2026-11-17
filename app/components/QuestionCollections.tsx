"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { askConfirm } from "@/components/Feedback";
import { api } from "@/lib/client";
import { BankPicker } from "@/components/BankPicker";

export type Cat = { id: string; name: string; active: boolean };
export type Coll = { id: string; name: string; categoryId: string | null; description: string; visibility: "private" | "institution" | "global"; institutionId: string | null; mine: boolean; questions: number };
const VIS: Record<Coll["visibility"], string> = { private: "Private (only me and admins)", institution: "One institution", global: "Everyone who manages questions" };
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Kelola koleksi bank soal: buat, ganti nama atau visibilitas, hapus (hanya bila kosong). */
export function CollectionsDialog({ cats, colls, onClose, onChanged }: { cats: Cat[]; colls: Coll[]; onClose: () => void; onChanged: () => void }) {
  const [institutions, setInstitutions] = useState<{ id: string; name: string }[]>([]);
  const [v, setV] = useState({ id: "", name: "", categoryId: "", visibility: "private" as Coll["visibility"], institutionId: "", description: "" });
  const [err, setErr] = useState("");
  useEffect(() => { api<{ institutions: { id: string; name: string }[] }>("/api/admin/institutions").then((d) => setInstitutions(d.institutions)).catch(() => {}); }, []);
  const reset = () => setV({ id: "", name: "", categoryId: "", visibility: "private", institutionId: "", description: "" });
  async function save() {
    setErr("");
    try {
      const body = { name: v.name.trim(), categoryId: v.categoryId || null, visibility: v.visibility, institutionId: v.visibility === "institution" ? v.institutionId || null : null, description: v.description.trim() || undefined };
      await api(v.id ? `/api/admin/collections/${v.id}` : "/api/admin/collections", { method: v.id ? "PATCH" : "POST", json: body, silent: true });
      reset(); onChanged();
    } catch (e) { setErr((e as Error).message); }
  }
  async function remove(c: Coll) {
    if (!(await askConfirm(`Delete the collection "${c.name}"? Only empty collections can be deleted.`))) return;
    try { await api(`/api/admin/collections/${c.id}`, { method: "DELETE", silent: true }); onChanged(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title="Question collections" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">A collection groups questions of one subject, for example &quot;UTS Data Structures&quot;. Tests can draw questions from a collection. Visibility decides who can see and use its questions.</p>
        <ul className="max-h-56 overflow-y-auto rounded-lg border border-line" aria-label="Collections">
          {colls.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-0">
              <b className="text-navy">{c.name}</b><span className="badge-muted">{c.visibility}</span><span className="text-xs text-ink-soft">{c.questions} questions{c.categoryId ? ` · ${cats.find((x) => x.id === c.categoryId)?.name ?? ""}` : ""}</span>
              <span className="ml-auto flex gap-3 font-semibold">
                <button className="text-brand" onClick={() => setV({ id: c.id, name: c.name, categoryId: c.categoryId ?? "", visibility: c.visibility, institutionId: c.institutionId ?? "", description: c.description })}>Edit</button>
                <button className="text-red-700" onClick={() => remove(c)}>Delete</button>
              </span>
            </li>
          ))}
          {colls.length === 0 && <li className="p-3 text-ink-soft">No collections yet. Create the first one below.</li>}
        </ul>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>Name<input className="field font-normal" maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
          <label className={label}>Category<select className="field font-normal" value={v.categoryId} onChange={(e) => setV({ ...v, categoryId: e.target.value })}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className={label}>Who can see it<select className="field font-normal" value={v.visibility} onChange={(e) => setV({ ...v, visibility: e.target.value as Coll["visibility"] })}>{Object.entries(VIS).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
          {v.visibility === "institution" && <label className={label}>Institution<select className="field font-normal" value={v.institutionId} onChange={(e) => setV({ ...v, institutionId: e.target.value })}><option value="">Choose</option>{institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>}
        </div>
        {err && <p role="alert" className="text-red-700">{err}</p>}
        <div className="flex justify-end gap-2">{v.id && <button className="btn-outline" onClick={reset}>Cancel edit</button>}<button className="btn-solid" disabled={!v.name.trim() || (v.visibility === "institution" && !v.institutionId)} onClick={save}>{v.id ? "Save collection" : "Create collection"}</button></div>
      </div>
    </Modal>
  );
}

type Result = { dry: boolean; total: number; created: number; failed: { row: number | string; reason: string }[]; duplicates: number; duplicateRows: string[]; skipped: { name: string; type: string; reason: string }[] };

/** Impor soal dari CSV, Excel, Word, atau Moodle XML ke kategori dan koleksi yang dipilih. */
export function ImportDialog({ cats, colls, defaults, umum, onClose }: { cats: Cat[]; colls: Coll[]; defaults: { categoryId: string; collectionId: string }; umum?: boolean; onClose: () => void }) {
  const [extra, setExtra] = useState<Coll[]>([]); // bank yang baru dibuat di dialog ini
  const file = useRef<HTMLInputElement>(null);
  const [categoryId, setCategoryId] = useState(defaults.categoryId);
  const [collectionId, setCollectionId] = useState(defaults.collectionId);
  const [section, setSection] = useState("");
  const [status, setStatus] = useState("draft");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (dry: boolean) => {
    const f = file.current?.files?.[0];
    if (umum && !collectionId) return setErr("Choose the question bank first (or create a new one).");
    if (!f) return setErr("Choose a CSV, Excel, Word, or Moodle XML file first");
    setBusy(true); setErr(""); setRes(null);
    try {
      const fd = new FormData(); fd.append("file", f);
      if (categoryId) fd.append("categoryId", categoryId);
      if (collectionId) fd.append("collectionId", collectionId);
      if (!umum && section.trim()) fd.append("section", section.trim());
      fd.append("status", status);
      const r = await fetch(`/api/admin/questions/import${dry ? "?dry=1" : ""}`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? "Import failed");
      setRes(d);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [categoryId, collectionId, section, status, umum]);
  const shown = colls.filter((c) => !categoryId || !c.categoryId || c.categoryId === categoryId);
  return (
    <Modal title="Import questions" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">Accepted files: <b>Moodle XML</b> (multiple choice, true/false, short answer, matching, and essay; other types are skipped and listed), CSV, Excel, and Word. Maximum 500 questions (XML 10 MB). Questions that already exist are skipped, so importing the same file twice adds nothing. Download the <a className="font-semibold text-brand underline" href="/api/admin/questions/import">CSV template</a> or the <a className="font-semibold text-brand underline" href="/api/admin/questions/import?format=word">Word format</a>; the template includes matching, short answer, and essay rows.</p>
        {umum && (
          <div className="rounded-xl border border-line p-3">
            <p className="mb-2 font-semibold text-navy">Step 1. Where should the questions go?</p>
            <BankPicker cats={cats} colls={[...colls, ...extra]} value={{ categoryId, collectionId }} onChange={(v) => { setCategoryId(v.categoryId); setCollectionId(v.collectionId); }} allowNew onCreated={(c) => setExtra((x) => [...x, c])} />
          </div>
        )}
        {umum && <p className="font-semibold text-navy">Step 2. Choose the file</p>}
        <div className={umum ? "grid gap-3 sm:grid-cols-1" : "grid gap-3 sm:grid-cols-2"}>
          {!umum && <><label className={label}>Category<select className="field font-normal" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setCollectionId(""); }}><option value="">No category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className={label}>Collection<select className="field font-normal" value={collectionId} onChange={(e) => setCollectionId(e.target.value)}><option value="">No collection</option>{shown.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className={label}>Section name (optional)<input className="field font-normal" placeholder="e.g. umum" maxLength={32} value={section} onChange={(e) => setSection(e.target.value)} /><span className="text-xs font-normal text-ink-soft">Used when the file has no section column. Default: umum.</span></label></>}
          <label className={label}>Status<select className="field font-normal" value={status} onChange={(e) => setStatus(e.target.value)}><option value="draft">Draft</option><option value="review">Review</option><option value="published">Published</option></select></label>
        </div>
        <input ref={file} type="file" aria-label="Question file" accept=".csv,.xlsx,.docx,.xml" className="field" />
        {err && <p role="alert" className="text-red-700">{err}</p>}
        <div className="flex flex-wrap gap-2"><button className="btn-outline" disabled={busy || (umum && !collectionId)} onClick={() => run(true)}>Check first (without saving)</button><button className="btn-solid" disabled={busy || (umum && !collectionId)} onClick={() => run(false)}>Import</button></div>
        {res && (
          <div role="status" className="rounded-xl bg-canvas p-3">
            <p><b>{res.created}</b> of {res.total} {res.dry ? "valid (not saved yet)" : "imported"} · <b>{res.duplicates}</b> duplicate{res.duplicates === 1 ? "" : "s"} skipped · <b>{res.skipped.length}</b> unsupported · <b className={res.failed.length ? "text-red-700" : ""}>{res.failed.length}</b> failed</p>
            {res.skipped.length > 0 && <ul className="mt-2 list-disc pl-5 text-ink-soft">{res.skipped.slice(0, 30).map((s, i) => <li key={i}>{s.name} ({s.type}): {s.reason}</li>)}</ul>}
            {res.failed.length > 0 && <ul className="mt-2 list-disc pl-5 text-red-700">{res.failed.slice(0, 30).map((f, i) => <li key={i}>{typeof f.row === "number" ? `Row ${f.row}` : f.row}: {f.reason}</li>)}</ul>}
          </div>
        )}
      </div>
    </Modal>
  );
}
