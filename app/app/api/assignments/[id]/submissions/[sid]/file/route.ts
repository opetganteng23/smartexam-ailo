import { Readable } from "stream";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Submission } from "@/models/Assignment";
import { assignmentBucket } from "@/lib/assignment-store";

export const dynamic = "force-dynamic";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

/** Unduh berkas kiriman: hanya pemiliknya dan staf akademik. Selalu sebagai unduhan (attachment), tipe dari hasil pemeriksaan saat unggah. */
export async function GET(_req: Request, { params }: { params: { id: string; sid: string } }) {
  if (!isValidObjectId(params.id) || !isValidObjectId(params.sid)) return notFound();
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });
  await connectDB();
  const s = await Submission.findOne({ _id: params.sid, assignmentId: params.id }).lean();
  const staff = user.role === "admin" || user.role === "academic_admin";
  if (!s?.file?.gridFsId || (!staff && String(s.userId) !== String(user._id))) return notFound();
  const bucket = await assignmentBucket();
  if (!(await bucket.find({ _id: s.file.gridFsId }).limit(1).toArray()).length) return notFound();
  const name = (s.file.name ?? "submission").replace(/[^\w\-. ()]/g, "_");
  return new Response(Readable.toWeb(bucket.openDownloadStream(s.file.gridFsId)) as unknown as ReadableStream, {
    headers: {
      "Content-Type": s.file.mime ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store", "Content-Length": String(s.file.size ?? ""),
    },
  });
}
