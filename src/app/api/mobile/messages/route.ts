import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMessageModel } from "./models";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── GET /api/mobile/messages  ─ inbox (conversation list) ────────────────────
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

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
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);

  const raw = await Message.aggregate([
    // All messages involving me that I have not deleted
    {
      $match: {
        $or: [{ userID: myId }, { targetUserID: myId }],
        deletedByID: { $ne: myId },
      },
    },
    // Compute the other person's ID
    {
      $addFields: {
        partnerId: {
          $cond: {
            if: { $eq: ["$userID", myId] },
            then: "$targetUserID",
            else: "$userID",
          },
        },
      },
    },
    // Newest first so $first in the group = latest message
    { $sort: { createdAt: -1 } },
    // One document per conversation partner
    {
      $group: {
        _id: "$partnerId",
        lastMessage: { $first: "$message" },
        lastMessageAt: { $first: "$createdAt" },
        lastMessageIsFromMe: { $first: { $eq: ["$userID", myId] } },        lastMessageSeen: { $first: '$isSeen' },        unreadCount: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$isSeen", false] }, { $ne: ["$userID", myId] }] },
              1,
              0,
            ],
          },
        },
      },
    },
    // Fetch partner's profile
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "partnerData",
        pipeline: [{ $project: { name: 1, username: 1, profilePic: 1, isOnline: 1, onlineUntil: 1 } }],
      },
    },
    {
      $project: {
        _id: 0,
        lastMessage: 1,
        lastMessageAt: 1,
        lastMessageIsFromMe: 1,        lastMessageSeen: 1,        unreadCount: 1,
        partner: { $arrayElemAt: ["$partnerData", 0] },
      },
    },
    { $sort: { lastMessageAt: -1 } },
  ]);

  const now = new Date();
  const conversations = raw.map((c) => ({
    ...c,
    partner: c.partner
      ? {
          ...c.partner,
          _id: (c.partner._id as mongoose.Types.ObjectId)?.toString(),
          profilePic: c.partner.profilePic ?? {},
          isOnline:
            c.partner.isOnline === true &&
            c.partner.onlineUntil != null &&
            new Date(c.partner.onlineUntil) > now,
        }
      : null,
  }));

  return corsJson(req, { conversations }, { headers: { "Cache-Control": "private, no-store" } });
}

// ── POST /api/mobile/messages  ─ send a message ───────────────────────────────
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let senderId: string | null = null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    senderId = (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? null;
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }
  if (!senderId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let body: { targetUserId?: string; message?: string; type?: string };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { targetUserId, message, type = "text" } = body;

  if (!targetUserId || !message?.trim()) {
    return corsJson(req, { error: "targetUserId and message are required" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    return corsJson(req, { error: "Invalid targetUserId" }, { status: 400 });
  }

  const Message = await getMessageModel();
  const doc = await Message.create({
    userID: new mongoose.Types.ObjectId(senderId),
    targetUserID: new mongoose.Types.ObjectId(targetUserId),
    message: message.trim(),
    type,
    isSeen: false,
    deletedByID: [],
  });

  return corsJson(
    req,
    {
      message: {
        _id: (doc._id as mongoose.Types.ObjectId).toString(),
        userID: senderId,
        targetUserID: targetUserId,
        message: doc.message,
        type: doc.type,
        isSeen: doc.isSeen,
        isFromMe: true,
        createdAt: doc.createdAt,
      },
    },
    { status: 201 }
  );
}
