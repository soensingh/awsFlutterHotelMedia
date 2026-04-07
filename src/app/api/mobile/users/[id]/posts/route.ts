import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../../../auth/model";
import { getUserConnectionModel } from "../../../connections/models";
import { getPostModel } from "../../../posts/models";
import { corsJson, corsOptions } from "../../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let myUserId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    myUserId = (payload.sub ?? payload.id ?? payload.userId)?.toString() ?? "";
    if (!myUserId) throw new Error("no userId");
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  const { id: targetId } = await params;
  if (!mongoose.Types.ObjectId.isValid(targetId)) {
    return corsJson(req, { error: "Invalid user id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "12"), 30);
  const cursor = url.searchParams.get("cursor");

  const User = await getMobileUserModel();
  const Conn = await getUserConnectionModel();

  const targetOid = new mongoose.Types.ObjectId(targetId);
  const myOid = new mongoose.Types.ObjectId(myUserId);

  // Privacy check
  const target = await User.findOne(
    { _id: targetOid, isDeleted: false },
    { privateAccount: 1 }
  ).lean();
  if (!target) return corsJson(req, { error: "User not found" }, { status: 404 });

  const isPrivate = (target as { privateAccount?: boolean }).privateAccount ?? false;
  if (isPrivate && myUserId !== targetId) {
    const conn = await Conn.findOne({
      follower: myOid,
      following: targetOid,
      status: "accepted",
    }).lean();
    if (!conn) {
      return corsJson(req, { posts: [], hasMore: false, locked: true });
    }
  }

  const Post = await getPostModel();
  const matchStage: Record<string, unknown> = {
    userID: targetOid,
    isDeleted: false,
    isPublished: true,
    ...(cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {}),
  };

  const rawPosts = await Post.aggregate([
    { $match: matchStage },
    { $sort: { _id: -1 } },
    { $limit: limit + 1 },
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
                  { $eq: ["$userID", myOid] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "savedData",
      },
    },
    {
      $project: {
        _id: 1,
        content: 1,
        feelings: 1,
        createdAt: 1,
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
                  cond: { $eq: ["$$l.userID", myOid] },
                },
              },
            },
            0,
          ],
        },
        isSaved: { $gt: [{ $size: "$savedData" }, 0] },
      },
    },
  ]);

  const hasMore = rawPosts.length > limit;
  const posts = rawPosts.slice(0, limit).map((p) => ({
    ...p,
    _id: p._id?.toString(),
    mediaData: (p.mediaData ?? []).map((m: Record<string, unknown>) => ({
      ...m,
      _id: (m._id as { toString(): string } | undefined)?.toString(),
    })),
  }));

  return corsJson(req, { posts, hasMore, locked: false });
}
