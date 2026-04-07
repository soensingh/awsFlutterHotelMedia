import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

// ── Like model (inline — mirrors the likes collection) ───────────────────────

const likeSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    postID: { type: Schema.Types.ObjectId, required: true },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "likes" }
);

async function getLikeModel(): Promise<Model<typeof likeSchema extends Schema<infer T> ? T : never>> {
  const db = await connectDB("main");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.models.Like as any) || db.model("Like", likeSchema);
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
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

// ── POST /api/mobile/likes  — toggle like on a post ───────────────────────────
// Body: { postId: string }
// Response: { liked: boolean, likesCount: number }

export async function POST(req: Request) {
  const userId = verifyToken(req);
  if (!userId) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let postId: string;
  try {
    const body = await req.json();
    postId = body?.postId?.toString();
    if (!postId) throw new Error("missing postId");
  } catch {
    return corsJson(req, { error: "postId is required" }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(postId) || !mongoose.Types.ObjectId.isValid(userId)) {
    return corsJson(req, { error: "Invalid id" }, { status: 400 });
  }

  const Like = await getLikeModel();

  const userObjId = new mongoose.Types.ObjectId(userId);
  const postObjId = new mongoose.Types.ObjectId(postId);

  const existing = await (Like as any).findOne({ userID: userObjId, postID: postObjId });

  if (existing) {
    // Unlike
    await (Like as any).deleteOne({ _id: existing._id });
  } else {
    // Like
    await (Like as any).create({ userID: userObjId, postID: postObjId });
  }

  const likesCount = await (Like as any).countDocuments({ postID: postObjId });

  return corsJson(req, { liked: !existing, likesCount });
}
