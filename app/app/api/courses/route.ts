import { LIVE, PREVIEW_VISIBLE, isPreviewer, courseLocks, unitDrip } from "@/lib/course-access";
import { getLevels } from "@/lib/config";
import { cycleState, placementNeeded } from "@/lib/cycles";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError } from "@/lib/rbac";
import { Course, CourseModule, CourseProgress, Unit, UnitProgress } from "@/models/Course";
import { Attempt, Test } from "@/models/Test";
import { generalTestStates } from "@/lib/course-tests";
import { visibleTestFilter } from "@/lib/test-access";
import { participantCourseFilter, trackOf } from "@/lib/course-scope";
import { featuresFor } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * Course peserta beserta unit dan progresnya: course umum milik institusi dan kelasnya, ditambah course ITP di levelnya.
 * Course institusi, kelas, atau level lain tidak terlihat. `needsPlacement` hanya untuk jalur ITP dan hanya bila peserta
 * tidak punya course umum.
 */
export async function GET() {
  try {
    const me = await requireRole(["participant", "admin"]);
    await connectDB();
    const preview = isPreviewer(me); // admin dan QA tester: semua level, termasuk course mode preview, tanpa prasyarat dan drip
    if (!preview && !(await featuresFor(me)).learning) return NextResponse.json({ needsPlacement: false, courses: [] }); // modul Learning mati (global atau institusi ini)
    const itpBlocked = !preview && (!me.currentLevelId || placementNeeded(me, await cycleState(me.institutionId)));
    const levels = preview ? await getLevels() : [];
    const lvl = new Map(levels.map((l) => [String(l._id), l]));
    const found = await Course.find(preview ? { ...PREVIEW_VISIBLE } : { ...LIVE, ...(await participantCourseFilter(me, { itp: !itpBlocked })) }).sort({ order: 1, createdAt: 1 }).lean();
    if (!preview && itpBlocked && found.length === 0) return NextResponse.json({ needsPlacement: true, courses: [] });
    const courses = preview ? found.sort((a, b) => (lvl.get(String(a.levelId))?.order ?? 99) - (lvl.get(String(b.levelId))?.order ?? 99)) : found;
    const units = await Unit.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).sort({ order: 1, createdAt: 1 }).lean();
    const [mods, locks] = await Promise.all([
      CourseModule.find({ courseId: { $in: courses.map((c) => c._id) }, active: true }).sort({ order: 1, createdAt: 1 }).lean(),
      preview ? new Map<string, { locked: boolean; missing: string[] }>() : courseLocks(me._id, courses),
    ]);
    // Ujian per bagian: nama, skor terbaik, dan apakah sudah bisa dimulai.
    const tIds = courses.map((c) => c.sectionTestId).filter((x): x is NonNullable<typeof x> => !!x);
    const [secTests, cprog, running] = await Promise.all([
      tIds.length ? Test.find({ _id: { $in: tIds }, kind: "section", ...visibleTestFilter(me) }).select("name sections").lean() : [],
      tIds.length ? CourseProgress.find({ userId: me._id, courseId: { $in: courses.map((c) => c._id) } }).lean() : [],
      tIds.length ? Attempt.find({ userId: me._id, testId: { $in: tIds }, status: "in_progress" }).select("testId").lean() : [],
    ]);
    // Awal belajar per course dalam satu query (bukan satu per course).
    // Tes umum yang berdiri sendiri di course (kuis harian, pre/post-test, UTS): satu query untuk semua course.
    const cTests = await Test.find({ kind: "general", courseId: { $in: courses.map((c) => c._id) }, ...visibleTestFilter(me) }).sort({ createdAt: 1 }).lean();
    const tState = await generalTestStates(me, cTests);
    const started = new Map<string, Date>();
    for (const p of await UnitProgress.find({ userId: me._id, courseId: { $in: courses.map((c) => c._id) } }).select("courseId createdAt").sort({ createdAt: 1 }).lean()) {
      const k = String(p.courseId);
      if (!started.has(k)) started.set(k, (p as { createdAt?: Date }).createdAt as Date);
    }
    const prog = new Map((await UnitProgress.find({ userId: me._id, unitId: { $in: units.map((u) => u._id) } }).lean()).map((p) => [String(p.unitId), p]));
    return NextResponse.json({
      needsPlacement: false, preview,
      courses: courses.map((c) => {
        const us = units.filter((u) => String(u.courseId) === String(c._id)).map((u) => {
          const p = prog.get(String(u._id));
          const total = u.materialIds.length + (u.quizTestId ? 1 : 0);
          const done = (p ? p.materialsDone.filter((m) => u.materialIds.some((x) => String(x) === String(m))).length : 0) + (p?.quizPassed ? 1 : 0);
          const drip = preview ? { locked: false, opensAt: null } : unitDrip(u.unlockAfterDays ?? 0, started.get(String(u.courseId)) ?? null);
          const moduleId = u.moduleId && mods.some((m) => String(m._id) === String(u.moduleId)) ? String(u.moduleId) : null;
          return { id: String(u._id), title: u.title, description: u.description ?? "", moduleId, status: p?.status === "completed" ? "completed" : done > 0 ? "in_progress" : "not_started", done, total, locked: drip.locked, opensAt: drip.opensAt };
        });
        const lock = locks.get(String(c._id));
        const st = c.sectionTestId ? secTests.find((t) => String(t._id) === String(c.sectionTestId)) : null;
        const cp = cprog.find((p) => String(p.courseId) === String(c._id));
        const run = st ? running.find((r) => String(r.testId) === String(st._id)) : null;
        const allDone = us.length > 0 && us.every((u) => u.status === "completed");
        const sectionTest = st ? { name: st.name, questions: st.sections.reduce((n, s) => n + s.questionIds.length, 0), best: cp?.sectionTestBest ?? null, passed: !!cp?.sectionTestPassed, attempts: cp?.sectionTestAttempts ?? 0, required: !!c.requireSectionTest, state: lock?.locked ? "locked" : run ? "in_progress" : allDone || preview ? "available" : "locked", inProgressAttemptId: run ? String(run._id) : null } : null;
        return {
          id: String(c._id), title: c.title, description: c.description ?? "", level: preview ? lvl.get(String(c.levelId))?.name ?? null : null, part: c.part ?? null, track: trackOf(c), categoryId: c.categoryId ? String(c.categoryId) : null, sectionTest, previewOnly: !!c.previewMode, inactive: !c.active, cover: c.coverAssetId ? `/api/assets/${c.coverAssetId}` : null,
          locked: !!lock?.locked, missing: lock?.missing ?? [],
          modules: mods.filter((m) => String(m.courseId) === String(c._id)).map((m) => ({ id: String(m._id), title: m.title, description: m.description ?? "" })),
          units: us, completed: us.filter((u) => u.status === "completed").length,
          tests: cTests.filter((t) => String(t.courseId) === String(c._id)).map((t) => tState.get(String(t._id))).filter((x): x is NonNullable<typeof x> => !!x).map((t) => ({ ...t, unlocked: t.unlocked && !lock?.locked, reason: lock?.locked ? `Finish ${lock.missing.join(", ")} first to open this course.` : t.reason })),
        };
      }).filter((c) => c.units.length > 0 || c.tests.length > 0), // course tanpa unit dan tanpa tes tidak ditampilkan ke peserta
    });
  } catch (e) {
    return handleError(e);
  }
}
