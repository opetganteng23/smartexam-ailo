import { HttpError } from "./rbac";
import { issueOfficialCertificate, itpTotal, validSectionScore } from "./certificates";
import { ExamRegistration, ExamSession } from "@/models/OfficialExam";
import type { Types } from "mongoose";

/** Simpan skor resmi satu peserta, hitung total otomatis, tandai selesai, dan terbitkan sertifikat. */
export async function applyOfficialScore(regId: Types.ObjectId | string, s: { listening: number; structure: number; reading: number }) {
  for (const k of ["listening", "structure", "reading"] as const)
    if (!validSectionScore(s[k])) throw new HttpError(400, `The ${k} score must be a whole number from 31 to 68`);
  const reg = await ExamRegistration.findById(regId);
  if (!reg || reg.status === "cancelled") throw new HttpError(404, "Registration not found");
  const session = await ExamSession.findById(reg.sessionId).lean();
  const total = itpTotal(s.listening, s.structure, s.reading);
  reg.score = { ...s, total };
  reg.status = "done";
  const cert = await issueOfficialCertificate(reg, { ...s, total }, session?.date ?? new Date());
  reg.certificateId = cert._id;
  await reg.save();
  return { total, certificateNumber: cert.number };
}
