"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { api } from "@/lib/client";
import { askConfirm } from "@/components/Feedback";
import { Loading, ErrorNote } from "@/components/Charts";

type Row = { id: string; body: string; at: string; unit: string; author: string; hidden: boolean; reports: number; reason: string };
const FILTERS = [["reported", "Reported"], ["hidden", "Hidden"], ["all", "All recent"]] as const;

/** Antrean moderasi diskusi unit: laporan peserta, komentar tersembunyi, dan semua komentar terbaru. */
export default function Moderasi() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("reported");
  const { data, error, loading, reload } = useApi<{ comments: Row[] }>(`/api/admin/comments?filter=${filter}`);
  const [err, setErr] = useState("");
  const act = async (fn: () => Promise<unknown>) => { setErr(""); try { await fn(); reload(); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="flex flex-col gap-4">
      <div><h1 className="page-title">Discussion moderation</h1><p className="text-sm text-ink-soft">Comments that participants reported or that you hid. Hiding removes a comment from participants but keeps it here; showing it again clears its reports.</p></div>
      <div role="tablist" aria-label="Filter" className="flex flex-wrap gap-1 text-sm">
        {FILTERS.map(([k, n]) => <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={`rounded-lg px-3 py-1.5 font-semibold ${filter === k ? "bg-navy text-white" : "text-ink-soft hover:bg-canvas"}`}>{n}</button>)}
      </div>
      <ErrorNote text={error || err} />
      {loading && !data && <Loading />}
      <ul className="flex flex-col gap-2">
        {data?.comments.map((c) => (
          <li key={c.id} className="card !p-3">
            <p className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><b className="text-navy">{c.author}</b><span>{c.unit}</span><span>{new Date(c.at).toLocaleString("en-GB", { timeZone: "Asia/Jakarta" })}</span>{c.hidden && <span className="badge-warn">hidden{c.reason ? `: ${c.reason}` : ""}</span>}{c.reports > 0 && <span className="badge-warn">{c.reports} report{c.reports === 1 ? "" : "s"}</span>}</p>
            <p className="mt-1 whitespace-pre-line break-words text-sm">{c.body}</p>
            <p className="mt-2 flex gap-3 text-sm font-semibold">
              {c.hidden
                ? <button className="text-brand" onClick={() => act(() => api(`/api/comments/${c.id}`, { method: "PATCH", json: { hidden: false }, silent: true }))}>Show again</button>
                : <button className="text-brand" onClick={() => act(() => api(`/api/comments/${c.id}`, { method: "PATCH", json: { hidden: true, reason: window.prompt("Reason (optional)") ?? undefined }, silent: true }))}>Hide</button>}
              <button className="text-red-700" onClick={() => void askConfirm("Delete this comment and its replies permanently?").then((ok) => { if (ok) void act(() => api(`/api/comments/${c.id}`, { method: "DELETE", silent: true })); })}>Delete</button>
            </p>
          </li>
        ))}
        {data && data.comments.length === 0 && <li className="card text-sm text-ink-soft">Nothing here. Reported comments will appear in this list.</li>}
      </ul>
    </div>
  );
}
