import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, ACADEMIC_ROLES } from "@/lib/rbac";
import { Attempt, Test } from "@/models/Test";

export const dynamic = "force-dynamic";

/** Percobaan yang menunggu nilai essay. Penilai tidak melihat identitas peserta (penilaian buta): hanya kode percobaan. */
export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const list = await Attempt.find({ status: "submitted", gradingStatus: "pending" }).sort({ finishedAt: 1 }).limit(200).select("testId finishedAt essayPending").lean();
    const tests = await Test.find({ _id: { $in: list.map((a) => a.testId) } }).select("name").lean();
    const name = new Map(tests.map((t) => [String(t._id), t.name]));
    return NextResponse.json({
      items: list.map((a) => ({ id: String(a._id), code: `#${String(a._id).slice(-6).toUpperCase()}`, test: name.get(String(a.testId)) ?? "-", finishedAt: a.finishedAt, essayPending: a.essayPending ?? 0 })),
    });
  } catch (e) {
    return handleError(e);
  }
}
