import { describe, it, expect } from "vitest";
import { PRESETS } from "@/lib/material-presets";

describe("preset materi interaktif", () => {
  it("semua preset punya kunci unik dan JavaScript yang valid", () => {
    expect(new Set(PRESETS.map((p) => p.key)).size).toBe(PRESETS.length);
    for (const p of PRESETS) {
      expect(() => new Function(p.doc.js ?? ""), p.key).not.toThrow();
      expect((p.doc.html ?? "").toLowerCase(), p.key).not.toMatch(/<script|onerror=|javascript:/);
    }
  });
  it("preset umum untuk mata pelajaran ada: flashcard, penjelasan bertahap, visualisasi struktur data", () => {
    const keys = PRESETS.map((p) => p.key);
    for (const k of ["flashcard", "steps", "dsviz"]) expect(keys).toContain(k);
  });
  it("visualisasi stack dan queue bekerja: push, pop, overflow, underflow, enqueue, dequeue", () => {
    const doc = PRESETS.find((p) => p.key === "dsviz")!.doc;
    // DOM minimal: cukup untuk elemen yang dipakai skrip.
    const els: Record<string, Record<string, unknown>> = {};
    const mk = (id: string, extra: Record<string, unknown> = {}) => (els[id] = { id, textContent: "", value: "", innerHTML: "", appendChild() {}, ...extra });
    mk("kind", { value: "stack" }); mk("val"); mk("cells"); mk("msg"); mk("add"); mk("rem"); mk("clr");
    const document = { getElementById: (id: string) => els[id], createElement: () => ({ className: "", textContent: "", appendChild() {} }) };
    new Function("document", "EI", doc.js ?? "")(document, { report() {}, complete() {} });
    const click = (id: string) => (els[id].onclick as () => void)();
    const say = () => String(els.msg.textContent);
    click("add"); expect(say()).toMatch(/Type a value/);
    for (let i = 1; i <= 8; i++) { els.val.value = String(i); click("add"); }
    els.val.value = "9"; click("add"); expect(say()).toMatch(/overflow/i);
    click("rem"); expect(say()).toBe("pop() returned 8"); // LIFO
    for (let i = 0; i < 7; i++) click("rem");
    click("rem"); expect(say()).toMatch(/underflow/i);
    els.kind.value = "queue"; (els.kind.onchange as () => void)();
    for (const v of ["a", "b"]) { els.val.value = v; click("add"); }
    click("rem"); expect(say()).toBe("dequeue() returned a"); // FIFO
  });
});
