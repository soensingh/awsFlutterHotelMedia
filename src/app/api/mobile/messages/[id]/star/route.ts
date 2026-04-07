import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMessageModel } from "../../models";
import { corsJson, corsOptions } from "../../../auth/cors";
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

// POST = star, DELETE = unstar
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = extractUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return corsJson(req, { error: "Invalid ID" }, { status: 400 });

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);
  const doc = await Message.findOne({
    _id: new mongoose.Types.ObjectId(id),
    $or: [{ userID: myId }, { targetUserID: myId }],
    deletedByID: { $ne: myId },
  }).lean();
  if (!doc) return corsJson(req, { error: "Not found" }, { status: 404 });

  await Message.findByIdAndUpdate(id, { $addToSet: { starredBy: myId } });
  return corsJson(req, { starred: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = extractUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return corsJson(req, { error: "Invalid ID" }, { status: 400 });

  const Message = await getMessageModel();
  const myId = new mongoose.Types.ObjectId(userId);
  await Message.findByIdAndUpdate(id, { $pull: { starredBy: myId } });
  return corsJson(req, { starred: false });
}
