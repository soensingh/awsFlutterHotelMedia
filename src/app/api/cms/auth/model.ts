import bcrypt from "bcrypt";
import { Schema, type Model, type InferSchemaType } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { env } from "@/lib/config/env";

const cmsUserSchema = new Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    dialCode: { type: String, trim: true, default: "" },
    phoneNumber: { type: String, trim: true, default: "" },
    password: { type: String, required: true },
    lastOnline: { type: Date, default: null },
    isOnline: { type: Boolean, default: false },
    isSuspended: { type: Boolean, default: false },
    role: { type: String, enum: ["admin", "editor"], default: "editor" },
  },
  { timestamps: true }
);

export type CmsUser = InferSchemaType<typeof cmsUserSchema>;

type CmsUserDoc = CmsUser & {
  comparePassword: (plain: string) => Promise<boolean>;
};

type CmsUserModel = Model<CmsUserDoc> & {
  hashPassword: (plain: string) => Promise<string>;
  validatePassword: (plain: string) => boolean;
  validateEmail: (email: string) => boolean;
};

cmsUserSchema.methods.comparePassword = function (plain: string) {
  return bcrypt.compare(plain, this.password);
};

cmsUserSchema.statics.hashPassword = function (plain: string) {
  const rounds = Number(env.BCRYPT_SALT_ROUNDS ?? 12);
  return bcrypt.hash(plain, rounds);
};

cmsUserSchema.statics.validatePassword = function (plain: string) {
  return typeof plain === "string" && plain.length >= 8;
};

cmsUserSchema.statics.validateEmail = function (email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function getCmsUserModel(): Promise<CmsUserModel> {
  const db = await connectDB("cms");
  return (db.models.CmsUser as CmsUserModel) || db.model("CmsUser", cmsUserSchema);
}