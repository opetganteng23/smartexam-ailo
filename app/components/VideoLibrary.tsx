"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { askConfirm } from "@/components/Feedback";
import { api } from "@/lib/client";

type V = { id: string; title: string; kind: "upload" | "embed"; provider: string | null; size: number | null; src: string };
const MAX = 100 * 1024 * 1024;
const mb = (n: number | null) => (n ? `${(n / 1048576).toFixed(1)} MB` : "");
const label = "flex flex-col gap-1.5 text-sm font-semibold text-navy";

/** Perpustakaan video: tautan YouTube atau Vimeo (utama) dan klip MP4 pendek unggahan (maks 100 MB). */
export function VideoLibrary({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<V[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => api<{ videos: V[] }>("/api/admin/videos").then((d) => setList(d.videos)).catch((e) => setErr((e as Error).message)), []);
  useEffect(() => { load(); }, [load]);

  async function addLink() {
    setErr("");
    try { await api("/api/admin/videos", { json: { title: title.trim(), url: url.trim() }, silent: true }); setTitle(""); setUrl(""); load(); } catch (e) { setErr((e as Error).message); }
  }
  function upload() {
    setErr("");
    if (!file) return setErr("Choose an MP4 file first");
    if (file.type !== "video/mp4" && !/\.mp4$/i.test(file.name)) return setErr("Only MP4 files (H.264) are accepted");
    if (file.size > MAX) return setErr("The video is larger than 100 MB. Upload it to YouTube or Vimeo and add the link instead.");
    if (!title.trim()) return setErr("Enter a title");
    const x = new XMLHttpRequest();
    x.open("POST", `/api/admin/videos?title=${encodeURIComponent(title.trim())}`);
    x.setRequestHeader("Content-Type", "video/mp4");
    x.upload.onprogress = (e) => { if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { setPct(null); if (x.status === 201) { setFile(null); setTitle(""); load(); } else { try { setErr(JSON.parse(x.responseText).error ?? "Upload failed"); } catch { setErr("Upload failed"); } } };
    x.onerror = () => { setPct(null); setErr("Upload failed. Check the connection and try again."); };
    setPct(0);
    x.send(file);
  }
  async function remove(v: V) {
    if (!(await askConfirm(`Delete "${v.title}"? A video that is still used by a material or question group cannot be deleted.`))) return;
    try { await api(`/api/admin/videos/${v.id}`, { method: "DELETE", silent: true }); load(); } catch (e) { setErr((e as Error).message); }
  }
  async function rename(v: V) {
    const n = window.prompt("Video title", v.title)?.trim();
    if (!n || n === v.title) return;
    try { await api(`/api/admin/videos/${v.id}`, { method: "PATCH", json: { title: n }, silent: true }); load(); } catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title="Video library" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p className="text-ink-soft">Prefer a YouTube (unlisted) or Vimeo link: it plays smoothly and does not use server disk. Upload a file only for short clips: MP4 (H.264), at most 100 MB.</p>
        <ul className="max-h-52 overflow-y-auto rounded-lg border border-line" aria-label="Videos">
          {list.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 last:border-0">
              <b className="text-navy">{v.title}</b><span className="badge-muted">{v.kind === "upload" ? `clip ${mb(v.size)}` : v.provider}</span>
              <span className="ml-auto flex gap-3 font-semibold"><button className="text-brand" onClick={() => rename(v)}>Rename</button><button className="text-red-700" onClick={() => remove(v)}>Delete</button></span>
            </li>
          ))}
          {list.length === 0 && <li className="p-3 text-ink-soft">No videos yet.</li>}
        </ul>
        <label className={label}>Title<input className="field font-normal" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <label className={label}>YouTube or Vimeo link<input className="field font-normal" placeholder="https://www.youtube.com/watch?v=..." value={url} onChange={(e) => setUrl(e.target.value)} /></label>
            <button className="btn-outline self-start" disabled={!title.trim() || !url.trim()} onClick={addLink}>Add link</button>
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <label className={label}>MP4 clip (max 100 MB)<input type="file" accept="video/mp4,.mp4" className="text-sm font-normal" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <button className="btn-outline self-start" disabled={!file || pct !== null} onClick={upload}>{pct !== null ? `Uploading ${pct}%` : "Upload clip"}</button>
          </div>
        </div>
        {err && <p role="alert" className="text-red-700">{err}</p>}
      </div>
    </Modal>
  );
}
