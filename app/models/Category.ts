import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Kategori = mata pelajaran atau mata kuliah (mis. Struktur Data). Dipakai course, koleksi bank soal, dan tes umum.
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true }, // nama huruf kecil: mencegah kategori kembar
    description: String,
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type CategoryDoc = InferSchemaType<typeof categorySchema> & { _id: mongoose.Types.ObjectId };
export const Category: Model<CategoryDoc> = (mongoose.models.Category as Model<CategoryDoc>) || mongoose.model<CategoryDoc>("Category", categorySchema);
