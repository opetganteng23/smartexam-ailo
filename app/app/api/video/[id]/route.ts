import { Readable } from "stream";
import { isValidObjectId } from "mongoose";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Video } from "@/models/Video";
import { videoBucket, verifyVideoToken } from "@/lib/video-store";
import { canWatchVideo } from "@/lib/video-access";

export const dynamic = "force-dynamic";

const limiter = new RateLimiterMemory({ points: 600, duration: 60 }); // pemutar meminta banyak potongan (Range); batas longgar per pengguna
const cache = new Map<string, number>(); // keputusan akses selama 60 detik per (pengguna, klip, tautan)
const notFound = () => new Response("Not found", { status: 404, headers: { "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } });

/**
 * Alirkan klip MP4 dengan dukungan Range (loncat posisi). Otorisasi: lihat `canWatchVideo`. Tipe selalu video/mp4 dan nosniff;
 * berkas disajikan lewat aliran dari GridFS, tidak dimuat utuh ke memori. Yang tidak berhak dijawab 404 (bukan 403).
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isValidObjectId(params.id)) return notFound();
  const token = new URL(req.url).searchParams.get("t");
  const user = await getCurrentUser();
  // Tamu hanya dilayani dengan tautan sah (tanda tangan diperiksa dulu, murah), dan dibatasi per pemilik tautan, bukan per teks token.
  const sub = user ? null : await verifyVideoToken(token, params.id);
  if (!user && !sub) return notFound();
  const who = user ? String(user._id) : `t:${sub}`;
  try { await limiter.consume(who); } catch { return new Response("Too many requests", { status: 429, headers: { "Retry-After": "30" } }); }

  await connectDB();
  const v = await Video.findById(params.id).lean();
  if (!v || v.kind !== "upload" || !v.gridFsId || !v.size) return notFound();

  const ck = `${who}:${params.id}`;
  if (!(cache.get(ck) && cache.get(ck)! > Date.now())) {
    if (!(await canWatchVideo(user as never, params.id, token))) return notFound();
    cache.set(ck, Date.now() + 60_000);
    if (cache.size > 5000) for (const [k, t] of cache) if (t < Date.now()) cache.delete(k);
  }

  const size = v.size;
  let start = 0, end = size - 1, partial = false;
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) return new Response("Invalid range", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (m[1] === "") { const n = Number(m[2]); if (!(n > 0)) return new Response("Invalid range", { status: 416, headers: { "Content-Range": `bytes */${size}` } }); start = Math.max(0, size - n); }
    else { start = Number(m[1]); if (m[2] !== "") end = Math.min(Number(m[2]), size - 1); }
    if (!(start <= end) || start >= size) return new Response("Invalid range", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    partial = true;
  }

  const bucket = await videoBucket();
  if (!(await bucket.find({ _id: v.gridFsId }).limit(1).toArray()).length) return notFound(); // metadata ada tetapi berkas hilang
  const stream = bucket.openDownloadStream(v.gridFsId, { start, end: end + 1 });
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Content-Length": String(end - start + 1),
    "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300", "Content-Disposition": "inline", "Referrer-Policy": "no-referrer",
    ...(partial ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  };
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, { status: partial ? 206 : 200, headers });
}
