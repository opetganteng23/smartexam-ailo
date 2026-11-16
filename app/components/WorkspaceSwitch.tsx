"use client";

import { useRouter } from "next/navigation";

export type Workspace = "general" | "itp";
export const WORKSPACE_COOKIE = "ws";

/** Ruang kerja saat ini dari cookie (di klien). Bawaan: umum. */
export function readWorkspace(): Workspace {
  if (typeof document === "undefined") return "general";
  return /(?:^|; )ws=itp(?:;|$)/.test(document.cookie) ? "itp" : "general";
}

/** Pemilih ruang kerja admin: Umum (semua mata pelajaran) atau TOEFL ITP. Menu dan halaman course menyesuaikan. */
export function WorkspaceSwitch({ current }: { current: Workspace }) {
  const router = useRouter();
  const pick = (w: Workspace) => {
    document.cookie = `${WORKSPACE_COOKIE}=${w}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh();
    window.dispatchEvent(new Event("workspace-change"));
  };
  return (
    <div role="group" aria-label="Workspace" className="inline-flex rounded-xl border border-line bg-white p-1 text-sm">
      {([["general", "General"], ["itp", "TOEFL ITP"]] as const).map(([k, n]) => (
        <button key={k} type="button" aria-pressed={current === k} onClick={() => pick(k)}
          className={`rounded-lg px-3 py-1.5 font-semibold transition ${current === k ? "bg-navy text-white" : "text-ink-soft hover:bg-canvas"}`}>{n}</button>
      ))}
    </div>
  );
}
