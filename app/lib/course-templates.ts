import { connectDB } from "./db";
import { HttpError } from "./rbac";
import { Course, CourseModule, Unit } from "@/models/Course";
import { checkCourseRefs } from "./course-admin";
import { scaffoldLevel } from "./course-scaffold";

// Templat course: kerangka modul dan unit yang bisa dipakai ulang. Course dibuat Preview only (tidak terlihat peserta) sampai admin
// merilisnya, dan unit kosong (materi dan kuis diisi tim konten). Paket TOEFL ITP adalah salah satu preset, bukan dasar sistem.
export type CourseTemplate = { key: string; name: string; description: string; track: "general" | "itp"; modules: { title: string; units: string[] }[] };

export const GENERAL_TEMPLATES: CourseTemplate[] = [
  {
    key: "general-basic", name: "Standard course", track: "general",
    description: "Introduction, core topics, and practice with evaluation. A good start for any subject.",
    modules: [
      { title: "Introduction", units: ["Course overview", "Learning goals"] },
      { title: "Core material", units: ["Topic 1", "Topic 2", "Topic 3"] },
      { title: "Practice and evaluation", units: ["Practice exercises", "Review"] },
    ],
  },
  {
    key: "general-weekly", name: "Weekly lectures (14 weeks)", track: "general",
    description: "One unit per week for a semester course, grouped as a first half, a midterm break, and a second half.",
    modules: [
      { title: "Weeks 1 to 7", units: Array.from({ length: 7 }, (_, i) => `Week ${i + 1}`) },
      { title: "Weeks 8 to 14", units: Array.from({ length: 7 }, (_, i) => `Week ${i + 8}`) },
    ],
  },
  {
    key: "general-practice", name: "Practice and daily quizzes", track: "general",
    description: "A short course for daily quizzes and pre/post tests: one module for the lessons, one for the practice.",
    modules: [{ title: "Lessons", units: ["Lesson 1", "Lesson 2"] }, { title: "Daily practice", units: ["Practice set"] }],
  },
];

/** Preset TOEFL ITP: enam course per bagian ujian untuk satu level (lihat lib/course-scaffold.ts). */
export const ITP_PRESET: CourseTemplate = {
  key: "toefl-itp", name: "TOEFL ITP (six exam parts)", track: "itp",
  description: "One course per exam part (Listening A, B, C, Structure, Written Expression, Reading) for a chosen level.",
  modules: [],
};

export const TEMPLATES: CourseTemplate[] = [...GENERAL_TEMPLATES, ITP_PRESET];

/** Buat course umum dari templat: course, modul, dan unit kosong. */
export async function createFromTemplate(key: string, b: { title: string; categoryId?: string | null; institutionIds?: string[]; classIds?: string[] }) {
  const t = GENERAL_TEMPLATES.find((x) => x.key === key);
  if (!t) throw new HttpError(404, "Template not found");
  await connectDB();
  await checkCourseRefs({ prerequisiteCourseIds: [], categoryId: b.categoryId ?? null, institutionIds: b.institutionIds ?? [], classIds: b.classIds ?? [] });
  const c = await Course.create({
    title: b.title, description: t.description, track: "general", active: true, previewMode: true, order: 0,
    ...(b.categoryId ? { categoryId: b.categoryId } : {}), institutionIds: b.institutionIds ?? [], classIds: b.classIds ?? [],
  });
  let units = 0;
  for (const [i, m] of t.modules.entries()) {
    const mod = await CourseModule.create({ courseId: c._id, title: m.title, order: i, active: true });
    for (const [k, name] of m.units.entries()) { await Unit.create({ courseId: c._id, moduleId: mod._id, title: name, order: units + k, active: true }); }
    units += m.units.length;
  }
  return { id: String(c._id), modules: t.modules.length, units };
}

export { scaffoldLevel };
