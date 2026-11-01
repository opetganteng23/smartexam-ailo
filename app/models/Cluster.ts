import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Kelas: satu kelompok kemampuan (level) bisa punya beberapa kelas berkapasitas dan ber-coach.
const classSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    levelId: { type: Schema.Types.ObjectId, ref: "Level", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true }, // kosong = lintas institusi
    programCycleId: { type: Schema.Types.ObjectId, ref: "ProgramCycle", index: true }, // kosong = tanpa periode
    capacity: { type: Number, required: true, min: 1 },
    coachId: { type: Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Keanggotaan kelas. Satu peserta hanya di satu kelas aktif; riwayat pindah tetap tersimpan (active=false).
const memberSchema = new Schema(
  {
    classId: { type: Schema.Types.ObjectId, ref: "ClassGroup", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["auto", "manual"], required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
    active: { type: Boolean, default: true },
    leftAt: Date,
  },
  { timestamps: true }
);
// Nama eksplisit: di produksi sudah ada indeks biasa bernama userId_1, sehingga indeks unik parsial dengan nama bawaan tidak pernah terbentuk.
memberSchema.index({ userId: 1 }, { name: "userId_one_active", unique: true, partialFilterExpression: { active: true } });

export type ClassDoc = InferSchemaType<typeof classSchema> & { _id: mongoose.Types.ObjectId };
export const ClassGroup: Model<ClassDoc> = (mongoose.models.ClassGroup as Model<ClassDoc>) || mongoose.model<ClassDoc>("ClassGroup", classSchema);
export const ClassMember = (mongoose.models.ClassMember as Model<InferSchemaType<typeof memberSchema>>) || mongoose.model("ClassMember", memberSchema);
