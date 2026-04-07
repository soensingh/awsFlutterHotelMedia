import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getPostModel, getMediaModel } from "./models";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";
import { notifyUser } from "@/lib/ws-notify";

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

  // ── Params ───────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10"), 20);

  // ── Query ─────────────────────────────────────────────────────────────────
  const Post = await getPostModel();

  // Use $sample for random ordering (MVP algo — will improve later)
  const rawPosts = await Post.aggregate([
    // Only serve posts that have at least one media item
    { $match: { isDeleted: false, isPublished: true, 'media.0': { $exists: true }, ...(userId ? { userID: { $ne: new mongoose.Types.ObjectId(userId) } } : {}) } },
    // Join user to check privateAccount BEFORE sampling so private posts are excluded
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
    { $sample: { size: limit } },
    // Populate media documents
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
    // Populate tagged users
    {
      $lookup: {
        from: "users",
        localField: "tagged",
        foreignField: "_id",
        as: "taggedData",
        pipeline: [{ $project: { name: 1, username: 1 } }],
      },
    },
    // Count likes from the likes collection + check if current user liked
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
    // Check if current user has saved this post
    {
      $lookup: {
        from: "savedposts",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$postID", "$$postId"] },
            { $eq: ["$userID", userId ? new mongoose.Types.ObjectId(userId) : null] },
          ]}}},
          { $limit: 1 },
        ],
        as: "savedData",
      },
    },
    // Count real comments from the comments collection
    {
      $lookup: {
        from: "comments",
        let: { postId: "$_id" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$postID", "$$postId"] },
            { $eq: ["$isPublished", true] },
          ]}}},
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
        taggedUsers: "$taggedData",
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

  // Stringify all ObjectIds so Flutter doesn't receive BSON objects
  const posts = rawPosts.map((p) => ({
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
    taggedUsers: (p.taggedUsers ?? []).map((u: Record<string, unknown>) => ({
      ...u,
      _id: (u._id as mongoose.Types.ObjectId)?.toString(),
    })),
  }));

  return corsJson(req, { posts }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

// ── POST /api/mobile/posts ─────────────────────────────────────────────────
// Body: { mediaUrl, mediaType, thumbnailUrl?, content, mentions, intents,
//         postType?, muted?, trimStart?, trimEnd?, filterMatrix? }
// Returns: { postId }
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let userId: string;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    userId = (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? "";
    if (!userId) throw new Error("no userId");
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  let body: {
    mediaUrl?: string;
    mediaType?: string;
    thumbnailUrl?: string;
    s3Key?: string;
    fileName?: string;
    fileSize?: number;
    width?: number;
    height?: number;
    duration?: number;
    content?: string;
    mentions?: { userId: string; username: string }[];
    intents?: string[];
    postType?: string;
    muted?: boolean;
    trimStart?: number;
    trimEnd?: number;
    filterMatrix?: number[];
  };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const {
    mediaUrl,
    mediaType = "image",
    thumbnailUrl = "",
    s3Key: bodyS3Key = "",
    fileName: bodyFileName = "",
    fileSize = 0,
    width = 0,
    height = 0,
    duration = 0,
    content = "",
    mentions = [],
    intents = [],
    postType = "post",
    muted = false,
    trimStart = null,
    trimEnd = null,
    filterMatrix = null,
  } = body;

  if (!mediaUrl) return corsJson(req, { error: "mediaUrl is required" }, { status: 400 });

  // Derive s3Key and fileName from URL if the client didn't send them
  const deriveS3Key = (url: string) => {
    try { return new URL(url).pathname.replace(/^\//, ""); } catch { return ""; }
  };
  const s3Key    = bodyS3Key   || deriveS3Key(mediaUrl);
  const fileName = bodyFileName || s3Key.split("/").pop() || "";

  // Infer mimeType from file extension
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  const mimeTypeMap: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  };
  const mimeType = mimeTypeMap[ext] ?? (mediaType === "video" ? "video/mp4" : "image/jpeg");

  const authorId = new mongoose.Types.ObjectId(userId);

  // 1. Create Media document — old schema: sourceUrl for all, videoUrl also set for video
  const Media = await getMediaModel();
  const mediaDoc = await Media.create({
    userID:       authorId,
    mediaType,
    fileName,
    width:        width  ?? 0,
    height:       height ?? 0,
    fileSize:     fileSize ?? 0,
    mimeType,
    sourceUrl:    mediaUrl,                                    // always set
    videoUrl:     mediaType === "video" ? mediaUrl : "",       // backward compat
    thumbnailUrl: thumbnailUrl || (mediaType === "image" ? mediaUrl : ""),
    s3Key,
    duration:     duration ?? 0,
  });

  // 2. Create Post document
  const Post = await getPostModel();
  const mentionsNorm = (mentions ?? []).map((m) => ({
    userId: new mongoose.Types.ObjectId(m.userId),
    username: m.username ?? "",
  }));

  const post = await Post.create({
    userID: authorId,
    postType: postType ?? "post",
    content: content ?? "",
    media: [mediaDoc._id],
    mentions: mentionsNorm,
    intents: (intents ?? []).filter((t) => typeof t === "string" && t.length > 0),
    muted: muted ?? false,
    trimStart: trimStart ?? null,
    trimEnd:   trimEnd   ?? null,
    filterMatrix: filterMatrix ?? null,
    isPublished: true,
  });

  // 3. Trigger background HLS processing for video posts
  if (mediaType === "video" && mediaUrl) {
    // Fire-and-forget: don't await — post creation returns immediately.
    // The HLS version becomes available asynchronously.
    (async () => {
      try {
        const { processVideoToHLS, extractS3Key } = await import("@/lib/video-processing");
        const s3Key = extractS3Key(mediaUrl);
        console.log(`[Post] Starting background HLS processing for media ${mediaDoc._id}`);
        const result = await processVideoToHLS(mediaDoc._id.toString(), s3Key);
        await Media.findByIdAndUpdate(mediaDoc._id, {
          $set: { hlsUrl: result.hlsUrl },
        });
        console.log(`[Post] HLS ready: ${result.hlsUrl}`);
      } catch (err) {
        console.error(`[Post] Background HLS processing failed:`, err);
        // Non-fatal — MP4 fallback still works
      }
    })();
  }

  // 4. Notifications for each mentioned user
  if (mentionsNorm.length > 0) {
    try {
      const { getNotificationModel } = await import("../notifications/model");
      const { getMobileUserModel } = await import("../auth/model");

      const Notification = await getNotificationModel();
      const User         = await getMobileUserModel();

      const author = await User.findById(authorId, { name: 1, username: 1 }).lean();
      const authorUsername = (author as { username?: string })?.username ?? "someone";

      await Notification.insertMany(
        mentionsNorm.map((m) => ({
          userID:       m.userId,
          targetUserID: authorId,
          title:        "You were mentioned",
          description:  `@${authorUsername} mentioned you in a post`,
          type:         "mention",
          metadata:     { postId: post._id.toString() },
          isSeen:       false,
          isDeleted:    false,
        }))
      );
    } catch (notifErr) {
      console.error("Mention notification error:", notifErr);
      // Non-fatal — post still created
    }
  }

  // 5. Notify the author's profile cache via WS (fire-and-forget)
  const wsEvent = mediaType === "video" ? "profile_reels_changed" : "profile_posts_changed";
  notifyUser(userId, wsEvent);

  return corsJson(req, { postId: post._id.toString() }, { status: 201 });
}
