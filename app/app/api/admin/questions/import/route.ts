import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { readTable } from "@/lib/import-parse";
import { docxTextToTable, readDocxText } from "@/lib/import-docx";
import { mapQuestionRows, QUESTION_TEMPLATE_AUDIO_EXAMPLE, QUESTION_TEMPLATE_EXAMPLE, QUESTION_TEMPLATE_EXTRA_EXAMPLES, QUESTION_TEMPLATE_HEADER, slugTag } from "@/lib/import-questions";
import { MOODLE_MAX_BYTES, MoodleError, parseMoodleXml } from "@/lib/import-moodle";
import { createQuestions, dropDuplicates, moodleToQuestions, storeImportImages, type ImportFailure, type ParsedQuestion } from "@/lib/import-save";
import { assertCollectionWritable } from "@/lib/collections";
import { SECTION_KEY_RE } from "@/lib/exam-format";
import { Category } from "@/models/Category";
import { QuestionCollection, QuestionGroup } from "@/models/Question";
import { Audio } from "@/models/Audio";

export const dynamic = "force-dynamic";

const DOCX_EXAMPLE = [
  "Section: structure", "Type: subject-verb", "Difficulty: medium", "Tags: structure:subject-verb agreement", "Status: draft", "",
  "1. The results of the study ___ clear.", "A. is", "B. are", "C. was", "D. be", "Answer: B", "Explanation: The plural subject takes are.", "",
  "2. She ___ to school every day.", "A. go", "B. goes", "C. going", "D. gone", "Answer: B", "",
].join("\r\n");

const oidRe = /^[0-9a-f]{24}$/;

