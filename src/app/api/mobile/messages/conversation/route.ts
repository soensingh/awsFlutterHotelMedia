import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMessageModel } from "../models";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── GET /api/mobile/messages/conversation?with=partnerId[&before=msgId] ───────
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

  const url = new URL(req.url);
  const partnerId = url.searchParams.get("with");
  const before = url.searchParams.get("before");

  if (!partnerId || !mongoose.Types.ObjectId.isValid(partnerId)) {
    return corsJson(req, { error: "'with' must be a valid user ID" }, { status: 400 });
  }

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);
  const partnerObjId = new mongoose.Types.ObjectId(partnerId);

  const match: Record<string, unknown> = {
    $or: [
      { userID: myId, targetUserID: partnerObjId },
      { userID: partnerObjId, targetUserID: myId },
    ],
    deletedByID: { $ne: myId },
  };

  if (before && mongoose.Types.ObjectId.isValid(before)) {
    match._id = { $lt: new mongoose.Types.ObjectId(before) };
  }

  const msgs = await Message.find(match).sort({ createdAt: -1 }).limit(30).lean();

  // Mark messages FROM partner TO me as seen
  await Message.updateMany(
    { userID: partnerObjId, targetUserID: myId, isSeen: false },
    { $set: { isSeen: true } }
  );

  const messages = msgs.map((m) => ({
    _id:             (m._id as mongoose.Types.ObjectId).toString(),
    userID:          (m.userID as mongoose.Types.ObjectId).toString(),
    targetUserID:    (m.targetUserID as mongoose.Types.ObjectId).toString(),
    message:         m.isDeleted ? "This message was deleted" : m.message,
    type:            m.type,
    isSeen:          m.isSeen,
    isFromMe:        (m.userID as mongoose.Types.ObjectId).toString() === userId,
    isEdited:        m.isEdited ?? false,
    isDeleted:       m.isDeleted ?? false,
    isStarred:       (m.starredBy as mongoose.Types.ObjectId[] | undefined)
                       ?.some(id => id.toString() === userId) ?? false,
    isPinned:        (m.pinnedBy as mongoose.Types.ObjectId[] | undefined)
                       ?.some(id => id.toString() === userId) ?? false,
    replyToId:       (m.replyToId as mongoose.Types.ObjectId | null)?.toString() ?? null,
    forwardedFromId: (m.forwardedFromId as mongoose.Types.ObjectId | null)?.toString() ?? null,
    createdAt:       m.createdAt,
  }));

  return corsJson(req, { messages }, { headers: { "Cache-Control": "private, no-store" } });
}
