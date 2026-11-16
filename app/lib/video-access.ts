import type { Types } from "mongoose";
import { isPreviewer, previewOnlyMaterialIds } from "./course-access";
import { restrictedMaterialIds } from "./course-scope";
import { visibleTo } from "./material-authz";
import { verifyVideoToken } from "./video-store";
import { Material } from "@/models/Material";
import { Question, QuestionGroup } from "@/models/Question";
import { Attempt, Test } from "@/models/Test";

type U = { _id: Types.ObjectId; role: string; institutionId?: Types.ObjectId | null; qaTester?: boolean | null };

/**
 * Siapa boleh menonton klip unggahan: staf konten dan admin selalu; peserta hanya bila klip itu dipakai (1) materi terbit yang boleh
 * mereka buka (institusi, course umum, dan preview mengikuti aturan materi), atau (2) grup soal pada tes yang sedang mereka kerjakan.
 * `token`: tautan bertanda tangan untuk materi HTML (iframe tersandbox tanpa cookie), terikat ke satu klip dan satu pengguna.
 */
export async function canWatchVideo(user: U | null, videoId: string, token?: string | null): Promise<boolean> {
  // Tautan bertanda tangan: pemiliknya sudah lolos pemeriksaan akses saat tautan dibuat. Pengguna yang masuk hanya boleh memakai tautan miliknya sendiri.
  const sub = token ? await verifyVideoToken(token, videoId) : null;
  if (sub && (!user || String(user._id) === sub)) return true;
  if (!user) return false;
  if (["admin", "academic_admin", "content_editor"].includes(user.role)) return true;
  if (user.role !== "participant" && user.role !== "inst_admin" && user.role !== "coach") return false;

  const hidden = isPreviewer(user) ? [] : [...(await previewOnlyMaterialIds()), ...(await restrictedMaterialIds(user))];
  const inMaterial = await Material.exists({
    status: "published", ...visibleTo(user), ...(hidden.length ? { _id: { $nin: hidden } } : {}),
    $or: [{ contentHtml: { $regex: videoId } }, { "htmlDoc.html": { $regex: videoId } }],
  });
  if (inMaterial) return true;

  // Grup soal berbasis video: hanya selama peserta mengerjakan tes yang memuat soal grup itu.
  const gids = await QuestionGroup.find({ videoId }).distinct("_id");
  if (!gids.length) return false;
  const qids = new Set((await Question.find({ groupId: { $in: gids } }).select("_id").lean()).map((q) => String(q._id)));
  const running = await Attempt.find({ userId: user._id, status: "in_progress" }).select("testId sections").lean();
  if (!running.length) return false;
  const tests = await Test.find({ _id: { $in: running.map((a) => a.testId) } }).select("sections").lean();
  return running.some((a) => {
    const secs = a.sections?.length ? a.sections : tests.find((t) => String(t._id) === String(a.testId))?.sections ?? [];
    return secs.some((s) => s.questionIds.some((id) => qids.has(String(id))));
  });
}
