import { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";

// Stories expire after 24 hours.
const storySchema = new Schema(
  {
    userID:    { type: Schema.Types.ObjectId, required: true },
    mediaUrl:  { type: String, required: true },          // CDN / S3 public URL
    mediaType: { type: String, default: "image" },        // "image" | "video"
    thumbnail: { type: String, default: "" },             // video poster frame
    caption:   { type: String, default: "" },
    viewedBy:  { type: [Schema.Types.ObjectId], default: [] },
    expiresAt: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
    // Mentions: [{ userId: ObjectId, username: String }]
    mentions: {
      type: [{ userId: Schema.Types.ObjectId, username: String }],
      default: [],
    },
  },
  { timestamps: true, collection: "stories" }
);

// TTL index – MongoDB auto-deletes documents after expiresAt
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type StoryDoc = {
  _id: unknown;
  userID: unknown;
  mediaUrl: string;
  mediaType: string;
  thumbnail: string;
  caption: string;
  viewedBy: unknown[];
  expiresAt: Date;
  isDeleted: boolean;
  createdAt: Date;
  mentions: { userId: unknown; username: string }[];
};

type StoryModel = Model<StoryDoc>;

export async function getStoryModel(): Promise<StoryModel> {
  const db = await connectDB("main");
  return (db.models.Story as StoryModel) || db.model("Story", storySchema);
}
