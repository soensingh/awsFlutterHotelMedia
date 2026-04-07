import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../../../auth/model";
import { getUserConnectionModel } from "../../../connections/models";
import { corsJson, corsOptions } from "../../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

/** POST /api/mobile/users/:id/follow  — follow or request to follow */
export async function POST(
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
  if (targetId === myUserId) {
    return corsJson(req, { error: "Cannot follow yourself" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const Conn = await getUserConnectionModel();

  const myOid = new mongoose.Types.ObjectId(myUserId);
  const targetOid = new mongoose.Types.ObjectId(targetId);

  const target = await User.findOne(
    { _id: targetOid, isDeleted: false },
    { privateAccount: 1 }
  ).lean();
  if (!target) return corsJson(req, { error: "User not found" }, { status: 404 });

  const isPrivate = (target as { privateAccount?: boolean }).privateAccount ?? false;
  const newStatus = isPrivate ? "pending" : "accepted";

  // Upsert — avoid duplicate follow
  await Conn.findOneAndUpdate(
    { follower: myOid, following: targetOid },
    { $set: { status: newStatus } },
    { upsert: true }
  );

  return corsJson(req, {
    connectionStatus: isPrivate ? "requested" : "following",
  });
}

/** DELETE /api/mobile/users/:id/follow  — unfollow or cancel request */
export async function DELETE(
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

  const Conn = await getUserConnectionModel();
  await Conn.deleteOne({
    follower: new mongoose.Types.ObjectId(myUserId),
    following: new mongoose.Types.ObjectId(targetId),
  });

  return corsJson(req, { connectionStatus: "none" });
}
