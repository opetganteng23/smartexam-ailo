import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Tugas di dalam course umum. kind "file": peserta mengumpulkan berkas dan/atau teks, dinilai manual. kind "test": tugas berbasis soal;
// menautkan ke tes umum yang sudah ada (dikerjakan di sana, skornya ditampilkan di tugas).
const assignmentSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    unitId: { type: Schema.Types.ObjectId, ref: "Unit" },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    instructions: { type: String, trim: true, maxlength: 3000 },
    kind: { type: String, enum: ["file", "test"], default: "file" },
    testId: { type: Schema.Types.ObjectId, ref: "Test" }, // kind "test"
    dueAt: Date, // tenggat; kosong = tanpa tenggat
    allowLate: { type: Boolean, default: false }, // boleh mengumpulkan setelah tenggat (ditandai terlambat)
    maxSubmissions: { type: Number, default: 1, min: 0, max: 20 }, // 0 = tanpa batas
    maxPoints: { type: Number, default: 100, min: 1, max: 1000 },
    active: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const submissionSchema = new Schema(
  {
    assignmentId: { type: Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    attemptNo: { type: Number, required: true },
    text: { type: String, maxlength: 5000 },
    file: { _id: false, gridFsId: Schema.Types.ObjectId, name: String, size: Number, mime: String }, // GridFS bucket `assignments`
    late: { type: Boolean, default: false },
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    points: Number,
    feedback: { type: String, maxlength: 2000 },
    gradedBy: { type: Schema.Types.ObjectId, ref: "User" },
    gradedAt: Date,
  },
  { timestamps: true }
);
submissionSchema.index({ assignmentId: 1, userId: 1, attemptNo: 1 }, { unique: true }); // dua kiriman bersamaan tidak mendapat nomor yang sama

export type AssignmentDoc = InferSchemaType<typeof assignmentSchema> & { _id: mongoose.Types.ObjectId };
export type SubmissionDoc = InferSchemaType<typeof submissionSchema> & { _id: mongoose.Types.ObjectId };
export const Assignment: Model<AssignmentDoc> = (mongoose.models.Assignment as Model<AssignmentDoc>) || mongoose.model<AssignmentDoc>("Assignment", assignmentSchema);
export const Submission: Model<SubmissionDoc> = (mongoose.models.Submission as Model<SubmissionDoc>) || mongoose.model<SubmissionDoc>("Submission", submissionSchema);
