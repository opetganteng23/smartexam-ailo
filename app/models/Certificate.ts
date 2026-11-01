import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Laporan hasil yang dapat diverifikasi lewat nomor (halaman /verify/[number]).
const certificateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["sim_report"], required: true },
    number: { type: String, required: true, unique: true },
    data: Schema.Types.Mixed,
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export type CertificateDoc = InferSchemaType<typeof certificateSchema> & { _id: mongoose.Types.ObjectId };
export const Certificate: Model<CertificateDoc> = (mongoose.models.Certificate as Model<CertificateDoc>) || mongoose.model<CertificateDoc>("Certificate", certificateSchema);
