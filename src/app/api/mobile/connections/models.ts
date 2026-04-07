import { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";

const userConnectionSchema = new Schema(
  {
    follower:  { type: Schema.Types.ObjectId, required: true },
    following: { type: Schema.Types.ObjectId, required: true },
    status:    { type: String, default: "pending" },
  },
  { timestamps: true, collection: "userconnections" }
);

export type ConnectionDoc = {
  _id: unknown;
  follower: unknown;
  following: unknown;
  status: string;
};

type ConnectionModel = Model<ConnectionDoc>;

export async function getUserConnectionModel(): Promise<ConnectionModel> {
  const db = await connectDB("main");
  return (db.models.UserConnection as ConnectionModel) ||
    db.model("UserConnection", userConnectionSchema);
}
