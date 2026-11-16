import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Diskusi per unit (lesson). Teks polos (tag dibuang saat simpan); dibatasi pada institusi penulis supaya peserta dari institusi
// lain tidak saling melihat. Moderasi: disembunyikan oleh admin, atau dilaporkan peserta.
const commentSchema = new Schema(
  {
    unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: "Institution", index: true },
    staff: { type: Boolean, default: false }, // ditulis moderator: terlihat semua peserta unit itu
    parentId: { type: Schema.Types.ObjectId, ref: "Comment", index: true }, // satu tingkat balasan
    body: { type: String, required: true, maxlength: 2000 },
    hidden: { type: Boolean, default: false },
    hiddenBy: { type: Schema.Types.ObjectId, ref: "User" },
    hiddenReason: { type: String, maxlength: 200 },
    reports: [{ _id: false, userId: { type: Schema.Types.ObjectId, ref: "User" }, at: Date }],
  },
  { timestamps: true }
);
commentSchema.index({ unitId: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof commentSchema> & { _id: mongoose.Types.ObjectId };
export const Comment: Model<CommentDoc> = (mongoose.models.Comment as Model<CommentDoc>) || mongoose.model<CommentDoc>("Comment", commentSchema);
