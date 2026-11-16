import { describe, it, expect } from "vitest";
import { materialInput } from "@/lib/material-schemas";

describe("akses materi bawaan (U7.3)", () => {
  it("materi baru bawaannya free, bukan paid; paid tetap bisa dipilih sebagai data", () => {
    const base = { title: "Stack dan Queue", kind: "rich" as const };
    const r = materialInput.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.access).toBe("free");
    const p = materialInput.safeParse({ ...base, access: "paid" });
    expect(p.success && p.data.access).toBe("paid");
    expect(materialInput.safeParse({ ...base, access: "gratis" }).success).toBe(false);
  });
});
