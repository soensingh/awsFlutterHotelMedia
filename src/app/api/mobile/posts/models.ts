import { Schema, type InferSchemaType, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";

// ── Media ──────────────────────────────────────────────────────────────────

const mediaSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, default: null },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
    fileName: { type: String, default: "" },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    fileSize: { type: Number, default: 0 },
    mediaType: { type: String, default: "image" }, // "image" | "video"
    mimeType: { type: String, default: "" },
    sourceUrl: { type: String, default: "" },
    thumbnailUrl: { type: String, default: "" },
    s3Key: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    videoUrl: { type: String, default: "" },
    hlsUrl: { type: String, default: "" },
  },
  { timestamps: true, collection: "media" }
);

export type MediaDoc = InferSchemaType<typeof mediaSchema>;
type MediaModel = Model<MediaDoc>;

export async function getMediaModel(): Promise<MediaModel> {
  const db = await connectDB("main");
  return (db.models.Media as MediaModel) || db.model("Media", mediaSchema);
}

// ── Post ───────────────────────────────────────────────────────────────────

const postSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    postType: { type: String, default: "post" },
    content: { type: String, default: "" },
    feelings: { type: String, default: "" },
    media: [{ type: Schema.Types.ObjectId }],
    tagged: [{ type: Schema.Types.ObjectId }],
    reviews: { type: Schema.Types.Mixed, default: [] },
    location: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 },
      placeName: { type: String, default: "" },
    },
    geoCoordinate: { type: Schema.Types.Mixed, default: null },
    isPublished: { type: Boolean, default: true },
    isDeleted:   { type: Boolean, default: false },
    views:    { type: Number, default: 0 },
    likes:    { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    // Mentions: [{ userId: ObjectId, username: String }]
    mentions: {
      type: [{ userId: Schema.Types.ObjectId, username: String }],
      default: [],
    },
    // Intent tags (custom operator ⊕) – array of tag strings
    intents: { type: [String], default: [] },
    // Video metadata
    muted:      { type: Boolean, default: false },
    trimStart:  { type: Number, default: null },
    trimEnd:    { type: Number, default: null },
    filterMatrix: { type: [Number], default: null },
  },
  { timestamps: true, collection: "posts" }
);

export type PostDoc = InferSchemaType<typeof postSchema>;
type PostModel = Model<PostDoc>;

export async function getPostModel(): Promise<PostModel> {
  const db = await connectDB("main");
  return (db.models.Post as PostModel) || db.model("Post", postSchema);
}