/** Templat CSV impor soal (semua jenis soal) atau contoh format Word. */
export async function GET(req: Request) {
  try {
    await requireRole(CONTENT_ROLES);
    if (new URL(req.url).searchParams.get("format") === "word") return new Response(DOCX_EXAMPLE, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": 'attachment; filename="question-import-word-format.txt"' } });
    const csv = [QUESTION_TEMPLATE_HEADER, QUESTION_TEMPLATE_EXAMPLE, QUESTION_TEMPLATE_AUDIO_EXAMPLE, ...QUESTION_TEMPLATE_EXTRA_EXAMPLES].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="question-import-template.csv"' } });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Impor soal dari CSV, Excel, Word, atau Moodle XML. Baris sah dibuat; baris gagal, duplikat, dan jenis yang dilewati dilaporkan
 * dengan alasannya (tidak menggagalkan seluruh impor). `?dry=1` hanya memvalidasi (pratinjau). Isi form opsional:
 * `categoryId`, `collectionId`, `section` (nama bagian bila berkas tidak memuatnya), `status`.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(CONTENT_ROLES);
    const dry = new URL(req.url).searchParams.get("dry") === "1";
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "A file is required");
    await connectDB();

    const field = (k: string) => { const v = form.get(k); return typeof v === "string" ? v.trim() : ""; };
    let categoryId = field("categoryId") || null, collectionId = field("collectionId") || null;
    if (categoryId && !oidRe.test(categoryId)) throw new HttpError(400, "Invalid category");
    if (collectionId && !oidRe.test(collectionId)) throw new HttpError(400, "Invalid collection");
    const col = collectionId ? await QuestionCollection.findById(collectionId).lean() : null;
    if (collectionId) { assertCollectionWritable(admin, col); categoryId = categoryId ?? (col!.categoryId ? String(col!.categoryId) : null); }
    const cat = categoryId ? await Category.findById(categoryId).select("name").lean() : null;
    if (categoryId && !cat) throw new HttpError(400, "Category not found");
    const sectionRaw = field("section") ? slugTag(field("section")) : "";
    if (sectionRaw && !SECTION_KEY_RE.test(sectionRaw)) throw new HttpError(400, "Invalid section name (2 to 32 letters, digits, or underscores)");
    const status = (["draft", "review", "published"].includes(field("status")) ? field("status") : "draft") as "draft" | "review" | "published";
    const ctx = { categoryId, collectionId, section: sectionRaw || undefined };
    const name = file.name.toLowerCase();

    let ok: ParsedQuestion[] = [];
    const failed: ImportFailure[] = [];
    const skipped: { name: string; type: string; reason: string }[] = [];
    let total = 0;

    if (name.endsWith(".xml")) {
      if (file.size > MOODLE_MAX_BYTES) throw new HttpError(413, "Maximum 10 MB");
      let parsed;
      try { parsed = parseMoodleXml(Buffer.from(await file.arrayBuffer()).toString("utf8")); } catch (e) { throw new HttpError(400, e instanceof MoodleError ? e.message : "The file could not be read"); }
      total = parsed.total;
      skipped.push(...parsed.skipped.map((s) => ({ name: s.name, type: s.type, reason: s.reason })));
      const files = parsed.items.flatMap((i) => i.files);
      const stored = dry ? { urls: new Map(files.map((f) => [f.name, "/api/assets/" + "0".repeat(24)])), rejected: [] as string[] } : await storeImportImages(files, admin._id);
      stored.rejected.forEach((r) => failed.push({ row: "image", reason: r }));
      const m = moodleToQuestions(parsed.items, stored.urls, { section: sectionRaw || "umum", categoryId, collectionId, status, defaultSkill: slugTag(cat?.name ?? "") || "umum" });
      ok = m.ok; failed.push(...m.failed);
    } else {
      let table: string[][];
      if (name.endsWith(".docx")) {
        if (file.size > 4 * 1024 * 1024) throw new HttpError(413, "Maximum 4 MB");
        let text: string;
        try { text = await readDocxText(Buffer.from(await file.arrayBuffer())); } catch { throw new HttpError(400, "The file is not a valid Word (.docx) file"); }
        table = docxTextToTable(text);
        if (table.length < 2) throw new HttpError(400, "No questions found. Number each question (1. ...) and list options as A. B. C. D.");
        if (table.length > 501) throw new HttpError(413, "Maximum 500 questions per import");
      } else table = await readTable(file, 500);
      const rows = mapQuestionRows(table, ctx);
      if (rows.length === 1 && !rows[0].ok && rows[0].row === 1) throw new HttpError(400, rows[0].error);
      total = rows.length;
      failed.push(...rows.filter((r): r is Extract<typeof r, { ok: false }> => !r.ok).map((r) => ({ row: r.row, reason: r.error })));
      let good = rows.filter((r): r is Extract<typeof r, { ok: true }> => r.ok);

      // Kolom "audio" (opsional, listening saja): judul harus persis sama dengan audio yang sudah ada di Audio Library.
      // Baris dengan judul audio yang sama digabung jadi satu grup (dipakai ulang bila sudah ada grup untuk audio itu).
      const titles = [...new Set(good.map((g) => g.audioTitle).filter((t): t is string => !!t))];
      if (titles.length) {
        const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const audios = await Audio.find({ title: { $in: titles.map((t) => new RegExp(`^${esc(t)}$`, "i")) } }).select("title").lean();
        const byTitle = new Map(audios.map((a) => [(a.title ?? "").trim().toLowerCase(), a._id]));
        const resolvedGroupId = new Map<string, string>(); // judul audio (huruf kecil) -> groupId
        for (const g of good) {
          if (!g.audioTitle) continue;
          const key = g.audioTitle.trim().toLowerCase();
          const audioId = byTitle.get(key);
          if (!audioId) { failed.push({ row: g.row, reason: `Audio not found: "${g.audioTitle}". Upload it in Audio Library first, or leave the audio column empty.` }); continue; }
          if (!resolvedGroupId.has(key)) {
            if (dry) resolvedGroupId.set(key, "dry-run");
            else {
              const existing = await QuestionGroup.findOne({ audioId }).select("_id").lean();
              const grp = existing ?? (await QuestionGroup.create({ section: "listening", audioId, instruction: g.groupInstruction }));
              resolvedGroupId.set(key, String(grp._id));
            }
          }
          if (!dry) (g.data as { groupId?: string }).groupId = resolvedGroupId.get(key);
        }
        good = good.filter((g) => !g.audioTitle || resolvedGroupId.has(g.audioTitle.trim().toLowerCase()));
      }
      ok = good.map((g) => ({ label: `row ${g.row}`, data: g.data }));
    }

    const { fresh, dups } = await dropDuplicates(ok);
    if (!dry) {
      await createQuestions(fresh, admin.role === "content_editor");
      await audit(admin._id, "questions.import", file.name, { created: fresh.length, failed: failed.length, duplicates: dups.length, skipped: skipped.length, collectionId });
    }
    return NextResponse.json({ dry, total, created: fresh.length, failed: failed.slice(0, 200), duplicates: dups.length, duplicateRows: dups.slice(0, 50).map((d) => String(d.row)), skipped: skipped.slice(0, 200) });
  } catch (e) {
    return handleError(e);
  }
}
