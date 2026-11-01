import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { translate, normLang } from "@/lib/i18n";

const ROOT = path.resolve(__dirname, "..");
function files(dir: string, out: string[] = []) {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", "tests", "scripts"].includes(n)) continue;
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(tsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

describe("i18n", () => {
  it("bahasa bawaan Inggris; teks tanpa terjemahan tampil apa adanya", () => {
    expect(normLang(undefined)).toBe("en");
    expect(normLang("fr")).toBe("en");
    expect(normLang("id")).toBe("id");
    expect(translate("en", "Next")).toBe("Next");
    expect(translate("id", "Next")).toBe("Berikutnya");
    expect(translate("id", "A sentence nobody translated")).toBe("A sentence nobody translated");
  });
  it("variabel diisi di kedua bahasa", () => {
    expect(translate("en", "Question {n} of {total}", { n: 3, total: 8 })).toBe("Question 3 of 8");
    expect(translate("id", "Question {n} of {total}", { n: 3, total: 8 })).toBe("Soal 3 dari 8");
    expect(translate("id", "Question {n} of {total}", { n: 3 })).toBe("Soal 3 dari {total}"); // variabel yang hilang tidak merusak teks
  });
  it("setiap teks t(\"...\") di kode punya terjemahan Indonesia", () => {
    // Kata yang sama di kedua bahasa tidak perlu terjemahan terpisah.
    const same = new Set(["Coaching", "FAQ", "Fullscreen"]);
    const missing: string[] = [];
    for (const f of files(ROOT).filter((x) => !x.endsWith(path.join("lib", "i18n.ts")))) {
      const src = readFileSync(f, "utf-8");
      for (const m of src.matchAll(/(?<![\w.])tr?\(\s*"((?:[^"\\]|\\.)*)"/g)) {
        const key = m[1].replace(/\\"/g, '"');
        if (!same.has(key) && translate("id", key) === key) missing.push(`${path.relative(ROOT, f)}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
