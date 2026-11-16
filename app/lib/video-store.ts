import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { connectDB } from "./db";

/** Batas unggahan klip: 100 MB. `VIDEO_MAX_BYTES` hanya untuk menurunkannya (mis. di tes), tidak pernah menaikkan. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const videoLimit = () => { const v = Number(process.env.VIDEO_MAX_BYTES); return Number.isFinite(v) && v > 0 ? Math.min(v, MAX_VIDEO_BYTES) : MAX_VIDEO_BYTES; };

export async function videoBucket() {
  await connectDB();
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db!, { bucketName: "video" });
}

const BRANDS = new Set(["isom", "iso2", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "dash", "MSNV", "f4v "]);
/** MP4 sah menurut byte awal: kotak "ftyp" di offset 4 dengan merek yang dikenal. Nama berkas dan tipe yang diklaim pengirim tidak dipercaya. */
export function isMp4(head: Buffer) {
  return head.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp" && BRANDS.has(head.subarray(8, 12).toString("latin1"));
}

/** URL YouTube atau Vimeo ke penyedia dan id (pola ketat; selain itu ditolak). */
export function parseEmbed(raw: string): { provider: "youtube" | "vimeo"; externalId: string } | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const yt = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? { provider: "youtube" as const, externalId: id } : null);
  if (host === "youtu.be") return yt(u.pathname.slice(1).split("/")[0]);
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") return yt(u.searchParams.get("v"));
    const m = /^\/(embed|shorts|live)\/([^/]+)/.exec(u.pathname);
    return m ? yt(m[2]) : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = /^\/(?:video\/)?(\d{5,12})(?:\/|$)/.exec(u.pathname);
    return m ? { provider: "vimeo", externalId: m[1] } : null;
  }
  return null;
}

export const embedSrc = (v: { provider?: string | null; externalId?: string | null }) =>
  v.provider === "vimeo" ? `https://player.vimeo.com/video/${v.externalId}` : `https://www.youtube-nocookie.com/embed/${v.externalId}`;

// ---- Tautan bertanda tangan untuk materi HTML (iframe tersandbox tanpa cookie) ----
const key = () => new TextEncoder().encode(process.env.JWT_SECRET);
export async function signVideoToken(videoId: string, userId: string) {
  return new SignJWT({ vid: videoId, p: "video" }).setSubject(userId).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h").sign(key());
}
export async function verifyVideoToken(token: string | null | undefined, videoId: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return payload.p === "video" && payload.vid === videoId && payload.sub ? String(payload.sub) : null;
  } catch { return null; }
}

/**
 * Materi HTML tampil di iframe tersandbox tanpa cookie, jadi klip unggahan diminta dengan tautan bertanda tangan
 * (terikat ke satu klip dan satu pengguna, berlaku 1 jam). Dipanggil hanya setelah akses ke materi lolos.
 */
export async function injectVideoTokens(html: string, userId: string) {
  const ids = [...new Set([...html.matchAll(/\/api\/video\/([0-9a-f]{24})(?![0-9a-f])/g)].map((m) => m[1]))];
  let out = html;
  for (const id of ids) out = out.split(`/api/video/${id}`).join(`/api/video/${id}?t=${await signVideoToken(id, userId)}`);
  return out;
}
