import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "./question-html";

// Impor bank soal Moodle XML. Bagian murni (tanpa database): membaca XML, memetakan jenis yang didukung ke bentuk soal
// Smartexam, dan melaporkan yang dilewati. Tidak mengeksekusi apa pun; DOCTYPE dan entity ditolak (XXE, billion laughs).
export const MOODLE_MAX_BYTES = 10 * 1024 * 1024;
export const MOODLE_MAX_QUESTIONS = 500;
export const FILE_REF = "@@PLUGINFILE@@/";

export class MoodleError extends Error {}

export type MoodleFile = { name: string; base64: string };
export type MoodleItem = {
  index: number; name: string; kind: "mcq" | "matching" | "short" | "essay";
  stem: string; stemIsHtml: boolean; points: number; options: string[]; answerKey?: number; key?: unknown;
  explanation?: string; tags: string[]; files: MoodleFile[];
};
export type MoodleSkip = { index: number; name: string; type: string; reason: string };

type Node = Record<string, unknown>;
const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const txt = (n: unknown): string => {
  if (n == null) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  const t = (n as Node).text;
  return t == null ? "" : String(typeof t === "object" ? (t as Node)["#text"] ?? "" : t);
};
const attr = (n: unknown, k: string) => (n && typeof n === "object" ? (n as Node)[`@_${k}`] : undefined);

/** Isi XML ke daftar soal. Melempar MoodleError untuk berkas yang tidak sah secara keseluruhan. */
export function parseMoodleXml(xml: string): { items: MoodleItem[]; skipped: MoodleSkip[]; total: number } {
  if (Buffer.byteLength(xml) > MOODLE_MAX_BYTES) throw new MoodleError("The file is larger than 10 MB");
  const clean = xml.replace(/^﻿/, "");
  if (/<!DOCTYPE|<!ENTITY/i.test(clean)) throw new MoodleError("DOCTYPE and entity declarations are not allowed in the XML");
  let doc: Node;
  try {
    doc = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true }).parse(clean) as Node;
  } catch {
    throw new MoodleError("The file is not valid XML");
  }
  const quiz = doc?.quiz as Node | string | undefined;
  if (quiz === undefined) throw new MoodleError("This is not a Moodle XML question file (missing <quiz>)");
  if (typeof quiz !== "object") throw new MoodleError("No questions found in the file");
  const qs = arr(quiz.question as Node | Node[] | undefined).filter((q) => attr(q, "type") !== "category");
  if (qs.length === 0) throw new MoodleError("No questions found in the file");
  if (qs.length > MOODLE_MAX_QUESTIONS) throw new MoodleError(`Maximum ${MOODLE_MAX_QUESTIONS} questions per import`);

  const items: MoodleItem[] = [], skipped: MoodleSkip[] = [];
  qs.forEach((q, i) => {
    const index = i + 1, type = String(attr(q, "type") ?? "?"), name = txt(q.name).trim() || `#${index}`;
    const skip = (reason: string) => skipped.push({ index, name, type, reason });
    const qt = q.questiontext as Node | undefined;
    const rawStem = txt(qt).trim();
    if (!rawStem) return skip("The question text is empty");
    const isHtml = (attr(qt, "format") ?? "html") === "html";
    const files = arr(qt?.file as Node | Node[] | undefined).map((f) => ({ name: String(attr(f, "name") ?? ""), base64: String((f as Node)["#text"] ?? "").replace(/\s+/g, "") })).filter((f) => f.name && f.base64);
    const base = {
      index, name, stem: rawStem, stemIsHtml: isHtml, files,
      explanation: htmlToText(txt(q.generalfeedback)) || undefined,
      tags: arr((q.tags as Node | undefined)?.tag as unknown).map((t) => txt(t).trim()).filter(Boolean),
    };
    const grade = Number.parseFloat(String(q.defaultgrade ?? "1"));
    const points = Number.isFinite(grade) && grade > 0 ? Math.min(100, Math.round(grade * 100) / 100) : 1;
    const answers = arr(q.answer as Node | Node[] | undefined).map((a) => ({ fraction: Number.parseFloat(String(attr(a, "fraction") ?? "0")), text: txt(a) }));

    if (type === "multichoice") {
      if (String(q.single ?? "true").toLowerCase() === "false") return skip("Multiple correct answers (single=false) are not supported");
      const full = answers.map((a, k) => (a.fraction === 100 ? k : -1)).filter((k) => k >= 0);
      if (full.length !== 1) return skip("There must be exactly one fully correct option");
      if (answers.length < 2 || answers.length > 6) return skip("Multiple choice needs 2 to 6 options");
      const options = answers.map((a) => htmlToText(a.text));
      if (options.some((o) => !o)) return skip("An option is empty");
      return void items.push({ ...base, kind: "mcq", points, options, answerKey: full[0] });
    }
    if (type === "truefalse") {
      const options = answers.map((a) => htmlToText(a.text));
      const k = answers.findIndex((a) => a.fraction === 100);
      if (answers.length !== 2 || k < 0 || options.some((o) => !o)) return skip("A true/false question needs two answers and one correct");
      return void items.push({ ...base, kind: "mcq", points, options, answerKey: k });
    }
    if (type === "shortanswer") {
      const accepted = answers.filter((a) => a.fraction === 100).map((a) => htmlToText(a.text)).filter(Boolean);
      if (!accepted.length) return skip("No fully correct accepted answer");
      return void items.push({ ...base, kind: "short", points, options: [], key: { accepted, caseSensitive: String(q.usecase ?? "0") === "1" } });
    }
    if (type === "matching") {
      const pairs = arr(q.subquestion as Node | Node[] | undefined).map((s) => ({ left: htmlToText(txt(s)), right: htmlToText(txt((s as Node).answer)) })).filter((p) => p.left && p.right);
      if (pairs.length < 2 || pairs.length > 12) return skip("Matching needs 2 to 12 complete pairs");
      if (new Set(pairs.map((p) => p.right.toLowerCase())).size !== pairs.length) return skip("Right-hand items must all be different");
      return void items.push({ ...base, kind: "matching", points, options: [], key: { pairs, partial: true } });
    }
    if (type === "essay") {
      const guide = htmlToText(txt(q.graderinfo)) || undefined;
      return void items.push({ ...base, kind: "essay", points, options: [], key: { rubric: [{ criterion: "Answer quality", points }], guide } });
    }
    skip(`Question type "${type}" is not supported`);
  });
  return { items, skipped, total: qs.length };
}
