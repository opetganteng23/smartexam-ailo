// Ringkasan catatan proctoring ringan untuk peserta (ditampilkan setelah submit). Hanya hitungan dan durasi;
// browser tidak memberi tahu tab/aplikasi apa yang dibuka, hanya bahwa halaman tes ditinggalkan.
export type ProctorSummary = {
  total: number; tabSwitches: number; awaySec: number; longestAwaySec: number;
  fullscreenExits: number; windowBlurs: number; copies: number; pastes: number;
};
type Flag = { kind?: string | null; at?: Date | null };

/** `tab_visible` hanya penanda kembali ke halaman tes: dipakai untuk durasi, tidak dihitung sebagai catatan. */
export function proctorSummary(flags: Flag[], finishedAt?: Date | null): ProctorSummary {
  const sorted = flags.filter((f) => f.at).sort((a, b) => +a.at! - +b.at!);
  const count = (...kinds: string[]) => sorted.filter((f) => kinds.includes(f.kind ?? "")).length;
  let awaySec = 0, longest = 0, since: number | null = null;
  const close = (end: number) => {
    if (since == null) return;
    const sec = Math.max(0, Math.round((end - since) / 1000));
    awaySec += sec; longest = Math.max(longest, sec); since = null;
  };
  for (const f of sorted) {
    if (f.kind === "tab_hidden" && since == null) since = +f.at!;
    else if (f.kind === "tab_visible") close(+f.at!);
  }
  if (since != null && finishedAt) close(+finishedAt); // masih di luar saat tes dikirim
  const s = {
    tabSwitches: count("tab_hidden"), fullscreenExits: count("fullscreen_exit"), windowBlurs: count("window_blur"),
    copies: count("copy", "cut"), pastes: count("paste"),
  };
  return { ...s, awaySec, longestAwaySec: longest, total: s.tabSwitches + s.fullscreenExits + s.windowBlurs + s.copies + s.pastes + count("multi_tab") };
}
