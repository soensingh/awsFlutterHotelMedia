import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

// ── BlockedUser model ─────────────────────────────────────────────────────────

const blockedUserSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    blockedUserID: { type: Schema.Types.ObjectId, required: true },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "blockedusers" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBlockedUserModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (
    (db.models.BlockedUser as Model<any>) ||
    db.model("BlockedUser", blockedUserSchema)
  );
}

// ── User model (for profile lookup) ──────────────────────────────────────────

const userSchema = new Schema(
  {
    fullname: String,
    profilePicture: String,
  },
  { strict: false, collection: "users" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getUserModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (
    (db.models.User as Model<any>) || db.model("User", userSchema)
  );
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    return (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? null;
  } catch {
    return null;
  }
}

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── GET /api/mobile/blockedusers ──────────────────────────────────────────────
// Response: { blockedUsers: [{ id, blockedUserId, name, picUrl, blockedAt }] }

export async function GET(req: Request) {
  const userId = verifyToken(req);
  if (!userId) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return corsJson(req, { error: "Invalid userId" }, { status: 400 });
  }

  const myId = new mongoose.Types.ObjectId(userId);

  const BlockedUser = await getBlockedUserModel();
  const User = await getUserModel();

  const docs = await BlockedUser.find({ userID: myId })
    .sort({ _id: -1 })
    .lean<{ _id: mongoose.Types.ObjectId; blockedUserID: mongoose.Types.ObjectId; createdAt: Date }[]>();

  if (docs.length === 0) {
    return corsJson(req, { blockedUsers: [] });
  }

  const blockedIds = docs.map((d) => d.blockedUserID);

  const profiles = await User.find({ _id: { $in: blockedIds } })
    .select("_id fullname profilePicture")
    .lean<{ _id: mongoose.Types.ObjectId; fullname?: string; profilePicture?: string }[]>();

  const profileMap = new Map(profiles.map((p) => [p._id.toString(), p]));

  const blockedUsers = docs.map((doc) => {
    const profile = profileMap.get(doc.blockedUserID.toString());
    return {
      id: doc._id.toString(),
      blockedUserId: doc.blockedUserID.toString(),
      name: profile?.fullname ?? "Unknown User",
      picUrl: profile?.profilePicture ?? null,
      blockedAt: doc.createdAt,
    };
  });

  return corsJson(req, { blockedUsers });
}

// ── DELETE /api/mobile/blockedusers ───────────────────────────────────────────
// Body:     { blockedUserId: string }
// Response: { unblocked: true }

export async function DELETE(req: Request) {
  const userId = verifyToken(req);
  if (!userId) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let blockedUserId: string;
  try {
    const body = await req.json() as { blockedUserId?: unknown };
    blockedUserId = body?.blockedUserId?.toString() ?? "";
    if (!blockedUserId) throw new Error("missing blockedUserId");
  } catch {
    return corsJson(req, { error: "blockedUserId is required" }, { status: 400 });
  }

  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(blockedUserId)
  ) {
    return corsJson(req, { error: "Invalid id" }, { status: 400 });
  }

  const myId = new mongoose.Types.ObjectId(userId);
  const blockedObjId = new mongoose.Types.ObjectId(blockedUserId);

  const BlockedUser = await getBlockedUserModel();
  await BlockedUser.deleteOne({ userID: myId, blockedUserID: blockedObjId });

  return corsJson(req, { unblocked: true });
}
