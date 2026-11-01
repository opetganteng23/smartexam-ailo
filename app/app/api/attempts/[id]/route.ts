import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError } from "@/lib/rbac";
import { getParam } from "@/lib/config";
import { loadAttempt, sectionDeadline, isVersionError } from "@/lib/attempts";
import { Question, QuestionGroup } from "@/models/Question";
import { orderQuestions, optionPermutation } from "@/lib/shuffle";
import { touchConn, creditGap } from "@/lib/conn";
import { Attempt } from "@/models/Test";
import { isValidObjectId } from "mongoose";
import { kindOf, type MatchingKey, type EssayKey } from "@/lib/question-kinds";

const ROLES = ["participant", "admin", "inst_admin"] as const;

/** State tes: hanya soal section aktif, tanpa kunci jawaban. Sisa waktu dihitung server. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole([...ROLES]);
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status === "submitted") return NextResponse.json({ status: "submitted" });
    if (String(attempt.userId) === String(user._id)) await touchConn(attempt, { load: new URL(req.url).searchParams.has("open") }); // open=1: halaman tes baru dibuka/dimuat ulang

    const section = test.sections[attempt.sectionIdx];
    await connectDB();
    const qs = await Question.find({ _id: { $in: section.questionIds } })
      .select("-answerKey -explanation -status").lean();
    const order = new Map(section.questionIds.map((id, i) => [String(id), i]));
    qs.sort((a, b) => order.get(String(a._id))! - order.get(String(b._id))!);
    const sid = String(attempt._id);
    const ordered = orderQuestions(test, qs, `${sid}:q:${attempt.sectionIdx}`);
    // Pilihan diacak per peserta: tampil pada posisi acak, tersimpan sebagai indeks asli (penilaian tidak berubah).
    const perms = new Map<string, number[]>();
    if (test.shuffleOptions) for (const q of qs) perms.set(String(q._id), optionPermutation(`${sid}:o:${q._id}`, q.options.length));

    const groups = await QuestionGroup.find({ _id: { $in: qs.map((q) => q.groupId).filter((g): g is NonNullable<typeof g> => !!g) } }).lean();
    const played = new Map(attempt.audioPlays.map((p) => [String(p.audioId), p]));

    return NextResponse.json({
      status: "in_progress",
      testName: test.name,
      section: { index: attempt.sectionIdx, total: test.sections.length, name: section.name },
      kind: attempt.kind,
      secure: !!test.secureMode, reached: attempt.secureReached ?? 0, screenWatch: !!test.screenWatch,
      idleTimeoutSec: await getParam("idle_timeout_sec"),
      remainingSec: Math.max(0, Math.round((sectionDeadline(attempt, test) - Date.now()) / 1000)),
      groups: groups.map((g) => ({
        id: String(g._id), instruction: g.instruction, passageTitle: g.passageTitle, passageHtml: g.passageHtml,
        audio: g.audioId ? { id: String(g.audioId), finished: !!played.get(String(g.audioId))?.done } : null,
      })),
      questions: ordered.map((q) => {
        const kind = kindOf(q), pairs = kind === "matching" ? (q.key as MatchingKey).pairs : [];
        return {
          id: String(q._id), groupId: q.groupId ? String(q.groupId) : null, stem: q.stem, options: perms.has(String(q._id)) ? perms.get(String(q._id))!.map((i) => q.options[i]) : q.options,
          assetIds: q.assetIds.map(String), kind, points: q.points ?? 1,
          // Mencocokkan: kolom kanan ditampilkan acak per peserta; indeks tampil diterjemahkan server ke indeks asli (kunci tidak pernah dikirim).
          ...(kind === "matching" ? { lefts: pairs.map((p) => p.left), rights: optionPermutation(`${sid}:m:${q._id}`, pairs.length).map((i) => pairs[i].right) } : {}),
          ...(kind === "essay" ? { maxWords: (q.key as EssayKey | undefined)?.maxWords ?? null } : {}),
        };
      }),
      answers: attempt.answers.map((a) => ({ qid: String(a.qid), response: shownResponse(a, qs, sid), choice: a.choice != null && perms.has(String(a.qid)) ? perms.get(String(a.qid))!.indexOf(a.choice) : a.choice, flagged: !!a.flagged, timeSpentSec: a.timeSpentSec ?? 0 })),
    });
  } catch (e) {
    return handleError(e);
  }
}

const patchSchema = z.object({
  answers: z.array(z.object({
    qid: z.string(), choice: z.number().int().min(0).max(5).nullable().optional(),
    response: z.union([z.array(z.number().int().min(-1).max(40)).max(40), z.string().max(20000)]).nullable().optional(),
    timeSpentSec: z.number().min(0).max(3600).optional(), flagged: z.boolean().optional(),
  })).max(200).optional(),
  flags: z.array(z.union([z.enum(["tab_hidden", "tab_visible", "window_blur", "copy", "cut", "fullscreen_exit", "paste", "multi_tab"]), z.object({ kind: z.enum(["tab_hidden", "tab_visible", "window_blur", "copy", "cut", "fullscreen_exit", "paste", "multi_tab"]), qid: z.string().regex(/^[0-9a-f]{24}$/).nullable().optional() })])).max(20).optional(),
  reached: z.number().int().min(0).max(1000).optional(),
  section: z.number().int().min(0).max(10).optional(),
});

/** Autosave. Hanya soal section aktif yang diterima, dan hanya sebelum waktu habis. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireRole([...ROLES]);
    const body = patchSchema.parse(await req.json());
    // Heartbeat (body kosong): cukup catat koneksi, tanpa memuat soal.
    if (!body.answers?.length && !body.flags?.length && body.reached == null) {
      if (!isValidObjectId(params.id)) throw new HttpError(404, "Attempt not found");
      await connectDB();
      const a = await Attempt.findOne({ _id: params.id, userId: user._id }).select("status sectionIdx timeCredits conn.lastSeenAt").lean();
      if (!a) throw new HttpError(404, "Attempt not found");
      if (a.status !== "in_progress") return NextResponse.json({ ok: false, status: a.status });
      const credited = await creditGap(a);
      await touchConn(a);
      return NextResponse.json({ ok: true, credited });
    }
    // Dua simpanan bersamaan (koneksi tersendat lalu menumpuk) bisa bentrok versi dokumen: muat ulang dan terapkan lagi, jawaban tidak hilang.
    for (let tryNo = 0; ; tryNo++) {
    try {
    const { attempt, test } = await loadAttempt(params.id, user);
    if (attempt.status !== "in_progress") throw new HttpError(409, "Time is up or the test is already finished");

    const allowed = new Set(test.sections[attempt.sectionIdx].questionIds.map(String));
    // Mode aman: nomor yang sudah dilewati tidak bisa dijawab/diubah lagi (ditegakkan di server, bukan hanya di layar).
    let lockedBefore = -1;
    let reach: number | null = null;
    const shownIdx = new Map<string, number>();
    if (test.secureMode) {
      const section = test.sections[attempt.sectionIdx];
      const qs = await Question.find({ _id: { $in: section.questionIds } }).select("groupId tags").lean();
      const order = new Map(section.questionIds.map((id, i) => [String(id), i]));
      qs.sort((a, b) => order.get(String(a._id))! - order.get(String(b._id))!);
      const ordered = orderQuestions(test, qs, `${String(attempt._id)}:q:${attempt.sectionIdx}`);
      ordered.forEach((q, i) => shownIdx.set(String(q._id), i));
      lockedBefore = attempt.secureReached ?? 0;
      // Posisi hanya berlaku untuk bagian asalnya. Simpanan dari bagian sebelumnya yang tiba setelah pindah bagian
      // (mis. "soal 40" Structure) dulu tercatat di Reading sehingga soal 1-39 terkunci. Klien lama tanpa `section`: hanya maju bertahap.
      const sameSection = body.section != null ? body.section === attempt.sectionIdx : body.reached != null && body.reached <= lockedBefore + 1;
      if (body.reached != null && sameSection) reach = Math.min(body.reached, ordered.length - 1);
    }
    // Jenis soal untuk jawaban bebas bentuk (hanya dimuat bila ada, agar autosave pilihan ganda tetap ringan).
    const respQids = (body.answers ?? []).filter((x) => x.response !== undefined && allowed.has(x.qid)).map((x) => x.qid);
    const kindOfQ = new Map((respQids.length ? await Question.find({ _id: { $in: respQids } }).select("kind key").lean() : []).map((q) => [String(q._id), q]));
    const optLen = new Map<string, number>();
    if (test.shuffleOptions) for (const q of await Question.find({ _id: { $in: [...allowed] } }).select("options").lean()) optLen.set(String(q._id), q.options.length);
    for (const a of body.answers ?? []) {
      if (!allowed.has(a.qid)) continue; // soal section lain diabaikan
      const cur = attempt.answers.find((x) => String(x.qid) === a.qid);
      // Mode aman: soal yang sudah dilewati tidak bisa DIUBAH. Jawaban pertama yang tiba terlambat (simpanan tersalip simpanan
      // berikutnya saat koneksi lambat) tetap diterima, asal soal itu masih kosong dan baru saja dilewati.
      const passed = lockedBefore > 0 && (shownIdx.get(a.qid) ?? 0) < lockedBefore;
      if (a.response !== undefined) {
        const q = kindOfQ.get(a.qid), kind = q ? kindOf(q) : "mcq";
        if (kind === "mcq") continue; // jawaban bebas bentuk hanya untuk jenis lain
        let resp: number[] | string | null = a.response;
        if (kind === "matching") {
          const n = ((q!.key as MatchingKey | undefined)?.pairs ?? []).length;
          if (!Array.isArray(resp) || resp.length !== n || resp.some((v) => v >= n)) continue;
          const perm = optionPermutation(`${attempt._id}:m:${a.qid}`, n);
          resp = resp.every((v) => v < 0) ? null : resp.map((v) => (v < 0 ? -1 : perm[v])); // indeks tampil -> indeks asli
        } else if (typeof resp === "string") resp = resp.trim() ? resp : null;
        else if (resp !== null) continue;
        if (passed && (cur?.response != null || resp == null)) continue; // mode aman: soal yang sudah dilewati tidak bisa diubah
        const nextR = { qid: a.qid, response: resp ?? undefined, timeSpentSec: a.timeSpentSec ?? cur?.timeSpentSec, flagged: a.flagged ?? cur?.flagged };
        if (cur) Object.assign(cur, nextR); else attempt.answers.push(nextR as never);
        continue;
      }
      // Soal tanpa catatan sama sekali = jawabannya belum pernah sampai ke server (mis. simpanan gagal lalu reload); dilewati dengan sengaja selalu tercatat kosong.
      if (passed && (cur?.choice != null || a.choice == null || (cur && (shownIdx.get(a.qid) ?? 0) < lockedBefore - 5))) continue;
      let choice = a.choice ?? undefined;
      if (choice != null && test.shuffleOptions) {
        const n = optLen.get(a.qid) ?? 0;
        if (choice >= n) continue; // indeks tampil di luar jangkauan
        choice = optionPermutation(`${attempt._id}:o:${a.qid}`, n)[choice]; // indeks tampil -> indeks asli
      }
      // firstChoice & changes dihitung SERVER (tidak dipercaya dari klien): indikator ragu-ragu untuk analisis (MTS §11).
      const firstChoice = cur?.firstChoice ?? choice;
      const changed = cur?.choice != null && choice != null && cur.choice !== choice;
      const next = { qid: a.qid, choice, firstChoice, changes: (cur?.changes ?? 0) + (changed ? 1 : 0), timeSpentSec: a.timeSpentSec ?? cur?.timeSpentSec, flagged: a.flagged ?? cur?.flagged };
      if (cur) Object.assign(cur, next);
      else attempt.answers.push(next as never);
    }
    const now = new Date();
    for (const f of body.flags ?? []) { const kind = typeof f === "string" ? f : f.kind; const qid = typeof f === "string" ? null : f.qid; attempt.proctorFlags.push({ kind, at: now, section: attempt.sectionIdx, ...(qid && allowed.has(qid) ? { qid } : {}) } as never); }
    await attempt.save();
    // Posisi ditulis atomik dan hanya bila bagiannya masih sama. Dulu ikut attempt.save(): simpanan lambat (koneksi tersendat)
    // yang selesai SETELAH pindah bagian menimpa secureReached=0 dengan posisi bagian lama (mis. 39), sehingga Reading
    // langsung mulai di soal 40 dan soal 1-39 terkunci.
    if (reach != null) await Attempt.updateOne({ _id: attempt._id, status: "in_progress", sectionIdx: attempt.sectionIdx }, { $max: { secureReached: reach } });
    if (String(attempt.userId) === String(user._id)) await touchConn(attempt);
    return NextResponse.json({ ok: true, savedAt: now });
    } catch (e) { if (isVersionError(e) && tryNo < 4) continue; throw e; }
    }
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    return handleError(e);
  }
}

/** Jawaban yang dikirim balik ke klien: mencocokkan diterjemahkan dari indeks asli ke indeks tampil (kolom kanan diacak per peserta). */
function shownResponse(a: { qid?: unknown; response?: unknown }, qs: { _id: unknown; kind?: string | null; key?: unknown }[], sid: string) {
  if (a.response == null) return null;
  const q = qs.find((x) => String(x._id) === String(a.qid));
  if (!q || kindOf(q) !== "matching" || !Array.isArray(a.response)) return a.response;
  const perm = optionPermutation(`${sid}:m:${a.qid}`, (a.response as number[]).length);
  return (a.response as number[]).map((o) => (o < 0 ? -1 : perm.indexOf(o)));
}
