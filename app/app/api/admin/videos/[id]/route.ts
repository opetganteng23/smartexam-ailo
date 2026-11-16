import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidObjectId } from "mongoose";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Video } from "@/models/Video";
import { Material } from "@/models/Material";
import { QuestionGroup } from "@/models/Question";
import { videoBucket } from "@/lib/video-store";

const input = z.object({ title: z.string().trim().min(1).max(120) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Video not found");
    const b = input.parse(await req.json());
    await connectDB();
    const r = await Video.updateOne({ _id: params.id }, { title: b.title });
    if (!r.matchedCount) throw new HttpError(404, "Video not found");
    await audit(admin._id, "video.rename", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

/** Video yang masih dipakai materi atau grup soal tidak bisa dihapus. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    if (!isValidObjectId(params.id)) throw new HttpError(404, "Video not found");
    await connectDB();
    const v = await Video.findById(params.id);
    if (!v) throw new HttpError(404, "Video not found");
    const used = (await QuestionGroup.exists({ videoId: v._id })) || (await Material.exists({ $or: [{ contentHtml: { $regex: params.id } }, { "htmlDoc.html": { $regex: params.id } }] }));
    if (used) throw new HttpError(409, "This video is still used by a material or a question group. Remove it there first.");
    if (v.gridFsId) await (await videoBucket()).delete(v.gridFsId).catch(() => {});
    await v.deleteOne();
    await audit(admin._id, "video.delete", params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
