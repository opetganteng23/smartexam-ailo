import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

const sectionTable = { type: Map, of: Number, default: {} }; // raw (teks) -> skala section

// Profil penilaian: aturan konversi skor mentah ke skala section dan total. Tes memilih satu profil;
// tiap percobaan menyimpan profil dan versinya sehingga hasil lama tetap bisa ditelusuri.
const profileSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80, unique: true },
    description: { type: String, trim: true, maxlength: 400 },
    version: { type: Number, default: 1 }, // naik setiap aturan konversi diubah
    mode: { type: String, enum: ["linear", "table"], default: "linear" },
    scale: { type: String, enum: ["itp", "percent"], default: "itp" }, // itp: 31-68 per bagian, 310-677 total. percent: 0-100
    passMark: { type: Number, min: 0, max: 1000 }, // skor total minimum untuk lulus (opsional)
    scaledMin: { type: Number, default: 31 },
    scaledMax: { type: Number, default: 68 },
    tables: { type: Map, of: sectionTable, default: {} },
    // Verifikasi: tabel diakui sesuai sumber yang sah dan versi tes yang disimulasikan. Tanpa ini skor berlabel estimasi.
    verified: { type: Boolean, default: false },
    source: { type: String, trim: true, maxlength: 300 },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

export type ScoringProfileDoc = InferSchemaType<typeof profileSchema> & { _id: mongoose.Types.ObjectId };
export const ScoringProfile: Model<ScoringProfileDoc> =
  (mongoose.models.ScoringProfile as Model<ScoringProfileDoc>) || mongoose.model<ScoringProfileDoc>("ScoringProfile", profileSchema);
