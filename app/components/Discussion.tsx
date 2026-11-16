"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { askConfirm } from "@/components/Feedback";
import { ErrorNote } from "@/components/Charts";
import { useT } from "@/components/LangProvider";

type C = { id: string; parentId: string | null; body: string; at: string; mine: boolean; author: string; hidden: boolean; reports?: number };
const when = (d: string) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

/** Diskusi sebuah unit. Teks polos; peserta hanya melihat komentar institusinya sendiri. Laporkan komentar yang tidak pantas. */
export function Discussion({ unitId }: { unitId: string }) {
  const tr = useT();
  const { data, error, reload } = useApi<{ moderator: boolean; comments: C[] }>(`/api/units/${unitId}/comments`);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const top = (data?.comments ?? []).filter((c) => !c.parentId);
  const replies = (id: string) => (data?.comments ?? []).filter((c) => c.parentId === id);

  async function send() {
    setBusy(true); setErr("");
    try { await api(`/api/units/${unitId}/comments`, { json: { body: text, parentId: replyTo }, silent: true }); setText(""); setReplyTo(null); reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function remove(c: C) {
    if (!(await askConfirm(tr("Delete this comment and its replies?")))) return;
    try { await api(`/api/comments/${c.id}`, { method: "DELETE", silent: true }); reload(); } catch (e) { setErr((e as Error).message); }
  }
  async function flag(c: C) {
    try { await api(`/api/comments/${c.id}/report`, { json: {}, silent: true }); setNote(tr("Thank you. A moderator will review this comment.")); } catch (e) { setErr((e as Error).message); }
  }
  const item = (c: C, child = false) => (
    <li key={c.id} className={`rounded-xl border border-line bg-white p-3 ${child ? "ml-6" : ""} ${c.hidden ? "opacity-60" : ""}`}>
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><b className="text-navy">{c.author === "You" ? tr("You") : c.author === "Moderator" ? tr("Moderator") : c.author}</b><span>{when(c.at)}</span>{c.hidden && <span className="badge-warn">{tr("hidden")}</span>}{data?.moderator && !!c.reports && <span className="badge-warn">{c.reports} report{c.reports === 1 ? "" : "s"}</span>}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm">{c.body}</p>
      <p className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
        {!child && !c.hidden && <button className="text-brand" onClick={() => { setReplyTo(c.id); setNote(""); }}>{tr("Reply")}</button>}
        {(c.mine || data?.moderator) && <button className="text-red-700" onClick={() => remove(c)}>{tr("Delete")}</button>}
        {!c.mine && !data?.moderator && <button className="text-ink-soft" onClick={() => flag(c)}>{tr("Report")}</button>}
        {data?.moderator && <button className="text-brand" onClick={() => api(`/api/comments/${c.id}`, { method: "PATCH", json: { hidden: !c.hidden }, silent: true }).then(reload).catch((e) => setErr((e as Error).message))}>{c.hidden ? tr("Show") : tr("Hide")}</button>}
      </p>
    </li>
  );
  return (
    <section className="card" aria-label="Discussion">
      <h2 className="font-display text-lg font-extrabold text-navy">{tr("Discussion")}</h2>
      <p className="text-sm text-ink-soft">{tr("Ask a question or share a tip about this unit. Be respectful. Only people from your institution see your comments.")}</p>
      <ErrorNote text={error || err} />
      {note && <p role="status" className="mt-2 text-sm text-success">{note}</p>}
      <ul className="mt-3 flex flex-col gap-2">
        {top.map((c) => (
          <li key={c.id} className="list-none">
            <ul className="flex flex-col gap-2">{item(c)}{replies(c.id).map((r) => item(r, true))}</ul>
          </li>
        ))}
        {top.length === 0 && <li className="text-sm text-ink-soft">{tr("No comments yet. Start the discussion.")}</li>}
      </ul>
      <div className="mt-3 flex flex-col gap-2">
        {replyTo && <p className="text-xs text-ink-soft">{tr("Replying to a comment.")} <button className="font-semibold text-brand" onClick={() => setReplyTo(null)}>{tr("Cancel")}</button></p>}
        <label className="text-sm font-semibold text-navy" htmlFor="comment-box">{replyTo ? tr("Your reply") : tr("Your comment")}</label>
        <textarea id="comment-box" className="field h-24 py-2 font-normal" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-solid self-start" disabled={busy || !text.trim()} onClick={send}>{replyTo ? tr("Post reply") : tr("Post comment")}</button>
      </div>
    </section>
  );
}
