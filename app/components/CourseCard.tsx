"use client";

import Link from "next/link";
import { PART_LABEL } from "@/lib/exam-format";
import { useT } from "@/components/LangProvider";

export type CourseUnit = { id: string; title: string; description: string; moduleId: string | null; status: "not_started" | "in_progress" | "completed"; done: number; total: number; locked: boolean; opensAt: string | null };
export type CourseTest = { id: string; name: string; purpose: string | null; totalQuestions: number; totalSec: number; unlocked: boolean; reason: string | null; attemptsUsed: number; maxAttempts: number; best: number | null; inProgressAttemptId: string | null; daily: { start: string; end: string; maxPerDay: number } | null; schedule: { text: string } | null };
export type CourseItem = {
  id: string; title: string; description: string; cover: string | null; locked: boolean; missing: string[];
  part?: string | null; level?: string | null; previewOnly?: boolean; inactive?: boolean; track?: string; category?: string | null;
  whatYouLearn?: string[]; requirements?: string[]; targetAudience?: string; tags?: string[]; previewVideo?: string | null;
  modules: { id: string; title: string; description: string }[]; units: CourseUnit[]; completed: number; tests?: CourseTest[];
  sectionTest?: { name: string; questions: number; best: number | null; passed: boolean; attempts: number; required: boolean; state: "locked" | "available" | "in_progress"; inProgressAttemptId: string | null } | null;
};

/** Kartu course di /learn: sampul, kategori, status, deskripsi, label, dan kemajuan. Kartu memilih course; "Details" membuka halaman rinciannya. */
export function CourseCard({ c, on, preview, onPick }: { c: CourseItem; on: boolean; preview: boolean; onPick: () => void }) {
  const tr = useT();
  const pct = c.units.length ? Math.round((c.completed / c.units.length) * 100) : 0;
  return (
    <li className="flex flex-col">
      <button type="button" onClick={onPick} aria-pressed={on}
        className={`flex h-full w-full flex-col gap-2 rounded-2xl border-[1.5px] bg-white p-4 text-left transition sm:p-5 ${on ? "border-brand shadow-[0_0_0_3px_rgba(11,79,166,0.12)]" : "border-line hover:border-line-strong"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.cover && <img src={c.cover} alt="" className="-mx-1 -mt-1 mb-1 h-28 w-[calc(100%+0.5rem)] rounded-xl object-cover sm:h-32" />}
        {(c.category || c.part) && <span className="text-xs font-semibold text-brand">{c.category ?? (c.part ? PART_LABEL[c.part] ?? c.part : "")}</span>}
        <span className="flex items-center justify-between gap-2">
          {c.locked ? <span className="badge-muted">{tr("Locked")}</span> : <span className={pct === 100 ? "badge-ok" : pct > 0 ? "badge-warn" : "badge-muted"}>{pct === 100 ? tr("Completed") : pct > 0 ? tr("In progress") : tr("Not started")}</span>}
          <span className="text-xs text-ink-soft">{c.units.length} {c.units.length === 1 ? tr("unit") : tr("units")}{(c.tests?.length ?? 0) > 0 ? ` · ${c.tests!.length} ${c.tests!.length === 1 ? tr("test") : tr("tests")}` : ""}</span>
        </span>
        {preview && <span className="flex flex-wrap gap-1.5 text-xs">{c.level && <span className="badge-muted">{c.level}</span>}{c.previewOnly && <span className="badge-warn">{tr("Preview only")}</span>}{c.inactive && <span className="badge-muted">{tr("Inactive")}</span>}</span>}
        <span className="font-display text-lg font-extrabold leading-snug text-navy">{c.title}</span>
        {c.locked ? <span className="text-sm text-ink-soft">{tr("Finish {names} to open this course.", { names: c.missing.join(", ") })}</span> : c.description && <span className="line-clamp-2 text-sm text-ink-soft">{c.description}</span>}
        {(c.tags?.length ?? 0) > 0 && <span className="flex flex-wrap gap-1.5 text-xs">{c.tags!.slice(0, 4).map((t) => <span key={t} className="badge-muted">{t}</span>)}</span>}
        <span className="mt-auto flex items-center gap-3 pt-1">
          <span className="h-2 flex-1 rounded-full bg-canvas" role="progressbar" aria-valuenow={c.completed} aria-valuemax={c.units.length} aria-label={`${c.title} progress`}><span className="block h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} /></span>
          <span className="text-xs font-semibold text-ink-soft">{c.completed}/{c.units.length}</span>
        </span>
      </button>
      <Link href={`/learn/course/${c.id}`} aria-label={`${tr("Details")}: ${c.title}`} className="mt-1 inline-flex min-h-[44px] items-center self-start px-1 text-sm font-semibold text-brand">{tr("Details")}</Link>
    </li>
  );
}
