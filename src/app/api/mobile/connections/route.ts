import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getUserConnectionModel } from "./models";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let userId: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    userId = (payload.sub ?? payload.id ?? payload.userId)?.toString() ?? "";
    if (!userId) throw new Error("no userId");
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type");   // "followers" | "following"
  const cursor = url.searchParams.get("cursor"); // last connection._id for pagination

  if (type !== "followers" && type !== "following") {
    return corsJson(req, { error: "type must be 'followers' or 'following'" }, { status: 400 });
  }

  const myId = new mongoose.Types.ObjectId(userId);
  const Conn = await getUserConnectionModel();

  // Match connections where I am the "following" (my followers) or "follower" (people I follow)
  const matchStage: Record<string, unknown> = {
    status: "accepted",
    ...(type === "followers" ? { following: myId } : { follower: myId }),
    ...(cursor ? { _id: { $lt: new mongoose.Types.ObjectId(cursor) } } : {}),
  };

  // The field that points to the "other" user
  const otherField = type === "followers" ? "follower" : "following";

  const results = await Conn.aggregate([
    { $match: matchStage },
    { $sort: { _id: -1 } },
    { $limit: 21 }, // one extra to determine hasMore
    // Populate the other user's profile
    {
      $lookup: {
        from: "users",
        localField: otherField,
        foreignField: "_id",
        as: "userDoc",
        pipeline: [
          { $project: { name: 1, username: 1, "profilePic.small": 1 } },
        ],
      },
    },
    { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: false } },
    // Check for reverse connection (they follow me back / I follow them back)
    {
      $lookup: {
        from: "userconnections",
        let: { uid: "$userDoc._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $eq: [
                      "$follower",
                      type === "followers" ? myId : "$$uid",
                    ],
                  },
                  {
                    $eq: [
                      "$following",
                      type === "followers" ? "$$uid" : myId,
                    ],
                  },
                  { $eq: ["$status", "accepted"] },
                ],
              },
            },
          },
          { $limit: 1 },
        ],
        as: "reverseConn",
      },
    },
    {
      $project: {
        connectionId: { $toString: "$_id" },
        id: { $toString: "$userDoc._id" },
        name: "$userDoc.name",
        username: { $ifNull: ["$userDoc.username", ""] },
        profilePicSmall: { $ifNull: ["$userDoc.profilePic.small", null] },
        followsBack: { $gt: [{ $size: "$reverseConn" }, 0] },
      },
    },
  ]);

  const hasMore = results.length > 20;
  const users = results.slice(0, 20);

  return corsJson(req, { users, hasMore });
}
