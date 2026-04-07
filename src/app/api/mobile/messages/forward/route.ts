import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMessageModel } from "../models";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── POST /api/mobile/messages/forward ─────────────────────────────────────────
// Body: { messageId: string, toUserId: string }
// Creates a new message in the target conversation with forwardedFromId set.
export async function POST(req: Request) {
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

  let body: { messageId?: string; toUserId?: string };
  try { body = await req.json(); } catch { return corsJson(req, { error: "Invalid JSON" }, { status: 400 }); }

  const { messageId, toUserId } = body;
  if (!messageId || !toUserId) {
    return corsJson(req, { error: "messageId and toUserId are required" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(messageId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
    return corsJson(req, { error: "Invalid IDs" }, { status: 400 });
  }

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);

  // Fetch original message — must be accessible to the current user
  const original = await Message.findOne({
    _id: new mongoose.Types.ObjectId(messageId),
    $or: [
      { userID: myId },
      { targetUserID: myId },
    ],
    isDeleted: { $ne: true },
    deletedByID: { $ne: myId },
  }).lean();

  if (!original) return corsJson(req, { error: "Message not found" }, { status: 404 });

  const doc = await Message.create({
    userID:         myId,
    targetUserID:   new mongoose.Types.ObjectId(toUserId),
    message:        original.message,
    type:           original.type ?? "text",
    isSeen:         false,
    forwardedFromId: original._id,
  });

  return corsJson(req, {
    message: {
      id:              (doc._id as mongoose.Types.ObjectId).toString(),
      senderId:        doc.userID.toString(),
      targetId:        doc.targetUserID.toString(),
      message:         doc.message,
      type:            doc.type,
      isSeen:          doc.isSeen,
      isFromMe:        true,
      forwardedFromId: (doc.forwardedFromId as mongoose.Types.ObjectId)?.toString() ?? null,
      createdAt:       doc.createdAt,
    },
  }, { status: 201 });
}
