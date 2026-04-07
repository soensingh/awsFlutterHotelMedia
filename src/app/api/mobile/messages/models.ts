import { Schema, type InferSchemaType, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";

const messageSchema = new Schema(
  {
    message:        { type: String, default: "" },
    isSeen:         { type: Boolean, default: false },
    deletedByID:    [{ type: Schema.Types.ObjectId }],
    userID:         { type: Schema.Types.ObjectId, required: true },
    targetUserID:   { type: Schema.Types.ObjectId, required: true },
    type:           { type: String, default: "text" },
    // Extended fields
    isEdited:       { type: Boolean, default: false },
    isDeleted:      { type: Boolean, default: false },   // deleted for everyone
    starredBy:      [{ type: Schema.Types.ObjectId }],   // users who starred this
    pinnedBy:       [{ type: Schema.Types.ObjectId }],   // users who pinned this
    replyToId:      { type: Schema.Types.ObjectId, default: null }, // message being replied to
    forwardedFromId:{ type: Schema.Types.ObjectId, default: null }, // original message id
  },
  { timestamps: true, collection: "messages" }
);

export type MessageDoc = InferSchemaType<typeof messageSchema>;
type MessageModelType = Model<MessageDoc>;

export async function getMessageModel(): Promise<MessageModelType> {
  const db = await connectDB("main");
  return (db.models.Message as MessageModelType) || db.model("Message", messageSchema);
}
