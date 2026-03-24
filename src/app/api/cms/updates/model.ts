import { Schema, type InferSchemaType, type Model, type Types } from "mongoose";
import { connectDB } from "@/lib/config/db";

const cmsUpdateSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: "" },
    isRolledOut: { type: Boolean, default: false },
    isInBeta: { type: Boolean, default: true },
    status: { type: String, enum: ["draft", "rolled-out"], default: "draft" },
    betaStatus: {
      type: String,
      enum: ["draft", "rolled-out", "rolled-back"],
      default: "draft",
    },
    betaRolledOutAt: { type: Date, default: null },
    liveStatus: {
      type: String,
      enum: ["draft", "rolled-out", "rolled-back"],
      default: "draft",
    },
    liveRolledOutAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "CmsUser" },
  },
  { timestamps: true }
);

export type CmsUpdate = InferSchemaType<typeof cmsUpdateSchema>;

type CmsUpdateDoc = CmsUpdate & {
  _id: Types.ObjectId;
};

type CmsUpdateModel = Model<CmsUpdateDoc>;

export async function getCmsUpdateModel(): Promise<CmsUpdateModel> {
  const db = await connectDB("cms");
  return (db.models.CmsUpdate as CmsUpdateModel) || db.model("CmsUpdate", cmsUpdateSchema);
}
