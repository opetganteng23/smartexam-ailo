"use client";

import type { QuestionKind, MatchingKey, ShortKey, EssayKey } from "@/lib/question-kinds";

/** Kunci jawaban awal tiap jenis (pilihan ganda tidak memakai `key`). */
export const defaultKey = (kind: QuestionKind): unknown =>
  kind === "matching" ? { pairs: [{ left: "", right: "" }, { left: "", right: "" }], partial: true } as MatchingKey
  : kind === "short" ? { accepted: [""], caseSensitive: false } as ShortKey
  : kind === "essay" ? { rubric: [{ criterion: "", points: 1 }] } as EssayKey
  : undefined;

const btn = "self-start text-sm font-semibold text-brand";

/** Editor kunci untuk soal mencocokkan, isian singkat, dan essay (rubrik). */
export function QuestionKeyEditor({ kind, value, points, onChange }: { kind: QuestionKind; value: unknown; points: number; onChange: (k: unknown) => void }) {
  if (kind === "matching") {
    const k = (value as MatchingKey) ?? (defaultKey("matching") as MatchingKey);
    const set = (pairs: MatchingKey["pairs"]) => onChange({ ...k, pairs });
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-navy">Pairs (left item and its correct match)</legend>
        {k.pairs.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 text-sm font-semibold">{i + 1}</span>
            <input className="field" aria-label={`Left item ${i + 1}`} placeholder="Left item" value={p.left} onChange={(e) => set(k.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
            <span aria-hidden>↔</span>
            <input className="field" aria-label={`Right item ${i + 1}`} placeholder="Its match" value={p.right} onChange={(e) => set(k.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
            {k.pairs.length > 2 && <button type="button" aria-label="Remove pair" className="text-red-700" onClick={() => set(k.pairs.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        {k.pairs.length < 12 && <button type="button" className={btn} onClick={() => set([...k.pairs, { left: "", right: "" }])}>+ Add pair</button>}
        <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={k.partial !== false} onChange={(e) => onChange({ ...k, partial: e.target.checked })} />Give partial credit for each correct pair</label>
        <p className="text-xs text-ink-soft">Participants see the right-hand items in a random order.</p>
      </fieldset>
    );
  }
  if (kind === "short") {
    const k = (value as ShortKey) ?? (defaultKey("short") as ShortKey);
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-navy">Accepted answers (one per line)</legend>
        <textarea className="field h-24 py-2 font-normal" aria-label="Accepted answers" value={k.accepted.join("\n")} onChange={(e) => onChange({ ...k, accepted: e.target.value.split("\n") })} />
        <label className="flex min-h-[40px] items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={!!k.caseSensitive} onChange={(e) => onChange({ ...k, caseSensitive: e.target.checked })} />Capital letters must match</label>
        <p className="text-xs text-ink-soft">Extra spaces are ignored. An answer is correct when it equals any line above.</p>
      </fieldset>
    );
  }
  if (kind === "essay") {
    const k = (value as EssayKey) ?? (defaultKey("essay") as EssayKey);
    const sum = Math.round(k.rubric.reduce((n, c) => n + (Number(c.points) || 0), 0) * 100) / 100;
    const set = (rubric: EssayKey["rubric"]) => onChange({ ...k, rubric });
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-navy">Grading rubric</legend>
        {k.rubric.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="field" aria-label={`Criterion ${i + 1}`} placeholder="Criterion, e.g. Content and ideas" value={c.criterion} onChange={(e) => set(k.rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} />
            <input className="field !w-24" type="number" min={0} step="0.5" aria-label={`Points for criterion ${i + 1}`} value={c.points} onChange={(e) => set(k.rubric.map((x, j) => (j === i ? { ...x, points: Number(e.target.value) } : x)))} />
            {k.rubric.length > 1 && <button type="button" aria-label="Remove criterion" className="text-red-700" onClick={() => set(k.rubric.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        {k.rubric.length < 10 && <button type="button" className={btn} onClick={() => set([...k.rubric, { criterion: "", points: 1 }])}>+ Add criterion</button>}
        <p className={`text-xs ${Math.abs(sum - points) > 0.01 ? "font-semibold text-red-700" : "text-ink-soft"}`}>Rubric total {sum} · question points {points}{Math.abs(sum - points) > 0.01 ? ". They must be equal." : ""}</p>
        <label className="flex flex-col gap-1 text-sm font-semibold text-navy">Guide for graders (optional)<textarea className="field h-20 py-2 font-normal" value={k.guide ?? ""} onChange={(e) => onChange({ ...k, guide: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-navy">Word limit (optional)<input className="field !w-32 font-normal" type="number" min={1} value={k.maxWords ?? ""} onChange={(e) => onChange({ ...k, maxWords: e.target.value ? Number(e.target.value) : undefined })} /></label>
      </fieldset>
    );
  }
  return null;
}
