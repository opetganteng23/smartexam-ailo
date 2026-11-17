"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { useT } from "@/components/LangProvider";
import type { Cat, Coll } from "@/components/QuestionCollections";

const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

export type BankChoice = { categoryId: string; collectionId: string };

/**
 * Dua dropdown bertingkat yang dipakai di mana pun soal dipilih atau dituju: Mata pelajaran, lalu Bank soal di dalamnya.
 * Memilih mata pelajaran langsung memilih bank pertamanya. `allowNew` menambahkan "bank baru" di tempat (nama saja; mata pelajaran dipakai dari pilihan).
 */
export function BankPicker({ cats, colls, value, onChange, allowNew, onCreated, disabled, compact }: {
  cats: Cat[]; colls: Coll[]; value: BankChoice; onChange: (v: BankChoice) => void;
  allowNew?: boolean; onCreated?: (c: Coll) => void; disabled?: boolean; compact?: boolean;
}) {
  const tr = useT();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const banks = colls.filter((c) => c.categoryId === value.categoryId);
  const pickSubject = (categoryId: string) => onChange({ categoryId, collectionId: colls.find((c) => c.categoryId === categoryId)?.id ?? "" });

  async function create() {
    setErr("");
    if (!name.trim()) return setErr(tr("Enter a name for the question bank."));
    if (!value.categoryId) return setErr(tr("Choose a subject first."));
    setBusy(true);
    try {
      const d = await api<{ id: string }>("/api/admin/collections", { method: "POST", json: { name: name.trim(), categoryId: value.categoryId, visibility: "private" } });
      const c: Coll = { id: d.id, name: name.trim(), categoryId: value.categoryId, description: "", visibility: "private", institutionId: null, mine: true, questions: 0 };
      onCreated?.(c); onChange({ categoryId: value.categoryId, collectionId: c.id }); setAdding(false); setName("");
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  const field = compact ? "field !h-10 w-auto min-w-[12rem] font-normal" : "field font-normal";
  return (
    <div className={compact ? "flex flex-wrap items-end gap-3" : "grid gap-3 sm:grid-cols-2"}>
      <label className={label}>{tr("Subject")}
        <select className={field} disabled={disabled} value={value.categoryId} onChange={(e) => pickSubject(e.target.value)}>
          <option value="">{tr("Choose a subject")}</option>
          {cats.filter((c) => c.active || c.id === value.categoryId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className={label}>{tr("Question bank")}
        <select className={field} disabled={disabled || !value.categoryId} value={value.collectionId} onChange={(e) => onChange({ ...value, collectionId: e.target.value })}>
          <option value="">{value.categoryId ? (banks.length ? tr("Choose a question bank") : tr("No question bank in this subject yet")) : tr("Choose a subject first")}</option>
          {banks.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.questions})</option>)}
        </select>
      </label>
      {allowNew && (
        <div className={compact ? "flex flex-col gap-1" : "sm:col-span-2"}>
          {!adding ? (
            <button type="button" className="self-start text-sm font-semibold text-brand disabled:opacity-40" disabled={disabled || !value.categoryId} onClick={() => setAdding(true)}>{tr("+ New question bank")}</button>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className={label}>{tr("Name of the new question bank")}<input className="field !h-10 w-64 font-normal" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} /></label>
              <button type="button" className="btn-solid !min-h-[40px]" disabled={busy} onClick={create}>{tr("Create")}</button>
              <button type="button" className="btn-outline !min-h-[40px]" onClick={() => { setAdding(false); setErr(""); }}>{tr("Cancel")}</button>
            </div>
          )}
          {err && <p role="alert" className="text-xs text-red-700">{err}</p>}
        </div>
      )}
    </div>
  );
}
