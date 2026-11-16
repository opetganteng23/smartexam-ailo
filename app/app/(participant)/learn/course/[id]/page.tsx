"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";
import type { CourseItem } from "@/components/CourseCard";
import { useT } from "@/components/LangProvider";

// Video pengantar hanya dari embed YouTube (nocookie) atau Vimeo; server sudah menormalkannya, ini lapis kedua di klien.
const PREVIEW_RE = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/[\w-]{11}|player\.vimeo\.com\/video\/\d{5,12})$/;

/** Halaman rincian course: tentang course, apa yang dipelajari, prasyarat pengetahuan, untuk siapa, video pengantar, dan kurikulum. */
export default function CourseDetail() {
  const tr = useT();
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<{ courses: CourseItem[] }>("/api/courses");
  if (loading && !data) return <Loading />;
  const c = data?.courses.find((x) => x.id === id);
  return (
    <div className="flex flex-col gap-5">
      <Link href="/learn" className="text-sm font-semibold text-brand">{tr("Back to courses")}</Link>
      <ErrorNote text={error} />
      {data && !c && <Empty>{tr("This course was not found, or it is not available to you.")}</Empty>}
      {c && (
        <>
          <header className="flex flex-col gap-2">
            {c.category && <p className="text-xs font-semibold tracking-wider text-brand">{c.category.toUpperCase()}</p>}
            <h1 className="page-title">{c.title}</h1>
            {c.description && <p className="max-w-3xl text-ink-soft">{c.description}</p>}
            {(c.tags?.length ?? 0) > 0 && <p className="flex flex-wrap gap-1.5 text-xs">{c.tags!.map((t) => <span key={t} className="badge-muted">{t}</span>)}</p>}
          </header>
          {c.previewVideo && PREVIEW_RE.test(c.previewVideo) && <iframe src={c.previewVideo} title={`${c.title} preview`} className="aspect-video w-full max-w-3xl rounded-2xl" sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; picture-in-picture" allowFullScreen />}
          <div className="grid gap-4 md:grid-cols-2">
            {(c.whatYouLearn?.length ?? 0) > 0 && <section className="card" aria-label="What you will learn"><h2 className="mb-2 font-display text-lg font-extrabold text-navy">{tr("What you will learn")}</h2><ul className="list-disc space-y-1 pl-5 text-sm">{c.whatYouLearn!.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
            {(c.requirements?.length ?? 0) > 0 && <section className="card" aria-label="Requirements"><h2 className="mb-2 font-display text-lg font-extrabold text-navy">{tr("Before you start")}</h2><ul className="list-disc space-y-1 pl-5 text-sm">{c.requirements!.map((x, i) => <li key={i}>{x}</li>)}</ul></section>}
            {c.targetAudience && <section className="card md:col-span-2" aria-label="Who this is for"><h2 className="mb-2 font-display text-lg font-extrabold text-navy">{tr("Who this is for")}</h2><p className="text-sm">{c.targetAudience}</p></section>}
          </div>
          <section aria-label="Curriculum">
            <h2 className="mb-2 font-display text-xl font-extrabold text-navy">{tr("Curriculum")}</h2>
            {c.locked && <p className="mb-2 rounded-lg bg-canvas p-3 text-sm text-ink-soft">{tr("This course is locked. Finish {names} first.", { names: c.missing.join(", ") })}</p>}
            {[{ id: null as string | null, title: "", description: "" }, ...c.modules].map((m) => {
              const us = c.units.filter((u) => (u.moduleId ?? null) === m.id);
              if (!us.length) return null;
              return (
                <div key={m.id ?? "none"} className="mb-3">
                  {m.id && <h3 className="font-display text-base font-extrabold text-navy">{m.title}</h3>}
                  <ol className="mt-1 divide-y divide-line rounded-xl border border-line bg-white">
                    {us.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                        {c.locked || u.locked ? <span className="text-ink-soft">{u.title}</span> : <Link href={`/learn/${u.id}`} className="font-semibold text-navy hover:text-brand">{u.title}</Link>}
                        <span className={u.status === "completed" ? "badge-ok" : u.status === "in_progress" ? "badge-warn" : "badge-muted"}>{c.locked || u.locked ? tr("Locked") : u.status === "completed" ? tr("Completed") : u.status === "in_progress" ? tr("In progress") : tr("Not started")}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
            {c.units.length === 0 && <p className="text-sm text-ink-soft">{tr("No units in this course yet.")}</p>}
            {(c.tests?.length ?? 0) > 0 && <p className="mt-2 text-sm text-ink-soft">This course also has {c.tests!.length} test{c.tests!.length === 1 ? "" : "s"}. Open the course from <Link href="/learn" className="font-semibold text-brand">Learn</Link> to take them.</p>}
          </section>
        </>
      )}
    </div>
  );
}
