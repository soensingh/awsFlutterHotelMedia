import { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";

const notificationSchema = new Schema(
  {
    userID:       { type: Schema.Types.ObjectId, required: true },
    targetUserID: { type: Schema.Types.ObjectId, default: null },
    title:        { type: String, default: "" },
    description:  { type: String, default: "" },
    type:         { type: String, default: "" },
    metadata:     { type: Schema.Types.Mixed, default: {} },
    isSeen:       { type: Boolean, default: false },
    isDeleted:    { type: Boolean, default: false },
  },
  { timestamps: true, collection: "notifications" }
);

export type NotificationDoc = {
  _id: unknown;
  userID: unknown;
  targetUserID: unknown;
  title: string;
  description: string;
  type: string;
  metadata: Record<string, unknown>;
  isSeen: boolean;
  isDeleted: boolean;
  createdAt?: Date;
};

type NotificationModel = Model<NotificationDoc>;

export async function getNotificationModel(): Promise<NotificationModel> {
  const db = await connectDB("main");
  return (db.models.Notification as NotificationModel) ||
    db.model("Notification", notificationSchema);
}
