import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

// ── Comment model ─────────────────────────────────────────────────────────────

const commentSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    postID: { type: Schema.Types.ObjectId, required: true },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
    message: { type: String, required: true },
    isParent: { type: Boolean, default: true },
    isPublished: { type: Boolean, default: true },
    parentID: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "comments" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCommentModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (db.models.Comment as any) || db.model("Comment", commentSchema);
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyToken(req: Request): { userId: string } | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    const userId = (decoded.sub ?? decoded.id ?? decoded.userId)?.toString();
    if (!userId) return null;
    return { userId };
  } catch {
    return null;
  }
}

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── GET /api/mobile/comments?postId=xxx ───────────────────────────────────────
// Returns top-level comments with author info and replies nested under each.

export async function GET(req: Request) {
  const auth = verifyToken(req);
  if (!auth) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const postId = url.searchParams.get("postId");
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return corsJson(req, { error: "postId is required" }, { status: 400 });
  }

  const Comment = await getCommentModel();
  const postObjId = new mongoose.Types.ObjectId(postId);

  // Fetch all published comments for this post in one query, then nest in JS
  const rawComments = await Comment.aggregate([
    { $match: { postID: postObjId, isPublished: true } },
    { $sort: { createdAt: 1 } },
    {
      $lookup: {
        from: "users",
        localField: "userID",
        foreignField: "_id",
        as: "authorData",
        pipeline: [{ $project: { name: 1, username: 1, profilePic: 1 } }],
      },
    },
    {
      $project: {
        _id: 1,
        message: 1,
        isParent: 1,
        parentID: 1,
        createdAt: 1,
        author: { $arrayElemAt: ["$authorData", 0] },
      },
    },
  ]);

  // Stringify ObjectIds
  const flat = rawComments.map((c: Record<string, unknown>) => ({
    ...c,
    _id: (c._id as mongoose.Types.ObjectId)?.toString(),
    isParent: c.isParent as boolean | undefined,
    parentID: c.parentID ? (c.parentID as mongoose.Types.ObjectId).toString() : null,
    author: c.author
      ? {
          ...(c.author as Record<string, unknown>),
          _id: ((c.author as Record<string, unknown>)._id as mongoose.Types.ObjectId)?.toString(),
        }
      : null,
  }));

  // Nest replies under parents
  type CommentNode = (typeof flat)[number] & { replies: typeof flat };
  const map = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const c of flat) {
    map.set(c._id as string, { ...c, replies: [] } as CommentNode);
  }
  for (const c of map.values()) {
    if (c.isParent || !c.parentID) {
      roots.push(c);
    } else {
      const parent = map.get(c.parentID as string);
      if (parent) parent.replies.push(c);
      else roots.push(c); // orphan — show at root
    }
  }

  return corsJson(req, { comments: roots });
}

// ── POST /api/mobile/comments ─────────────────────────────────────────────────
// Body: { postId, message, parentId? }
// Returns the new comment with author info.

export async function POST(req: Request) {
  const auth = verifyToken(req);
  if (!auth) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let postId: string, message: string, parentId: string | undefined;
  try {
    const body = await req.json();
    postId = body?.postId?.toString();
    message = body?.message?.toString()?.trim();
    parentId = body?.parentId?.toString() || undefined;
    if (!postId || !message) throw new Error("missing fields");
  } catch {
    return corsJson(req, { error: "postId and message are required" }, { status: 400 });
  }

  if (!mongoose.Types.ObjectId.isValid(postId)) {
    return corsJson(req, { error: "Invalid postId" }, { status: 400 });
  }
  if (parentId && !mongoose.Types.ObjectId.isValid(parentId)) {
    return corsJson(req, { error: "Invalid parentId" }, { status: 400 });
  }

  const Comment = await getCommentModel();

  const doc = await Comment.create({
    userID: new mongoose.Types.ObjectId(auth.userId),
    postID: new mongoose.Types.ObjectId(postId),
    message,
    isParent: !parentId,
    parentID: parentId ? new mongoose.Types.ObjectId(parentId) : null,
  });

  // Count updated total
  const commentsCount = await Comment.countDocuments({
    postID: new mongoose.Types.ObjectId(postId),
    isPublished: true,
  });

  return corsJson(req, {
    comment: {
      _id: doc._id.toString(),
      message: doc.message,
      isParent: doc.isParent,
      parentID: doc.parentID?.toString() ?? null,
      createdAt: doc.createdAt,
    },
    commentsCount,
  });
}
