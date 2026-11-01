import { connectDB } from "./db";
import { Certificate } from "@/models/Certificate";
import { Attempt, Test } from "@/models/Test";
import { nextSeq } from "@/models/Settings";
import type { Types } from "mongoose";

export async function certificateNumber() {
  const y = new Date().getFullYear();
  const seq = await nextSeq(`cert-sim_report-${y}`);
  return `SMX-RPT-${y}-${String(seq).padStart(6, "0")}`;
}

/** Laporan hasil tes (bukan sertifikat resmi). Idempoten per attempt. */
export async function ensureSimReport(attemptId: Types.ObjectId | string) {
  await connectDB();
  const a = await Attempt.findById(attemptId).lean();
  if (!a || a.status !== "submitted" || a.kind === "trial") return null;
  const hit = await Certificate.findOne({ attemptId: a._id });
  if (hit) return hit;
  const test = await Test.findById(a.testId).select("name").lean();
  try {
    return await Certificate.create({
      userId: a.userId, type: "sim_report", number: await certificateNumber(), attemptId: a._id,
      data: { testName: test?.name, scores: { total: a.scoreEst, sections: Object.fromEntries(a.sectionScores.map((s) => [s.section ?? "", s.scaled ?? null])) }, finishedAt: a.finishedAt },
    });
  } catch { return Certificate.findOne({ attemptId: a._id }); } // balapan: sudah dibuat proses lain
}
