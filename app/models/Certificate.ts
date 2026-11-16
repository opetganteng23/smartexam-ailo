import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Laporan hasil yang dapat diverifikasi lewat nomor (halaman /verify/[number]).
const certificateSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["sim_report", "course_completion"], required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" }, // sertifikat penyelesaian course umum
    number: { type: String, required: true, unique: true },
    data: Schema.Types.Mixed,
    attemptId: { type: Schema.Types.ObjectId, ref: "Attempt" },
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Satu sertifikat penyelesaian per peserta per course (balapan penerbitan dijaga indeks ini).
certificateSchema.index({ userId: 1, courseId: 1 }, { unique: true, partialFilterExpression: { courseId: { $exists: true } } });

export type CertificateDoc = InferSchemaType<typeof certificateSchema> & { _id: mongoose.Types.ObjectId };
export const Certificate: Model<CertificateDoc> = (mongoose.models.Certificate as Model<CertificateDoc>) || mongoose.model<CertificateDoc>("Certificate", certificateSchema);
