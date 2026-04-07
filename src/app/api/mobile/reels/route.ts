import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getPostModel } from "../posts/models";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let userId: string | null = null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    userId = (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? null;
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  // ── Params ────────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10"), 20);

  // Parse exclude list — comma-separated post IDs the client has already seen
  const excludeParam = url.searchParams.get("exclude") ?? "";
  const excludeIds = excludeParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => mongoose.Types.ObjectId.isValid(s))
    .slice(0, 50) // cap to prevent oversized queries
    .map((s) => new mongoose.Types.ObjectId(s));

  // ── Query ─────────────────────────────────────────────────────────────────
  const Post = await getPostModel();

  // Oversample to compensate for the video-only filter applied after media lookup
  const oversample = Math.min(limit * 5, 100);

  const rawReels = await Post.aggregate([
    {
      $match: {
        isDeleted: false,
        isPublished: true,
        'media.0': { $exists: true },
        ...(excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {}),
        ...(userId ? { userID: { $ne: new mongoose.Types.ObjectId(userId) } } : {}),
      },
    },
    // Exclude posts from private accounts before sampling
    {
      $lookup: {
        from: "users",
        localField: "userID",
        foreignField: "_id",
        as: "_authorPrivacy",
        pipeline: [{ $project: { privateAccount: 1 } }],
      },
    },
    { $match: { "_authorPrivacy.0.privateAccount": { $ne: true } } },
    { $sample: { size: oversample } },
    // Populate media — needed to filter video-only posts
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
              width: 1,
              height: 1,
              videoUrl: 1,
              hlsUrl: 1,
            },
          },
        ],
      },
    },
    // Keep only posts that have at least one playable video
    {
      $match: {
        mediaData: { $elemMatch: { mediaType: "video", videoUrl: { $ne: "" } } },
      },
    },
    // Limit to requested count after video filter
    { $limit: limit },
    // Populate post author
    {
      $lookup: {
        from: "users",
        localField: "userID",
        foreignField: "_id",
        as: "authorData",
        pipeline: [{ $project: { name: 1, username: 1, profilePic: 1 } }],
      },
    },
    // Count likes + check if current user liked
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
    // Check if current user saved this post
    {
      $lookup: {
        from: "savedposts",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postID", "$$postId"] },
                  { $eq: ["$userID", userId ? new mongoose.Types.ObjectId(userId) : null] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "savedData",
      },
    },
    // Count comments
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
    // Final shape
    {
      $project: {
        _id: 1,
        content: 1,
        feelings: 1,
        location: 1,
        views: 1,
        comments: 1,
        createdAt: 1,
        postType: 1,
        mediaData: 1,
        author: { $arrayElemAt: ["$authorData", 0] },
        likesCount: { $size: "$likesData" },
        commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsData.total", 0] }, 0] },
        isLiked: userId
          ? {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: "$likesData",
                      as: "l",
                      cond: {
                        $eq: [
                          "$$l.userID",
                          new mongoose.Types.ObjectId(userId),
                        ],
                      },
                    },
                  },
                },
                0,
              ],
            }
          : false,
        isSaved: userId ? { $gt: [{ $size: "$savedData" }, 0] } : false,
      },
    },
  ]);

  const reels = rawReels.map((p) => ({
    ...p,
    _id: p._id?.toString(),
    author: p.author
      ? {
          ...p.author,
          _id: (p.author._id as mongoose.Types.ObjectId)?.toString(),
          profilePic: p.author.profilePic ?? {},
        }
      : null,
    mediaData: (p.mediaData ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      _id: (m._id as mongoose.Types.ObjectId)?.toString(),
    })),
  }));

  return corsJson(req, { reels }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
