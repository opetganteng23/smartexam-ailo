import { NextResponse } from "next/server";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { loadAttempt } from "@/lib/attempts";
import { proctorSummary } from "@/lib/proctor-summary";

export const dynamic = "force-dynamic";

/** Catatan aktivitas peserta sendiri setelah submit. Hanya hitungan dan durasi, tanpa skor, jadi aman walau hasil belum dirilis. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole(["participant", "admin"]);
    const { attempt } = await loadAttempt(params.id, user);
    if (attempt.status !== "submitted") throw new HttpError(409, "The test is not finished yet");
    return NextResponse.json(proctorSummary(attempt.proctorFlags ?? [], attempt.finishedAt));
  } catch (e) {
    return handleError(e);
  }
}
