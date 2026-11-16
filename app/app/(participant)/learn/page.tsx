"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { useApi } from "@/lib/useApi";
import { Loading, ErrorNote, Empty } from "@/components/Charts";
import { PART_LABEL } from "@/lib/exam-format";
import { CourseCard, type CourseItem } from "@/components/CourseCard";

const PURPOSE_LABEL: Record<string, string> = { daily: "Daily quiz", pretest: "Pre-test", posttest: "Post-test", midterm: "Midterm", final: "Final exam" };
type Course = CourseItem;
const day = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const ST = { not_started: ["Not started", "badge-muted"], in_progress: ["In progress", "badge-warn"], completed: ["Completed", "badge-ok"] } as const;

export default function Belajar() {
  const { data, loading, error } = useApi<{ needsPlacement: boolean; preview?: boolean; courses: Course[] }>("/api/courses");
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startErr, setStartErr] = useState("");
  async function startSectionTest(courseId: string) {
    setBusy(true); setStartErr("");
    try { const d = await api<{ attemptId: string }>(`/api/courses/${courseId}/section-test`, { json: {} }); router.push(`/test-room/${d.attemptId}`); }
    catch (e) { setStartErr((e as Error).message); setBusy(false); }
  }
  if (loading) return <Loading />;

  const courses = data?.courses ?? [];
  // Default: course yang sedang berjalan, lalu yang belum selesai, lalu yang pertama.
  const current = courses.find((c) => c.id === picked)
    ?? courses.find((c) => c.units.some((u) => u.status === "in_progress"))
    ?? courses.find((c) => c.completed < c.units.length)
    ?? courses[0];

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="page-title">Learn</h1><p className="mt-1 text-sm text-ink-soft sm:text-base">Pick a course. Finish the required materials and pass the quiz to complete a unit.</p></div>
      <ErrorNote text={error} />
      {data?.preview && <p role="note" className="rounded-xl border border-accent bg-accent-tint p-3 text-sm text-navy"><b>Preview mode.</b> You see courses of every level, including courses marked Preview only, with no prerequisites or unlock days. Participants only see their own level, and never see Preview only courses. Your progress here does not appear in participant reports (admin) or counts as a test account (QA).</p>}
      {data?.needsPlacement && <Empty>Take the placement test first to unlock courses for your level. <Link href="/tests" className="font-semibold text-brand">Go to My Tests</Link></Empty>}
      {data && !data.needsPlacement && courses.length === 0 && <Empty>No courses are available to you yet. Your institution or class may not have been given a course, or it is still being prepared. Ask your coordinator if you expected to see one here.</Empty>}

      {courses.length > 0 && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Courses">
            {courses.map((c) => <CourseCard key={c.id} c={c} on={current?.id === c.id} preview={!!data?.preview} onPick={() => setPicked(c.id)} />)}
          </ul>

          {current && (
            <section aria-label={`Units in ${current.title}`}>
              <h2 className="font-display text-xl font-extrabold text-navy">{current.title}</h2>
              {current.locked && <p className="mt-2 rounded-lg bg-canvas p-3 text-sm text-ink-soft">This course is locked. Finish {current.missing.join(", ")} first.</p>}
              {[{ id: null as string | null, title: "", description: "" }, ...current.modules].map((m) => {
                const us = current.units.filter((u) => (u.moduleId ?? null) === m.id);
                if (!us.length) return null;
                return (
                  <div key={m.id ?? "none"} className="mt-3">
                    {m.id && <div className="mb-2"><h3 className="font-display text-base font-extrabold text-navy">{m.title}</h3>{m.description && <p className="text-sm text-ink-soft">{m.description}</p>}</div>}
                    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {us.map((u) => {
                        const idx = current.units.indexOf(u) + 1;
                        const off = current.locked || u.locked;
                        const body = (
                          <>
                            <span className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-ink-soft">UNIT {idx}</span>{off ? <span className="badge-muted">Locked</span> : <span className={ST[u.status][1]}>{ST[u.status][0]}</span>}</span>
                            <b className="text-navy">{u.title}</b>
                            {u.description && <span className="line-clamp-2 text-sm text-ink-soft">{u.description}</span>}
                            <span className="mt-auto pt-1 text-xs text-ink-soft">{off ? (current.locked ? "Opens after the prerequisite course" : u.opensAt ? `Opens ${day(u.opensAt)}` : "Opens after you start the course") : `${u.done}/${u.total} parts`}</span>
                          </>
                        );
                        return (
                          <li key={u.id}>
                            {off
                              ? <div aria-disabled="true" className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-canvas p-4 opacity-80">{body}</div>
                              : <Link href={`/learn/${u.id}`} className="flex h-full flex-col gap-1.5 rounded-xl border border-line bg-white p-4 hover:border-brand">{body}</Link>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
              {current.units.length === 0 && (current.tests?.length ?? 0) === 0 && <p className="mt-3 text-sm text-ink-soft">No units in this course yet.</p>}
              {(current.tests?.length ?? 0) > 0 && (
                <div className="mt-4 flex flex-col gap-3" aria-label="Tests">
                  {current.tests!.map((t) => (
                    <div key={t.id} className="card">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wider text-brand">{(t.purpose ? PURPOSE_LABEL[t.purpose] ?? "Test" : "Test").toUpperCase()}</p>
                          <h3 className="font-display text-lg font-extrabold text-navy">{t.name}</h3>
                          <p className="text-sm text-ink-soft">{t.totalQuestions} questions · {Math.round(t.totalSec / 60)} min{t.daily ? ` · open every day ${t.daily.start} to ${t.daily.end} WIB` : ""}{t.schedule ? ` · ${t.schedule.text}` : ""}{t.maxAttempts > 0 ? ` · ${t.attemptsUsed} of ${t.maxAttempts} attempts used` : ""}{t.best != null ? ` · Best: ${t.best}%` : ""}</p>
                        </div>
                      </div>
                      {t.unlocked || t.inProgressAttemptId
                        ? <button className="btn-solid mt-3" onClick={() => router.push(t.inProgressAttemptId ? `/test-room/${t.inProgressAttemptId}` : `/tests/prepare/${t.id}`)}>{t.inProgressAttemptId ? "Continue" : t.attemptsUsed > 0 ? "Take again" : "Start"}</button>
                        : <p className="mt-3 text-sm text-ink-soft">{t.reason ?? "Not available right now."}</p>}
                    </div>
                  ))}
                </div>
              )}
              {current.sectionTest && (
                <div className="card mt-4" aria-label="Section test">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wider text-brand">SECTION TEST{current.part ? ` · ${PART_LABEL[current.part] ?? ""}` : ""}</p>
                      <h3 className="font-display text-lg font-extrabold text-navy">{current.sectionTest.name}</h3>
                      <p className="text-sm text-ink-soft">{current.sectionTest.questions} questions · taken at the end of this course.{current.sectionTest.best != null ? ` Best: ${current.sectionTest.best}%.` : ""}{current.sectionTest.required ? " Passing it is needed to open the courses that follow." : ""}</p>
                    </div>
                    {current.sectionTest.passed && <span className="badge-ok">Passed</span>}
                  </div>
                  {current.sectionTest.state === "locked"
                    ? <p className="mt-3 text-sm text-ink-soft">Finish every unit of this course to open the section test.</p>
                    : <button className="btn-solid mt-3" disabled={busy} onClick={() => startSectionTest(current.id)}>{current.sectionTest.state === "in_progress" ? "Continue section test" : current.sectionTest.attempts > 0 ? "Retake section test" : "Start section test"}</button>}
                  <ErrorNote text={startErr} />
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
