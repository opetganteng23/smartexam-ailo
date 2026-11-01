import { describe, expect, it } from "vitest";
import { proctorSummary } from "@/lib/proctor-summary";

const at = (s: number) => new Date(Date.UTC(2026, 10, 1, 8, 0, s));

describe("proctorSummary", () => {
  it("tanpa catatan: semua nol", () => {
    expect(proctorSummary([])).toEqual({ total: 0, tabSwitches: 0, awaySec: 0, longestAwaySec: 0, fullscreenExits: 0, windowBlurs: 0, copies: 0, pastes: 0 });
  });
  it("menghitung pindah tab dan lama di luar; tab_visible bukan catatan", () => {
    const r = proctorSummary([
      { kind: "tab_hidden", at: at(10) }, { kind: "tab_visible", at: at(40) },
      { kind: "tab_hidden", at: at(100) }, { kind: "tab_visible", at: at(110) },
    ]);
    expect(r).toMatchObject({ tabSwitches: 2, awaySec: 40, longestAwaySec: 30, total: 2 });
  });
  it("masih di luar saat submit: dihitung sampai waktu selesai", () => {
    expect(proctorSummary([{ kind: "tab_hidden", at: at(10) }], at(70))).toMatchObject({ awaySec: 60, longestAwaySec: 60 });
    expect(proctorSummary([{ kind: "tab_hidden", at: at(10) }])).toMatchObject({ awaySec: 0 });
  });
  it("copy dan cut digabung, paste dan layar penuh terpisah", () => {
    expect(proctorSummary([{ kind: "copy", at: at(1) }, { kind: "cut", at: at(2) }, { kind: "paste", at: at(3) }, { kind: "fullscreen_exit", at: at(4) }, { kind: "window_blur", at: at(5) }]))
      .toMatchObject({ copies: 2, pastes: 1, fullscreenExits: 1, windowBlurs: 1, total: 5 });
  });
});
