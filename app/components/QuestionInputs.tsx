"use client";

import { useT } from "./LangProvider";

// Input jawaban untuk jenis soal selain pilihan ganda. Dipakai di ruang tes dan pratinjau tes.
const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Mencocokkan: tiap item kiri dipasangkan dengan satu item kanan lewat daftar pilihan. Nilai = indeks kanan yang dipilih (-1 = belum). */
export function MatchingInput({ lefts, rights, value, onChange }: { lefts: string[]; rights: string[]; value: number[] | undefined; onChange: (v: number[]) => void }) {
  const t = useT();
  const cur = lefts.map((_, i) => value?.[i] ?? -1);
  return (
    <div className="mt-5 flex flex-col gap-3" role="group" aria-label={t("Match each item")}>
      {lefts.map((l, i) => (
        <label key={i} className="flex flex-col gap-1.5 rounded-xl border-[1.5px] border-line-strong p-3 sm:flex-row sm:items-center sm:gap-4">
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold">{i + 1}</span>
            <span className="min-w-0 font-medium">{l}</span>
          </span>
          <select className="field !h-11 sm:!w-64" value={cur[i]} aria-label={`Match for item ${i + 1}`}
            onChange={(e) => { const n = [...cur]; n[i] = Number(e.target.value); onChange(n); }}>
            <option value={-1}>{t("Choose a match…")}</option>
            {rights.map((r, j) => <option key={j} value={j} disabled={cur.includes(j) && cur[i] !== j}>{r}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

export function ShortInput({ value, onChange }: { value: string | undefined; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <div className="mt-5">
      <input className="field" value={value ?? ""} maxLength={200} onChange={(e) => onChange(e.target.value)} placeholder={t("Type your answer")} aria-label={t("Your answer")} autoComplete="off" spellCheck={false} />
    </div>
  );
}

export function EssayInput({ value, onChange, maxWords }: { value: string | undefined; onChange: (v: string) => void; maxWords?: number | null }) {
  const t = useT();
  const n = wordCount(value ?? ""), over = maxWords != null && n > maxWords;
  return (
    <div className="mt-5">
      <textarea className="field min-h-[220px] resize-y leading-relaxed" value={value ?? ""} maxLength={20000} onChange={(e) => onChange(e.target.value)} placeholder={t("Write your answer here")} aria-label={t("Your essay answer")} />
      <p className={`mt-1.5 text-xs ${over ? "font-semibold text-red-700" : "text-ink-soft"}`}>{n} {n === 1 ? t("word") : t("words")}{maxWords != null ? ` · ${t("limit")} ${maxWords}` : ""}{over ? ` · ${t("over the limit")}` : ""}</p>
    </div>
  );
}
