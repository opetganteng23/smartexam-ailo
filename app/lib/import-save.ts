import { createHash } from "crypto";
import { questionSchema } from "./admin-schemas";
import { questionHash } from "./question-hash";
import { needsHtml, htmlToText } from "./question-html";
import { FILE_REF, type MoodleItem } from "./import-moodle";
import { Question } from "@/models/Question";
import { Asset } from "@/models/Asset";
import { slugTag } from "./import-questions";
import { questionVisibleFilter } from "./collections";

export const IMAGE_MAX_BYTES = 1.5 * 1024 * 1024;

/** Tipe gambar dari byte awal (bukan dari nama berkas atau klaim pengirim). */
export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && (b.subarray(0, 6).toString("latin1") === "GIF87a" || b.subarray(0, 6).toString("latin1") === "GIF89a")) return "image/gif";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Simpan gambar dari berkas impor sebagai Asset (dipakai ulang bila sidik sama). Mengembalikan peta nama berkas ke URL, dan pesan untuk berkas ditolak. */
export async function storeImportImages(files: { name: string; base64: string }[], ownerId?: import("mongoose").Types.ObjectId, dry = false) {
  const urls = new Map<string, string>(), rejected: string[] = [];
  for (const f of files) {
    if (urls.has(f.name)) continue;
    const buf = Buffer.from(f.base64, "base64");
    const mime = sniffImage(buf);
    if (!mime) { rejected.push(`${f.name}: not a JPEG, PNG, GIF, or WebP image`); continue; }
    if (buf.length > IMAGE_MAX_BYTES) { rejected.push(`${f.name}: larger than 1.5 MB`); continue; }
    if (dry) { urls.set(f.name, "/api/assets/" + "0".repeat(24)); continue; } // pratinjau: hanya memeriksa, tidak menyimpan
    const sha = createHash("sha256").update(buf).digest("hex");
    const a = (await Asset.findOne({ sha256: sha }).select("_id").lean()) ?? (await Asset.create({ ownerId, mime, size: buf.length, dataBase64: buf.toString("base64"), sha256: sha, name: f.name.slice(0, 120) }));
    urls.set(f.name, `/api/assets/${a._id}`);
  }
  return { urls, rejected };
}

export type ImportContext = { section: string; categoryId?: string | null; collectionId?: string | null; status: "draft" | "review" | "published"; defaultSkill: string };
export type ParsedQuestion = { label: string; data: ReturnType<typeof questionSchema.parse> };
export type ImportFailure = { row: number | string; reason: string };

/** Item Moodle ke soal tervalidasi. Gambar sudah disimpan; rujukan @@PLUGINFILE@@ diganti URL aset. Baris tidak sah masuk `failed`. */
export function moodleToQuestions(items: MoodleItem[], urls: Map<string, string>, ctx: ImportContext) {
  const ok: ParsedQuestion[] = [], failed: ImportFailure[] = [];
  for (const it of items) {
    let stem = it.stem;
    if (it.stemIsHtml) {
      const missing: string[] = [];
      stem = stem.replace(new RegExp(`${FILE_REF.replace(/[@/]/g, "\$&")}([^"'\s>]+)`, "g"), (_m, n: string) => { const u = urls.get(decodeURIComponent(n)); if (!u) missing.push(n); return u ?? ""; });
      if (missing.length) { failed.push({ row: it.name, reason: `Image not usable: ${missing.join(", ")}` }); continue; }
    }
    const html = it.stemIsHtml && needsHtml(stem);
    const tags = it.tags.length ? it.tags.map((t) => (t.includes(":") ? { skill: slugTag(t.split(":")[0]), topic: t.split(":").slice(1).join(":").trim() } : { skill: ctx.defaultSkill, topic: t })) : [{ skill: ctx.defaultSkill, topic: "umum" }];
    const parsed = questionSchema.safeParse({
      section: ctx.section, type: it.kind === "mcq" ? "pilihan ganda" : it.kind, stem: html ? stem : it.stemIsHtml ? htmlToText(stem) : stem, stemFormat: html ? "html" : "text",
      kind: it.kind, points: it.points, options: it.options, answerKey: it.answerKey, key: it.key, explanation: it.explanation,
      tags: tags.slice(0, 10), status: ctx.status, categoryId: ctx.categoryId ?? null, collectionId: ctx.collectionId ?? null, source: "Moodle XML",
    });
    if (parsed.success) ok.push({ label: it.name, data: parsed.data });
    else failed.push({ row: it.name, reason: parsed.error.issues[0]?.message ?? "Invalid question" });
  }
  return { ok, failed };
}

/** Buang soal yang isinya sudah ada (di berkas ini atau di bank). Soal lama tanpa sidik dicocokkan lewat teks soal yang sama. */
export async function dropDuplicates(qs: ParsedQuestion[], user: Parameters<typeof questionVisibleFilter>[0]) {
  const hashes = qs.map((q) => questionHash(q.data));
  const seen = new Set<string>(await existingHashes(qs, hashes, await questionVisibleFilter(user)));
  const fresh: ParsedQuestion[] = [], dups: ImportFailure[] = [];
  qs.forEach((q, i) => { if (seen.has(hashes[i])) dups.push({ row: q.label, reason: "Duplicate: the same question already exists" }); else { seen.add(hashes[i]); fresh.push(q); } });
  return { fresh, dups };
}

async function existingHashes(qs: ParsedQuestion[], hashes: string[], vis: Record<string, unknown>) {
  const scoped = (f: Record<string, unknown>) => (Object.keys(vis).length ? { $and: [f, vis] } : f);
  const have = new Set((await Question.find(scoped({ contentHash: { $in: hashes } })).select("contentHash").lean()).map((q) => q.contentHash as string));
  const legacy = await Question.find(scoped({ contentHash: { $exists: false }, stem: { $in: qs.map((q) => q.data.stem) } })).select("kind stem options answerKey key").lean();
  for (const q of legacy) have.add(questionHash(q));
  return have;
}

export async function createQuestions(qs: ParsedQuestion[], forceDraft: boolean) {
  const { registerQuestionType } = await import("./question-types");
  const { recordQuestionVersion } = await import("./question-versions");
  const ids: string[] = [];
  for (const g of qs) {
    const nq = await Question.create({ ...g.data, categoryId: g.data.categoryId ?? undefined, collectionId: g.data.collectionId ?? undefined, ...(forceDraft && !["draft", "review"].includes(g.data.status) ? { status: "draft" } : {}) });
    await registerQuestionType(g.data.section, g.data.type);
    await recordQuestionVersion(nq._id, nq.toObject(), undefined, "Imported from file");
    ids.push(String(nq._id));
  }
  return ids;
}
