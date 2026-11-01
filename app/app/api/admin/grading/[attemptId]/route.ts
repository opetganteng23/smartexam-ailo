import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { zodMessage } from "@/lib/zod-message";
import { essaysForGrading, saveEssayGrade } from "@/lib/essay-grading";
import { AuditLog } from "@/models/AuditLog";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { attemptId: string } }) {
  try {
    await requireRole(ACADEMIC_ROLES);
    return NextResponse.json({ ...(await essaysForGrading(params.attemptId)), code: `#${params.attemptId.slice(-6).toUpperCase()}` });
  } catch (e) {
    return handleError(e);
  }
}

const gradeInput = z.object({ qid: z.string().regex(/^[0-9a-f]{24}$/), points: z.number().min(0).max(100), feedback: z.string().max(2000).optional() });

/** Simpan nilai satu essay. Bila itu essay terakhir, skor dihitung ulang dan hasil dirilis. */
export async function PUT(req: Request, { params }: { params: { attemptId: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const b = gradeInput.parse(await req.json());
    const r = await saveEssayGrade({ attemptId: params.attemptId, qid: b.qid, points: b.points, feedback: b.feedback, graderId: admin._id });
    await AuditLog.create({ actorId: admin._id, action: "essay.grade", target: params.attemptId, meta: { qid: b.qid, points: b.points, released: r.done } });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
