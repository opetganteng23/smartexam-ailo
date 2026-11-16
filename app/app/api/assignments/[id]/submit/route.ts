import { NextResponse } from "next/server";
import { isValidObjectId, type Types } from "mongoose";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Assignment, Submission } from "@/models/Assignment";
import { MAX_ASSIGNMENT_BYTES, assignmentBucket, courseForAssignments, safeFileName, sniffAssignmentFile } from "@/lib/assignment-store";
import { cleanComment, unitForDiscussion } from "@/lib/comments";

export const dynamic = "force-dynamic";

const limiter = new RateLimiterMemory({ points: 20, duration: 3600 }); // 20 kiriman per jam per akun

/**
 * Kumpulkan tugas (multipart: `text` dan/atau `file`). Berkas: PDF, PNG, JPEG, atau ZIP/Office, maksimal 10 MB, jenis dari byte awal.
 * Tenggat dan batas kiriman dicek di server; kiriman terlambat ditandai bila tugas mengizinkannya.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const me = await requireRole(["participant"]);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Assignment not found");
    await connectDB();
    const a = await Assignment.findOne({ _id: params.id, active: true }).lean();
    if (!a) throw new HttpError(404, "Assignment not found");
    await courseForAssignments(me, String(a.courseId));
    if (a.unitId) await unitForDiscussion(me, String(a.unitId)); // prasyarat course dan drip unit berlaku juga untuk tugasnya
    if (a.kind !== "file") throw new HttpError(409, "This assignment is completed in its test, not by submitting a file");
    const declared = Number(req.headers.get("content-length"));
    // Panjang badan wajib diketahui: membatasi memori yang dipakai formData() (permintaan chunked tanpa Content-Length ditolak).
    if (!Number.isFinite(declared) || declared <= 0) throw new HttpError(411, "The request must declare its size");
    if (declared > MAX_ASSIGNMENT_BYTES + 200_000) throw new HttpError(413, "The file is larger than 10 MB");
    try { await limiter.consume(String(me._id)); } catch { throw new HttpError(429, "Too many submissions. Try again later."); }

    const now = new Date();
    const late = !!a.dueAt && a.dueAt < now;
    if (late && !a.allowLate) throw new HttpError(403, "The deadline has passed.");
    const used = await Submission.countDocuments({ assignmentId: a._id, userId: me._id });
    if (a.maxSubmissions > 0 && used >= a.maxSubmissions) throw new HttpError(403, "You have used all your submissions for this assignment.");

    const form = await req.formData().catch(() => { throw new HttpError(400, "Send the form as multipart"); });
    const text = cleanComment(form.get("text") ?? "");
    if (text.length > 5000) throw new HttpError(400, "The text is longer than 5000 characters");
    const f = form.get("file");
    const file = f instanceof File && f.size > 0 ? f : null;
    if (!text && !file) throw new HttpError(400, "Add a file or write an answer");

    let stored: { gridFsId: Types.ObjectId; name: string; size: number; mime: string } | undefined;
    const bucket = await assignmentBucket();
    if (file) {
      if (file.size > MAX_ASSIGNMENT_BYTES) throw new HttpError(413, "The file is larger than 10 MB");
      const buf = Buffer.from(await file.arrayBuffer());
      const kind = sniffAssignmentFile(buf);
      if (!kind) throw new HttpError(415, "Upload a PDF, PNG, JPEG, or ZIP/Office file (Word, Excel, PowerPoint)");
      const name = safeFileName(file.name, kind.ext);
      const up = bucket.openUploadStream(name, { metadata: { userId: String(me._id), assignmentId: String(a._id) } });
      await new Promise<void>((res, rej) => { up.on("error", rej); up.end(buf, () => res()); });
      stored = { gridFsId: up.id as Types.ObjectId, name, size: buf.length, mime: kind.mime };
    }
    try {
      const s = await Submission.create({ assignmentId: a._id, courseId: a.courseId, userId: me._id, institutionId: me.institutionId ?? undefined, attemptNo: used + 1, text: text || undefined, file: stored, late });
      await audit(me._id, "assignment.submit", String(s._id), { assignmentId: String(a._id), late });
      return NextResponse.json({ id: String(s._id), attemptNo: s.attemptNo, late }, { status: 201 });
    } catch (e) {
      if (stored) await bucket.delete(stored.gridFsId).catch(() => {}); // jangan tinggalkan berkas yatim
      if ((e as { code?: number }).code === 11000) throw new HttpError(409, "Your submission was already received. Refresh the page.");
      throw e;
    }
  } catch (e) {
    return handleError(e);
  }
}
