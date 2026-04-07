import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";
import { getPostModel } from "../posts/models";

export const runtime = "nodejs";

// ── PostView model (tracks which users have viewed which posts) ───────────────

const postViewSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    postID: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collection: "postViews" }
);

// Compound unique index — one view record per user per post
postViewSchema.index({ userID: 1, postID: 1 }, { unique: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getPostViewModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (db.models.PostView as any) || db.model("PostView", postViewSchema);
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

// ── POST /api/mobile/views  — record a post view (deduped per user) ───────────
// Body:     { postId: string }
// Response: { views: number, counted: boolean }
//   counted=true  → first time this user viewed this post (view was incremented)
//   counted=false → user already viewed this post (no change)

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

  if (
    !mongoose.Types.ObjectId.isValid(postId) ||
    !mongoose.Types.ObjectId.isValid(userId)
  ) {
    return corsJson(req, { error: "Invalid id" }, { status: 400 });
  }

  const [PostView, Post] = await Promise.all([
    getPostViewModel(),
    getPostModel(),
  ]);

  const userObjId = new mongoose.Types.ObjectId(userId);
  const postObjId = new mongoose.Types.ObjectId(postId);

  // Check if this user has already viewed this post
  const alreadyViewed = await PostView.findOne({
    userID: userObjId,
    postID: postObjId,
  }).lean();

  if (alreadyViewed) {
    // Don't increment — just return the current count
    const post = await Post.findById(postObjId).select("views").lean();
    return corsJson(req, {
      views: (post as { views?: number } | null)?.views ?? 0,
      counted: false,
    });
  }

  // First view — record it and atomically increment post.views
  await PostView.create({ userID: userObjId, postID: postObjId });

  const updated = await Post.findByIdAndUpdate(
    postObjId,
    { $inc: { views: 1 } },
    { new: true }
  )
    .select("views")
    .lean();

  return corsJson(req, {
    views: (updated as { views?: number } | null)?.views ?? 0,
    counted: true,
  });
}
