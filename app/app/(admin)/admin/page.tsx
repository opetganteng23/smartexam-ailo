"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/useApi";
import { tgl } from "@/lib/client";
import { HBars, Stat, Loading, ErrorNote } from "@/components/Charts";
import { MaintenanceToggle } from "@/components/MaintenanceToggle";

type D = {
  days: number;
  kpi: { institutions: number; participants: number; active: number; invited: number; loggedInRecently: number; placementsDone: number; placementPct: number | null };
  levels: { name: string; n: number; held?: number }[];
  tests: { kind: string; n: number }[];
  actions: { label: string; n: number; href: string }[];
  mail: { queued: number; failed: number };
  ai: { claude: number; template: number; tokensIn: number; tokensOut: number; failed: number };
  expiring: { name: string; contractEnd: string }[];
};
const KIND: Record<string, string> = { placement: "Placement", sim: "Simulation", final: "Final Test", practice: "Practice", quiz: "Unit quiz" };

export default function AdminHome() {
  const [days, setDays] = useState(30);
  const { data: d, loading, error } = useApi<D>(`/api/admin/dashboard?days=${days}`);
  const k = d?.kpi;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="page-title">Overview</h1><p className="text-sm text-ink-soft">Activity in the last {days} days</p></div>
        <div className="flex gap-1 rounded-lg bg-white p-1 text-sm" role="tablist" aria-label="Time range">{[7, 30, 90].map((n) => <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)} className={`rounded-md px-3 py-1.5 font-semibold ${days === n ? "bg-navy text-white" : "text-ink-soft"}`}>{n} days</button>)}</div>
      </div>
      <MaintenanceToggle />
      <ErrorNote text={error} />
      {loading && !d ? <Loading /> : d && k && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="ACTIVE INSTITUTIONS" value={k.institutions} />
            <Stat label="PARTICIPANTS" value={k.participants} sub={`${k.active} active · ${k.invited} awaiting activation`} tone={k.invited > k.active ? "warn" : undefined} />
            <Stat label="RECENT SIGN-INS" value={k.loggedInRecently} sub={`participants in ${d.days} days`} />
            <Stat label="PLACEMENT COMPLETED" value={k.placementsDone} sub={k.placementPct != null ? `${k.placementPct}% of active participants` : undefined} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Participant level distribution</h2><div className="mt-4"><HBars rows={d.levels.map((l) => ({ label: l.name, value: l.n, sub: l.held ? `participants · ${l.held} not released yet` : "participants" }))} /></div><p className="mt-2 text-xs text-ink-soft">Includes placement results that are held or waiting for release. QA test accounts are excluded.</p></section>
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Completed tests ({d.days} days)</h2>
              <div className="mt-4">{d.tests.length ? <HBars color="#F07020" rows={d.tests.map((t) => ({ label: KIND[t.kind] ?? t.kind, value: t.n, sub: "tests" }))} /> : <p className="text-sm text-ink-soft">No completed tests yet. Results appear here as participants finish their tests.</p>}</div></section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="card"><h2 className="font-display text-lg font-extrabold text-navy">Needs action</h2>
              <ul className="mt-3 flex flex-col divide-y divide-line">{d.actions.map((a) => <li key={a.label} className="flex items-center justify-between gap-3 py-3"><span className="text-sm">{a.label}</span><span className="flex items-center gap-3"><span className={a.n ? "badge-warn" : "badge-ok"}>{a.n}</span><Link href={a.href} className="text-sm font-semibold text-brand">Open</Link></span></li>)}</ul>
              <p className="mt-2 text-xs text-ink-soft">Email queue: {d.mail.queued} waiting, {d.mail.failed} failed.</p>
              <p className="text-xs text-ink-soft">Analyses in {d.days} days: {d.ai.claude} by Claude, {d.ai.template} template narratives, {d.ai.failed} failed · tokens {d.ai.tokensIn.toLocaleString("en-GB")} in / {d.ai.tokensOut.toLocaleString("en-GB")} out.</p></section>
          </div>
        </>
      )}
    </div>
  );
}
