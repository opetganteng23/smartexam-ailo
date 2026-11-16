import mongoose, { Schema, InferSchemaType, Model } from "mongoose";

// Perpustakaan video: embed YouTube/Vimeo (hanya penunjuk) atau klip MP4 pendek yang diunggah (biner di GridFS bucket `video`).
const videoSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    kind: { type: String, enum: ["upload", "embed"], required: true, index: true },
    provider: { type: String, enum: ["youtube", "vimeo"] }, // embed
    externalId: { type: String, maxlength: 40 }, // embed: id video di penyedia
    gridFsId: { type: Schema.Types.ObjectId }, // upload
    mime: { type: String, default: "video/mp4" },
    size: Number,
    sha256: String,
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

export type VideoDoc = InferSchemaType<typeof videoSchema> & { _id: mongoose.Types.ObjectId };
export const Video: Model<VideoDoc> = (mongoose.models.Video as Model<VideoDoc>) || mongoose.model<VideoDoc>("Video", videoSchema);
