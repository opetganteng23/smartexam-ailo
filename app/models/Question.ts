import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

import { SECTIONS, SECTION_KEY_RE, type Section } from "@/lib/exam-format";
import { QUESTION_KINDS } from "@/lib/question-kinds";
import { questionHash } from "@/lib/question-hash";
export { SECTIONS };
export type { Section };

const questionSchema = new Schema(
  {
    section: { type: String, match: SECTION_KEY_RE, required: true, index: true },
    type: { type: String, required: true }, // mis. subject-verb, inference, detail
    groupId: { type: Schema.Types.ObjectId, ref: "QuestionGroup", index: true }, // audio/passage bersama
    stem: { type: String, required: true },
    stemFormat: { type: String, enum: ["text", "html"], default: "text" }, // html: stem sudah disanitasi (lib/question-html.ts)
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "QuestionCollection", index: true },
    contentHash: { type: String, index: true }, // sidik isi untuk deteksi duplikat (lib/question-hash.ts)
    kind: { type: String, enum: QUESTION_KINDS, default: "mcq" }, // soal lama tanpa kind = pilihan ganda
    points: { type: Number, default: 1, min: 0, max: 100 },
    // Pilihan ganda: options + answerKey. Jenis lain: options kosong dan kunci di `key` (lihat lib/question-kinds.ts).
    options: { type: [String], validate: { validator(this: { kind?: string }, v: string[]) { return (this.kind ?? "mcq") !== "mcq" || (v.length >= 2 && v.length <= 6); } } },
    answerKey: { type: Number, required: [function (this: { kind?: string }) { return (this.kind ?? "mcq") === "mcq"; }, "answerKey is required"] }, // indeks pada options
    key: Schema.Types.Mixed,
    explanation: String,
    // Tag DUA TINGKAT wajib (MTS §6): skill (mis. grammar) + topic (mis. subject-verb). Dasar topic_stats & remedial_map.
    tags: [{ _id: false, skill: { type: String, required: true, trim: true }, topic: { type: String, required: true, trim: true } }],
    assetIds: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
    difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
    status: { type: String, enum: ["draft", "review", "published", "archived"], default: "draft", index: true },
    source: { type: String, trim: true, maxlength: 200 }, // sumber dan status izin penggunaan
  },
  { timestamps: true }
);

questionSchema.pre("validate", function () {
  this.contentHash = questionHash({ kind: this.kind, stem: this.stem, options: this.options, answerKey: this.answerKey, key: this.key });
});

// Satu audio/passage dipakai beberapa soal.
const groupSchema = new Schema(
  {
    section: { type: String, match: SECTION_KEY_RE, required: true },
    instruction: String,
    audioId: { type: Schema.Types.ObjectId, ref: "Audio" },
    passageTitle: String,
    passageHtml: String, // sudah disanitasi
    assetIds: [{ type: Schema.Types.ObjectId, ref: "Asset" }],
  },
  { timestamps: true }
);

export type QuestionDoc = InferSchemaType<typeof questionSchema> & { _id: mongoose.Types.ObjectId };
export type GroupDoc = InferSchemaType<typeof groupSchema> & { _id: mongoose.Types.ObjectId };
export const Question: Model<QuestionDoc> =
  (mongoose.models.Question as Model<QuestionDoc>) || mongoose.model<QuestionDoc>("Question", questionSchema);
export const QuestionGroup: Model<GroupDoc> =
  (mongoose.models.QuestionGroup as Model<GroupDoc>) || mongoose.model<GroupDoc>("QuestionGroup", groupSchema);

// Koleksi bank soal: kelompok soal dalam satu kategori (mata pelajaran) dengan pemilik dan visibilitas.
// private: pemilik dan admin; institution: staf institusi itu dan admin; global: semua staf konten.
const collectionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", index: true },
    description: { type: String, trim: true, maxlength: 500 },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    visibility: { type: String, enum: ["private", "institution", "global"], default: "private" },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
  },
  { timestamps: true }
);
export type CollectionDoc = InferSchemaType<typeof collectionSchema> & { _id: mongoose.Types.ObjectId };
export const QuestionCollection: Model<CollectionDoc> =
  (mongoose.models.QuestionCollection as Model<CollectionDoc>) || mongoose.model<CollectionDoc>("QuestionCollection", collectionSchema);

// Jenis soal yang dikelola admin per kategori (section), mis. "Short conversations (Part A)" atau "Inference".
// Soal menyimpan nama jenis di `type`; mengganti nama jenis ikut mengubah soalnya.
const typeSchema = new Schema(
  {
    section: { type: String, match: SECTION_KEY_RE, required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300 },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
typeSchema.index({ section: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });
export type QuestionTypeDoc = InferSchemaType<typeof typeSchema> & { _id: mongoose.Types.ObjectId };
export const QuestionType: Model<QuestionTypeDoc> =
  (mongoose.models.QuestionType as Model<QuestionTypeDoc>) || mongoose.model<QuestionTypeDoc>("QuestionType", typeSchema);
