import { registerQuestionType } from "@/lib/question-types";
import { recordQuestionVersion, ensureBaseline } from "@/lib/question-versions";
import { NextResponse } from "next/server";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES, ACADEMIC_ROLES } from "@/lib/rbac";
import { Question } from "@/models/Question";
import { Test, Attempt } from "@/models/Test";
import { AuditLog } from "@/models/AuditLog";
import { questionSchema } from "@/lib/admin-schemas";
import { assertQuestionWritable, checkQuestionRefs, collectionVisible } from "@/lib/collections";
import { QuestionCollection } from "@/models/Question";

async function find(id: string, user: Parameters<typeof collectionVisible>[0]) {
  if (!isValidObjectId(id)) throw new HttpError(404, "Question not found");
  await connectDB();
  const q = await Question.findById(id);
  if (!q) throw new HttpError(404, "Question not found");
  // Soal di koleksi yang tidak terlihat pengguna ini dijawab seolah tidak ada.
  if (q.collectionId && !(await QuestionCollection.exists({ _id: q.collectionId, ...collectionVisible(user) }))) throw new HttpError(404, "Question not found");
  return q;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    const q = await find(params.id, me);
    return NextResponse.json(q.toObject());
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(CONTENT_ROLES);
    const q = await find(params.id, admin);
    const body = questionSchema.parse(await req.json());
    await assertQuestionWritable(admin, q);
    const movedFrom = body.collectionId !== undefined && String(q.collectionId ?? "") !== String(body.collectionId ?? "") ? String(q.collectionId ?? "") : null;
    await checkQuestionRefs(admin, { categoryId: body.categoryId, collectionId: movedFrom !== null ? body.collectionId : undefined });
    if (admin.role === "content_editor") {
      if (!["draft", "review"].includes(q.status)) throw new HttpError(403, "This question is already published or archived. Ask an academic admin to change it.");
      if (!["draft", "review"].includes(body.status)) throw new HttpError(403, "Editors can save drafts and send questions for review. An academic admin publishes them.");
    }
    // Ubah kunci/pilihan pada soal yang sudah dipakai tes mengubah skor lama; dicatat di audit.
    const used = await Test.exists({ "sections.questionIds": q._id });
    await ensureBaseline(q._id, q.toObject());
    q.set({ ...body, groupId: body.groupId ?? undefined, ...(body.categoryId !== undefined ? { categoryId: body.categoryId ?? undefined } : {}), ...(body.collectionId !== undefined ? { collectionId: body.collectionId ?? undefined } : {}) });
    await q.save();
    await registerQuestionType(q.section, q.type);
    const ver = await recordQuestionVersion(q._id, q.toObject(), admin._id);
    await AuditLog.create({ actorId: admin._id, action: "question.update", target: String(q._id), meta: { usedInTest: !!used, version: ver?.version, changed: ver?.changed, ...(movedFrom !== null ? { collectionFrom: movedFrom, collectionTo: String(body.collectionId ?? "") } : {}) } });
    return NextResponse.json({ ok: true, usedInTest: !!used });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const q = await find(params.id, admin);
    if (await Test.exists({ "sections.questionIds": q._id })) throw new HttpError(409, "The question is used by a test. Remove it from the test first or change its status to draft.");
    if (await Attempt.exists({ "sections.questionIds": q._id })) throw new HttpError(409, "This question was drawn into a participant's test attempt and cannot be deleted. Change its status to archived instead.");
    await q.deleteOne();
    await AuditLog.create({ actorId: admin._id, action: "question.delete", target: params.id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
