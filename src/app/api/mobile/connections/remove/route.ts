import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getUserConnectionModel } from "../models";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function POST(req: Request) {
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

  let body: { targetUserId?: string; type?: string };
  try {
    body = (await req.json()) as { targetUserId?: string; type?: string };
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { targetUserId, type } = body;
  if (!targetUserId || (type !== "follower" && type !== "following")) {
    return corsJson(
      req,
      { error: "targetUserId and type ('follower'|'following') are required" },
      { status: 400 }
    );
  }

  const myId = new mongoose.Types.ObjectId(userId);
  const targetId = new mongoose.Types.ObjectId(targetUserId);
  const Conn = await getUserConnectionModel();

  if (type === "follower") {
    // Remove this person from my followers: they had follower=targetId, following=myId
    await Conn.deleteOne({ follower: targetId, following: myId });
  } else {
    // Unfollow: I had follower=myId, following=targetId
    await Conn.deleteOne({ follower: myId, following: targetId });
  }

  return corsJson(req, { success: true });
}
