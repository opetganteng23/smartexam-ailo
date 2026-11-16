import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { once } from "events";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import { zodMessage } from "@/lib/zod-message";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, ACADEMIC_ROLES } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { Video } from "@/models/Video";
import { isMp4, parseEmbed, videoBucket, videoLimit, embedSrc } from "@/lib/video-store";

export const dynamic = "force-dynamic";

const uploads = new RateLimiterMemory({ points: 10, duration: 3600 }); // 10 unggahan per jam per akun
const titleSchema = z.string().trim().min(1).max(120);
const embedInput = z.object({ title: titleSchema, url: z.string().trim().min(8).max(300) });

export async function GET() {
  try {
    await requireRole(ACADEMIC_ROLES);
    await connectDB();
    const list = await Video.find().sort({ createdAt: -1 }).limit(500).lean();
    return NextResponse.json({ videos: list.map((v) => ({ id: String(v._id), title: v.title, kind: v.kind, provider: v.provider ?? null, size: v.size ?? null, createdAt: v.createdAt, src: v.kind === "upload" ? `/api/video/${v._id}` : embedSrc(v) })) });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Tambah video. `application/json` {title, url}: embed YouTube atau Vimeo. `video/mp4` (badan mentah, `?title=`): klip MP4
 * maksimal 100 MB yang dialirkan langsung ke GridFS (tidak dimuat utuh ke memori); jenis dicek dari byte awal.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireRole(ACADEMIC_ROLES);
    const ct = (req.headers.get("content-type") ?? "").toLowerCase();
    await connectDB();

    if (ct.startsWith("application/json")) {
      const b = embedInput.parse(await req.json());
      const e = parseEmbed(b.url);
      if (!e) throw new HttpError(400, "Use a YouTube or Vimeo link");
      const v = await Video.create({ title: b.title, kind: "embed", provider: e.provider, externalId: e.externalId, ownerId: admin._id });
      await audit(admin._id, "video.embed", String(v._id), { provider: e.provider });
      return NextResponse.json({ id: String(v._id) }, { status: 201 });
    }

    if (!ct.startsWith("video/mp4")) throw new HttpError(415, "Upload an MP4 video (video/mp4), or send a YouTube or Vimeo link");
    const title = titleSchema.parse(new URL(req.url).searchParams.get("title") ?? "");
    const limit = videoLimit();
    const declared = Number(req.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) throw new HttpError(413, `The video is larger than ${Math.round(limit / 1048576)} MB`);
    if (!req.body) throw new HttpError(400, "The video file is empty");
    try { await uploads.consume(String(admin._id)); } catch (e) { if (e instanceof RateLimiterRes) throw new HttpError(429, "Too many uploads. Try again in an hour."); throw e; }

    const bucket = await videoBucket();
    const up = bucket.openUploadStream(title.slice(0, 120), { metadata: { ownerId: String(admin._id) } });
    const hash = createHash("sha256");
    let total = 0, head = Buffer.alloc(0);
    let upErr: Error | null = null;
    up.on("error", (e: Error) => { upErr = e; }); // galat tulis GridFS tidak boleh menjadi uncaught exception
    const reader = req.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (upErr) throw upErr;
        total += value.length;
        if (total > limit) throw new HttpError(413, `The video is larger than ${Math.round(limit / 1048576)} MB`);
        if (head.length < 12) { head = Buffer.concat([head, Buffer.from(value.subarray(0, 12 - head.length))]); if (head.length >= 12 && !isMp4(head)) throw new HttpError(415, "This is not an MP4 video file"); }
        hash.update(value);
        if (!up.write(value)) await once(up, "drain");
      }
      if (!head.length) throw new HttpError(400, "The video file is empty");
      if (!isMp4(head)) throw new HttpError(415, "This is not an MP4 video file");
      await new Promise<void>((res, rej) => up.end((err?: Error) => (err ?? upErr ? rej(err ?? upErr) : res())));
    } catch (e) {
      await up.abort().catch(() => {}); // buang potongan yang sudah tertulis
      throw e;
    }
    let v;
    try {
      v = await Video.create({ title, kind: "upload", gridFsId: up.id, size: total, sha256: hash.digest("hex"), ownerId: admin._id });
      await audit(admin._id, "video.upload", String(v._id), { size: total });
    } catch (e) {
      await bucket.delete(up.id).catch(() => {}); // jangan tinggalkan berkas yatim bila metadata gagal tersimpan
      if (v) await Video.deleteOne({ _id: v._id }).catch(() => {});
      throw e;
    }
    return NextResponse.json({ id: String(v._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}
