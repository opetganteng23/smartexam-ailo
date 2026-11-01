"use client";

import { useState } from "react";
import { useApi } from "@/lib/useApi";
import { useInstQuery, useInstScope } from "@/lib/inst-client";
import { Loading, ErrorNote, Empty } from "@/components/Charts";
import { ScheduleBoard } from "@/components/ScheduleBoard";

type G = { id: string; name: string; kind: string };

/** Jadwal tes rombongan: papan jadwal yang sama dengan admin (hanya lihat). */
export default function InstJadwal() {
  const { url, ready } = useInstQuery();
  const scoped = useInstScope(); // dibuka admin dari halaman institusi: papan bisa diubah (pindah sesi), hanya orang institusi ini
  const { data, loading, error } = useApi<{ groups: G[] }>(url("/api/inst/schedule"));
  const [pick, setPick] = useState<string | null>(null);
  if (!ready || loading) return <Loading />;
  const groups = data?.groups ?? [];
  const current = groups.find((g) => g.id === pick) ?? groups[0];
  return (
    <div className="flex flex-col gap-5">
      <ErrorNote text={error} />
      {groups.length === 0 && <><h1 className="page-title">Group test schedule</h1><Empty>No scheduled tests for your participants yet. The program admin schedules tests; they appear here automatically.</Empty></>}
      {groups.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">{groups.map((g) => <button key={g.id} role="tab" aria-selected={g.id === current?.id} className={g.id === current?.id ? "btn-solid !min-h-[40px]" : "btn-outline !min-h-[40px]"} onClick={() => setPick(g.id)}>{g.name}</button>)}</div>
      )}
      {current && (scoped
        ? <ScheduleBoard key={current.id} testId={current.id} institutionId={scoped} back={{ href: `/admin/institutions/${scoped}?tab=schedule`, label: current.name }} />
        : <ScheduleBoard key={current.id} testId={current.id} readOnly apiUrl={url(`/api/inst/tests/${current.id}/schedule`) ?? undefined} back={{ href: "/institution", label: "← Overview" }} />)}

    </div>
  );
}
