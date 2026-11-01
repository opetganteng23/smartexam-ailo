import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { essaysForGrading } from "@/lib/essay-grading";
import { draftEssayGrade } from "@/lib/essay-ai";
import { aiEnabled } from "@/lib/ai";
import { Attempt } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Minta AI menyiapkan draf nilai untuk satu essay. Hanya usulan: disimpan di jawaban, tidak mengubah nilai. */
export async function POST(req: Request, { params }: { params: { attemptId: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    const { qid } = z.object({ qid: z.string().regex(/^[0-9a-f]{24}$/) }).parse(await req.json());
    if (!aiEnabled()) throw new HttpError(503, "AI is not configured on this server. Grade this answer manually.");
    const { items } = await essaysForGrading(params.attemptId);
    const it = items.find((x) => x.qid === qid);
    if (!it) throw new HttpError(404, "Essay answer not found");
    let draft;
    try { draft = await draftEssayGrade({ stem: it.stem, rubric: it.rubric, guide: it.guide ?? undefined, answer: it.answer }); }
    catch (e) { throw new HttpError(502, (e as Error).message || "The AI could not draft a grade. Grade this answer manually."); }
    await connectDB();
    await Attempt.updateOne({ _id: params.attemptId, "answers.qid": qid }, { $set: { "answers.$.aiDraft": { points: draft.points, rationale: draft.rationale, at: new Date() } } });
    return NextResponse.json({ draft });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
