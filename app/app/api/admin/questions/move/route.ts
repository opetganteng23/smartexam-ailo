import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { Question, QuestionCollection } from "@/models/Question";
import { Category } from "@/models/Category";
import { audit } from "@/lib/audit";
import { zodMessage } from "@/lib/zod-message";
import { assertCollectionWritable, collectionVisible, collectionWritable } from "@/lib/collections";
import { isItpSection, sectionFromSubject } from "@/lib/question-bank";

const oid = z.string().regex(/^[0-9a-f]{24}$/);
const body = z.object({ ids: z.array(oid).min(1).max(500), collectionId: oid });

/**
 * Pindah massal soal ke sebuah bank (mis. soal lama "Belum dikelompokkan"). Hanya soal yang boleh diubah pengguna yang pindah:
 * soal di bank yang tidak terlihat atau tidak boleh ditulisnya, dan (untuk editor) soal yang sudah terbit, dilewati dan dilaporkan.
 * Mata pelajaran dan section ikut bank tujuan.
 */
export async function POST(req: Request) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    const { ids, collectionId } = body.parse(await req.json());
    await connectDB();
    const target = await QuestionCollection.findById(collectionId).lean();
    if (target && !(await QuestionCollection.exists({ _id: collectionId, ...collectionVisible(me) }))) throw new HttpError(404, "Collection not found");
    assertCollectionWritable(me, target);
    const cat = target.categoryId ? await Category.findById(target.categoryId).select("name").lean() : null;
    const section = sectionFromSubject(cat?.name);

    const qs = await Question.find({ _id: { $in: ids } }).select("section collectionId status").lean();
    const from = new Map((await QuestionCollection.find({ _id: { $in: qs.map((q) => q.collectionId).filter((x): x is NonNullable<typeof x> => !!x) } }).select("ownerId visibility institutionId").lean()).map((c) => [String(c._id), c]));
    const visible = new Set((await QuestionCollection.find({ _id: { $in: [...from.keys()] }, ...collectionVisible(me) }).select("_id").lean()).map((c) => String(c._id)));
    const movable = qs.filter((q) => {
      if (me.role === "content_editor" && !["draft", "review"].includes(q.status)) return false;
      if (!q.collectionId) return true; // soal tanpa bank bebas diubah seperti sebelumnya
      const c = from.get(String(q.collectionId));
      return !!c && visible.has(String(q.collectionId)) && collectionWritable(me, c);
    });
    if (movable.length) {
      await Question.bulkWrite(movable.map((q) => ({
        updateOne: { filter: { _id: q._id }, update: { $set: { collectionId: target._id, ...(target.categoryId ? { categoryId: target.categoryId } : {}), ...(isItpSection(q.section) ? {} : { section }) }, ...(target.categoryId ? {} : { $unset: { categoryId: 1 } }) } },
      })));
      await audit(me._id, "questions.move", String(target._id), { count: movable.length, requested: ids.length });
    }
    return NextResponse.json({ moved: movable.length, skipped: ids.length - movable.length });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
