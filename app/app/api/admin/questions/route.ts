import { NextResponse } from "next/server";
import { htmlToText } from "@/lib/question-html";
import { zodMessage } from "@/lib/zod-message";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { requireRole, handleError, HttpError, CONTENT_ROLES } from "@/lib/rbac";
import { Question, QuestionGroup } from "@/models/Question";
import { registerQuestionType } from "@/lib/question-types";
import { recordQuestionVersion } from "@/lib/question-versions";
import { questionSchema } from "@/lib/admin-schemas";
import { AuditLog } from "@/models/AuditLog";
import { checkQuestionRefs, collectionVisible, questionVisibleFilter } from "@/lib/collections";
import { QuestionCollection } from "@/models/Question";
import { resolveBank, UNGROUPED_FILTER } from "@/lib/question-bank";


const escapeRegex = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function GET(req: Request) {
  try {
    const me = await requireRole(CONTENT_ROLES);
    await connectDB();
    const sp = new URL(req.url).searchParams;
    const vis = await questionVisibleFilter(me);
    const scoped = (f: Record<string, unknown>) => (Object.keys(vis).length ? { $and: [f, vis] } : f);
    const filter: Record<string, unknown> = {};
    for (const k of ["section", "status", "difficulty"]) if (sp.get(k)) filter[k] = sp.get(k);
    const multi = (sp.get("collectionIds") ?? "").split(",").filter(Boolean); // beberapa bank sekaligus (pembuat tes)
    if (multi.length) {
      if (multi.length > 11 || multi.some((x) => !/^[0-9a-f]{24}$/.test(x))) throw new HttpError(400, "Invalid collectionIds");
      filter.collectionId = { $in: multi };
    }
    if (sp.get("collectionId") === "none") Object.assign(filter, UNGROUPED_FILTER);
    for (const k of ["categoryId", "collectionId"]) if (sp.get(k) && !(k === "collectionId" && sp.get(k) === "none")) { if (!/^[0-9a-f]{24}$/.test(sp.get(k)!)) throw new HttpError(400, "Invalid " + k); filter[k] = sp.get(k); }
    if (sp.get("collectionId") && sp.get("collectionId") !== "none" && !(await QuestionCollection.exists({ _id: sp.get("collectionId"), ...collectionVisible(me) }))) throw new HttpError(404, "Collection not found");
    // Jenis dicocokkan tanpa membedakan huruf besar/kecil (soal lama bisa menulisnya berbeda dari daftar jenis).
    if (sp.get("type")) filter.type = { $regex: "^" + escapeRegex(sp.get("type")!) + "$", $options: "i" };
    // ?ids=a,b,c: ambil soal tertentu (untuk perakit tes), urutan mengikuti ids.
    const ids = (sp.get("ids") ?? "").split(",").filter((x) => /^[0-9a-f]{24}$/.test(x)).slice(0, 200);
    if (sp.has("ids")) {
      const found = await Question.find(scoped({ _id: { $in: ids } })).select("section type stem stemFormat status").lean();
      for (const it of found) if (it.stemFormat === "html") it.stem = htmlToText(it.stem).slice(0, 300);
      const by = new Map(found.map((x) => [String(x._id), x]));
      return NextResponse.json({ items: ids.map((i) => by.get(i)).filter(Boolean) });
    }
    const q = sp.get("q")?.trim();
    if (q) filter.stem = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const size = 20;
    const [items, total] = await Promise.all([
      Question.find(scoped(filter)).select("section type stem stemFormat status difficulty groupId tags explanation updatedAt kind points").sort({ updatedAt: -1 }).skip((page - 1) * size).limit(size).lean(),
      Question.countDocuments(scoped(filter)),
    ]);
    // Daftar menampilkan ringkasan teks: soal berformat HTML dikirim sebagai teks tanpa tag.
    for (const it of items) if (it.stemFormat === "html") it.stem = htmlToText(it.stem).slice(0, 300);
    // Validasi kualitas: soal yang perlu dilengkapi (tanpa tag, tanpa pembahasan, Listening tanpa grup audio/passage).
    const gids = Array.from(new Set(items.map((i) => i.groupId).filter(Boolean).map(String)));
    const groups = gids.length ? await QuestionGroup.find({ _id: { $in: gids } }).select("audioId passageHtml").lean() : [];
    const gmap = new Map(groups.map((g) => [String(g._id), g]));
    const withIssues = items.map((i) => {
      const issues: string[] = [];
      if (!i.tags?.length) issues.push("No skill/topic tag");
      if (!i.explanation) issues.push("No explanation");
      const g = i.groupId ? gmap.get(String(i.groupId)) : null;
      if (i.section === "listening" && !(g && g.audioId)) issues.push("No audio group");
      if (i.section === "reading" && !(g && g.passageHtml)) issues.push("No passage group");
      return { ...i, explanation: undefined, issues };
    });
    return NextResponse.json({ items: withIssues, total, page, pages: Math.ceil(total / size) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const admin = await requireRole(CONTENT_ROLES);
    const body = questionSchema.parse(await req.json());
    if (admin.role === "content_editor" && !["draft", "review"].includes(body.status)) throw new HttpError(403, "Editors can save drafts and send questions for review. An academic admin publishes them.");
    await connectDB();
    await checkQuestionRefs(admin, body);
    const bank = await resolveBank(body); // bank wajib kecuali bagian ITP; section diturunkan dari bank
    const q = await Question.create({ ...body, section: bank.section, groupId: body.groupId ?? undefined, categoryId: bank.categoryId ?? undefined, collectionId: bank.collectionId ?? undefined });
    await registerQuestionType(bank.section, body.type);
    await recordQuestionVersion(q._id, q.toObject(), admin._id);
    await AuditLog.create({ actorId: admin._id, action: "question.create", target: String(q._id) });
    return NextResponse.json({ id: String(q._id) }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
    return handleError(e);
  }
}

export const dynamic = "force-dynamic";
