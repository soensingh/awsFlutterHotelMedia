import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../../auth/model";
import { getUserConnectionModel } from "../../connections/models";
import { corsJson, corsOptions } from "../../auth/cors";
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

  const User = await getMobileUserModel();
  const Conn = await getUserConnectionModel();

  const targetOid = new mongoose.Types.ObjectId(targetId);
  const myOid = new mongoose.Types.ObjectId(myUserId);

  const user = await User.findOne(
    { _id: targetOid, isDeleted: false },
    { name: 1, username: 1, bio: 1, profilePic: 1, privateAccount: 1 }
  ).lean();

  if (!user) return corsJson(req, { error: "User not found" }, { status: 404 });

  // Counts
  const [followersCount, followingCount] = await Promise.all([
    Conn.countDocuments({ following: targetOid, status: "accepted" }),
    Conn.countDocuments({ follower: targetOid, status: "accepted" }),
  ]);

  // My connection status toward them
  const myConn = await Conn.findOne({
    follower: myOid,
    following: targetOid,
  }).lean();

  let connectionStatus: "none" | "requested" | "following" = "none";
  if (myConn) {
    connectionStatus =
      (myConn as { status: string }).status === "accepted"
        ? "following"
        : "requested";
  }

  const typedUser = user as {
    _id: mongoose.Types.ObjectId;
    name: string;
    username: string;
    bio?: string;
    profilePic?: { small?: string; medium?: string };
    privateAccount?: boolean;
  };

  return corsJson(req, {
    user: {
      id: targetId,
      name: typedUser.name ?? "",
      username: typedUser.username ?? "",
      bio: typedUser.bio ?? "",
      profilePic: typedUser.profilePic ?? {},
      privateAccount: typedUser.privateAccount ?? false,
      followersCount,
      followingCount,
      connectionStatus,
    },
  });
}
