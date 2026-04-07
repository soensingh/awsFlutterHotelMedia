import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../auth/model";
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
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);

  if (!q) return corsJson(req, { users: [] });

  // Escape special regex chars (prevents ReDoS)
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(escaped, "i");

  const User = await getMobileUserModel();
  const myId = new mongoose.Types.ObjectId(userId);

  const users = await User.find(
    {
      _id: { $ne: myId },
      isDeleted: false,
      $or: [{ name: pattern }, { username: pattern }],
    },
    {
      _id: 1,
      name: 1,
      username: 1,
      "profilePic.small": 1,
      bio: 1,
      privateAccount: 1,
    }
  ).limit(limit);

  return corsJson(req, {
    users: users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      profilePicSmall: (u.profilePic as { small?: string })?.small ?? null,
      bio: u.bio ?? "",
      privateAccount: u.privateAccount ?? false,
    })),
  });
}
