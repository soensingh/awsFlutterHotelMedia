import bcrypt from "bcrypt";
import { Schema, type InferSchemaType, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { env } from "@/lib/config/env";

const mobileUserSchema = new Schema(
  {
    name: { type: String, trim: true, default: "" },
    username: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    dialCode: { type: String, trim: true, default: "" },
    phoneNumber: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "" },
    billingAddress: { type: String, trim: true, default: "" },
    profession: { type: String, trim: true, default: "" },
    lastEmailChange: { type: Date, default: null },
    lastPhoneChange: { type: Date, default: null },
    accountType: { type: String, default: "individual" },
    language: { type: String, default: "en" },
    profilePic: {
      small: { type: String, default: "" },
      medium: { type: String, default: "" },
      large: { type: String, default: "" },
    },
    hasProfilePicture: { type: Boolean, default: false },
    privateAccount: { type: Boolean, default: false },
    notificationEnabled: { type: Boolean, default: true },
    acceptedTerms: { type: Boolean, default: false },
    socialIDs: { type: [Schema.Types.Mixed], default: [] },
    geoCoordinate: { type: Schema.Types.Mixed, default: null },
    otp: { type: Number, default: null },
    otpExpiresAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
    isActivated: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    mobileVerified: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    sessionTokenId: { type: String, default: null },
    isOnline: { type: Boolean, default: false },
    onlineUntil: { type: Date, default: null },
  },
  { timestamps: true, collection: "users" }
);

export type MobileUser = InferSchemaType<typeof mobileUserSchema>;

type MobileUserDoc = MobileUser & {
  comparePassword: (plain: string) => Promise<boolean>;
};

type MobileUserModel = Model<MobileUserDoc> & {
  hashPassword: (plain: string) => Promise<string>;
  validatePassword: (plain: string) => boolean;
  validateEmail: (email: string) => boolean;
};

mobileUserSchema.methods.comparePassword = function (plain: string) {
  return bcrypt.compare(plain, this.password);
};

mobileUserSchema.statics.hashPassword = function (plain: string) {
  const rounds = Number(env.BCRYPT_SALT_ROUNDS ?? 12);
  return bcrypt.hash(plain, rounds);
};

mobileUserSchema.statics.validatePassword = function (plain: string) {
  return typeof plain === "string" && plain.length >= 8;
};

mobileUserSchema.statics.validateEmail = function (email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export async function getMobileUserModel(): Promise<MobileUserModel> {
  const db = await connectDB("main");
  return (db.models.MobileUser as MobileUserModel) || db.model("MobileUser", mobileUserSchema);
}