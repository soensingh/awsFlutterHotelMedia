import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMessageModel } from "../models";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

function extractUserId(req: Request): string | null {
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

// ── PATCH /api/mobile/messages/[id]  ─ edit a message (within 1 min) ─────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = extractUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return corsJson(req, { error: "Invalid message ID" }, { status: 400 });
  }

  let body: { message?: string };
  try { body = await req.json(); } catch { return corsJson(req, { error: "Invalid JSON" }, { status: 400 }); }

  const newText = body.message?.trim();
  if (!newText) return corsJson(req, { error: "message is required" }, { status: 400 });

  const Message = await getMessageModel();
  const doc = await Message.findOne({
    _id: new mongoose.Types.ObjectId(id),
    userID: new mongoose.Types.ObjectId(userId),
    isDeleted: { $ne: true },
  }).lean();

  if (!doc) return corsJson(req, { error: "Message not found" }, { status: 404 });

  // Only allow editing within 1 minute of creation
  const age = Date.now() - new Date(doc.createdAt as Date).getTime();
  if (age > 60_000) {
    return corsJson(req, { error: "Edit window expired (1 minute)" }, { status: 403 });
  }

  const updated = await Message.findByIdAndUpdate(
    id,
    { $set: { message: newText, isEdited: true } },
    { new: true }
  ).lean();

  return corsJson(req, {
    message: {
      id: (updated!._id as mongoose.Types.ObjectId).toString(),
      message: updated!.message,
      isEdited: true,
    },
  });
}

// ── DELETE /api/mobile/messages/[id]  ─ delete for me | for everyone ──────────
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = extractUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return corsJson(req, { error: "Invalid message ID" }, { status: 400 });
  }

  const url = new URL(req.url);
  // ?everyone=true  →  delete for both parties (sender only)
  const everyone = url.searchParams.get("everyone") === "true";

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);
  const msgId = new mongoose.Types.ObjectId(id);

  const doc = await Message.findOne({
    _id: msgId,
    $or: [{ userID: myId }, { targetUserID: myId }],
  }).lean();

  if (!doc) return corsJson(req, { error: "Message not found" }, { status: 404 });

  if (everyone) {
    // Only the original sender can delete for everyone
    if ((doc.userID as mongoose.Types.ObjectId).toString() !== userId) {
      return corsJson(req, { error: "Only the sender can delete for everyone" }, { status: 403 });
    }
    await Message.findByIdAndUpdate(msgId, {
      $set: { isDeleted: true, message: "This message was deleted" },
    });
    return corsJson(req, { deleted: "everyone" });
  } else {
    // Delete just for me — add to deletedByID array
    await Message.findByIdAndUpdate(msgId, {
      $addToSet: { deletedByID: myId },
    });
    return corsJson(req, { deleted: "me" });
  }
}
