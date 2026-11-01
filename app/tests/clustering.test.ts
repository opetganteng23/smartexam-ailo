import { describe, it, expect } from "vitest";
import { normName, nameSimilarity, matchPerson, findNameInText } from "@/lib/name-match";
import { pickClass } from "@/lib/class-pick";

describe("pencocokan nama", () => {
  it("normalisasi membuang aksen, tanda baca, dan gelar", () => expect(normName("Dr. Siti  Nurhaliza, S.Pd")).toBe("siti nurhaliza"));
  it("sama persis 1, urutan kata beda 0.95, salah ketik kecil tinggi, nama lain rendah", () => {
    expect(nameSimilarity("Budi Santoso", "budi santoso")).toBe(1);
    expect(nameSimilarity("Santoso Budi", "Budi Santoso")).toBe(0.95);
    expect(nameSimilarity("Budi Santosa", "Budi Santoso")).toBeGreaterThan(0.8);
    expect(nameSimilarity("Andi Wijaya", "Budi Santoso")).toBeLessThan(0.5);
  });
  const people = [{ id: "1", name: "Budi Santoso", email: "budi@x.id" }, { id: "2", name: "Budi Hartono" }, { id: "3", name: "Siti Aminah" }];
  it("email sama persis selalu menang", () => expect(matchPerson("Siapa Saja", "BUDI@x.id", people)[0]).toMatchObject({ id: "1", confidence: 1 }));
  it("kandidat diurutkan dari yang paling mirip", () => expect(matchPerson("Budi Santosa", undefined, people)[0].id).toBe("1"));
  it("nama di dalam isi PDF ditemukan", () => expect(findNameInText("CERTIFICATE\nThis is to certify that SITI AMINAH has completed", people)?.id).toBe("3"));
});

describe("pilih kelas", () => {
  const cls = (id: string, capacity: number, count: number) => ({ id, capacity, count });
  it("kelas penuh tidak dipilih; tanpa kursi menghasilkan null", () => {
    expect(pickClass([cls("a", 2, 2)], () => 0)).toBeNull();
    expect(pickClass([cls("a", 2, 2), cls("b", 2, 1)], () => 0)).toBe("b");
  });
  it("kelas yang paling longgar diutamakan, seri diacak", () => {
    expect(pickClass([cls("a", 10, 5), cls("b", 10, 2), cls("c", 10, 7)], () => 0.99)).toBe("b");
    expect(pickClass([cls("a", 10, 3), cls("b", 10, 3)], () => 0)).toBe("a");
    expect(pickClass([cls("a", 10, 3), cls("b", 10, 3)], () => 0.99)).toBe("b");
  });
  it("keterisian dibandingkan relatif terhadap kapasitas", () => expect(pickClass([cls("a", 10, 5), cls("b", 30, 10)], () => 0)).toBe("b"));
});
