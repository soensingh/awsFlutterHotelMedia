import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";
import { getPostModel } from "../posts/models";

export const runtime = "nodejs";

// ── SavedPost model ───────────────────────────────────────────────────────────

const savedPostSchema = new Schema(
  {
    userID: { type: Schema.Types.ObjectId, required: true },
    postID: { type: Schema.Types.ObjectId, required: true },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "savedposts" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getSavedPostModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (db.models.SavedPost as any) || db.model("SavedPost", savedPostSchema);
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

// ── POST /api/mobile/savedposts  — toggle save on a post ─────────────────────
// Body:     { postId: string }
// Response: { saved: boolean }

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

  const SavedPost = await getSavedPostModel();

  const userObjId = new mongoose.Types.ObjectId(userId);
  const postObjId = new mongoose.Types.ObjectId(postId);

  const existing = await SavedPost.findOne({ userID: userObjId, postID: postObjId });

  if (existing) {
    // Unsave
    await SavedPost.deleteOne({ _id: existing._id });
    return corsJson(req, { saved: false });
  }

  // Save
  await SavedPost.create({ userID: userObjId, postID: postObjId });
  return corsJson(req, { saved: true });
}

// ── GET /api/mobile/savedposts  — list saved posts for the user ───────────────
// Query:    ?limit=12&cursor=<lastPostId>
// Response: { posts: [...], hasMore: boolean }

export async function GET(req: Request) {
  const userId = verifyToken(req);
  if (!userId) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return corsJson(req, { error: "Invalid userId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "12"), 30);
  const cursor = url.searchParams.get("cursor");

  const myId = new mongoose.Types.ObjectId(userId);
  const SavedPost = await getSavedPostModel();
  const Post = await getPostModel();

  // Collect saved postIDs for this user, sorted newest-save-first
  const savedDocs = await SavedPost.find({ userID: myId })
    .sort({ _id: -1 })
    .select("postID _id")
    .lean();

  // Cursor-based pagination: skip until we pass the cursor savedpost _id
  let startIdx = 0;
  if (cursor) {
    const idx = savedDocs.findIndex(
      (d: { _id: { toString(): string } }) => d._id.toString() === cursor
    );
    if (idx !== -1) startIdx = idx + 1;
  }

  const pageSlice = savedDocs.slice(startIdx, startIdx + limit + 1);
  const hasMore = pageSlice.length > limit;
  const pageItems = pageSlice.slice(0, limit);
  const nextCursor =
    hasMore
      ? (savedDocs[startIdx + limit - 1] as { _id: { toString(): string } })?._id.toString()
      : null;

  const postIds = pageItems.map(
    (d: { postID: mongoose.Types.ObjectId }) => d.postID
  );

  if (postIds.length === 0) {
    return corsJson(req, { posts: [], hasMore: false, nextCursor: null });
  }

  const rawPosts = await Post.aggregate([
    {
      $match: {
        _id: { $in: postIds },
        isDeleted: false,
        isPublished: true,
      },
    },
    // Preserve saved-at order
    {
      $addFields: {
        __sortOrder: { $indexOfArray: [postIds, "$_id"] },
      },
    },
    { $sort: { __sortOrder: 1 } },
    {
      $lookup: {
        from: "media",
        localField: "media",
        foreignField: "_id",
        as: "mediaData",
        pipeline: [
          {
            $project: {
              mediaType: 1,
              sourceUrl: 1,
              thumbnailUrl: 1,
              videoUrl: 1,
              hlsUrl: 1,
              width: 1,
              height: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$postID", "$$postId"] } } },
          { $project: { userID: 1 } },
        ],
        as: "likesData",
      },
    },
    {
      $lookup: {
        from: "comments",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postID", "$$postId"] },
                  { $eq: ["$isPublished", true] },
                ],
              },
            },
          },
          { $count: "total" },
        ],
        as: "commentsData",
      },
    },
    // Populate post author
    {
      $lookup: {
        from: "users",
        localField: "userID",
        foreignField: "_id",
        as: "authorData",
        pipeline: [
          { $project: { fullname: 1, profilePicture: 1 } },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        content: 1,
        feelings: 1,
        createdAt: 1,
        postType: 1,
        mediaData: 1,
        likesCount: { $size: "$likesData" },
        commentsCount: {
          $ifNull: [{ $arrayElemAt: ["$commentsData.total", 0] }, 0],
        },
        isLiked: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: "$likesData",
                  as: "l",
                  cond: { $eq: ["$$l.userID", myId] },
                },
              },
            },
            0,
          ],
        },
        isSaved: { $literal: true },
        authorName: { $arrayElemAt: ["$authorData.fullname", 0] },
        authorPicUrl: { $arrayElemAt: ["$authorData.profilePicture", 0] },
      },
    },
  ]);

  const posts = rawPosts.map((p) => ({
    ...p,
    _id: p._id?.toString(),
    mediaData: (p.mediaData ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      _id: (m._id as { toString(): string } | undefined)?.toString(),
    })),
  }));

  return corsJson(req, { posts, hasMore, nextCursor });
}
