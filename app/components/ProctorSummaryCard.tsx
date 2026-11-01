"use client";

import { useApi } from "@/lib/useApi";
import { useT } from "./LangProvider";
import type { ProctorSummary } from "@/lib/proctor-summary";

const dur = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

/** Ringkasan pengawasan yang selalu tampil setelah submit (tes maupun quiz), terlepas dari hasil sudah dirilis atau belum. */
export function ProctorSummaryCard({ attemptId }: { attemptId: string }) {
  const t = useT();
  const { data: p } = useApi<ProctorSummary>(`/api/attempts/${attemptId}/proctoring`);
  if (!p) return null;
  const rows: [string, string, boolean][] = [
    [t("Tab or app switches"), String(p.tabSwitches), p.tabSwitches > 0],
    [t("Time away from the test"), dur(p.awaySec), p.awaySec > 0],
    [t("Longest time away"), dur(p.longestAwaySec), p.longestAwaySec > 0],
    [t("Left fullscreen"), String(p.fullscreenExits), p.fullscreenExits > 0],
    [t("Window lost focus"), String(p.windowBlurs), p.windowBlurs > 0],
    [t("Copy or cut"), String(p.copies), p.copies > 0],
    [t("Paste"), String(p.pastes), p.pastes > 0],
  ];
  return (
    <section className="card !p-4" aria-label={t("Proctoring summary")}>
      <p className="text-xs font-semibold tracking-wider text-brand">{t("Proctoring summary").toUpperCase()}</p>
      <p className="mt-1 text-sm text-ink-soft">{t("Activity detected during your session. Your institution can review this record.")}</p>
      {p.total === 0
        ? <p className="mt-3 font-semibold text-success">{t("No unusual activity was detected.")}</p>
        : <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {rows.map(([k, v, bad]) => (
              <div key={k} className={`rounded-xl p-3 ${bad ? "bg-accent-tint" : "bg-canvas"}`}>
                <dt className="text-xs font-semibold text-ink-soft">{k}</dt>
                <dd className={`font-display text-2xl font-extrabold ${bad ? "text-accent-dark" : "text-navy"}`}>{v}</dd>
              </div>
            ))}
          </dl>}
    </section>
  );
}
