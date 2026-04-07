import jwt, { type Secret } from "jsonwebtoken";
import { getMobileUserModel } from "../auth/model";
import { getPostModel } from "../posts/models";
import { getUserConnectionModel } from "../connections/models";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let payload: { sub?: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as { sub?: string };
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return corsJson(req, { error: "Invalid token payload" }, { status: 401 });
  }

  const User = await getMobileUserModel();
  const user = await User.findById(userId).lean();

  if (!user || user.isDeleted) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  const u = user as typeof user & Record<string, unknown>;

  // Parallel counts
  const [Post, Conn] = await Promise.all([
    getPostModel(),
    getUserConnectionModel(),
  ]);

  const userObjId = user._id;
  const [postsCount, followersCount, followingCount] = await Promise.all([
    Post.countDocuments({ userID: userObjId, isDeleted: false }),
    Conn.countDocuments({ following: userObjId, status: "accepted" }),
    Conn.countDocuments({ follower:  userObjId, status: "accepted" }),
  ]);

  return corsJson(req, {
    user: {
      id: String(u._id),
      name: u.name ?? "",
      username: (u.username as string | undefined) ?? "",
      email: u.email ?? "",
      bio: (u.bio as string | undefined) ?? "",
      profilePic: (u.profilePic as { small?: string; medium?: string; large?: string } | undefined) ?? null,
      hasProfilePicture: (u.hasProfilePicture as boolean | undefined) ?? false,
      phoneNumber: u.phoneNumber ?? "",
      dialCode: u.dialCode ?? "",
      billingAddress: (u.billingAddress as string | undefined) ?? "",
      profession: (u.profession as string | undefined) ?? "",
      lastEmailChange: (u.lastEmailChange as Date | undefined) ?? null,
      lastPhoneChange: (u.lastPhoneChange as Date | undefined) ?? null,
      accountType: (u.accountType as string | undefined) ?? "individual",
      role: u.role ?? "user",
      language: (u.language as string | undefined) ?? "en",
      privateAccount: (u.privateAccount as boolean | undefined) ?? false,
      notificationEnabled: (u.notificationEnabled as boolean | undefined) ?? true,
      postsCount,
      followersCount,
      followingCount,
    },
  });
}

// ── PATCH /api/mobile/profile ─────────────────────────────────────────────────
// Body:     { privateAccount?: boolean, notificationEnabled?: boolean }
// Response: { privateAccount?: boolean, notificationEnabled?: boolean }

export async function PATCH(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  let payload: { sub?: string };
  try {
    payload = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as { sub?: string };
  } catch {
    return corsJson(req, { error: "Invalid or expired token" }, { status: 401 });
  }

  const userId = payload.sub;
  if (!userId) {
    return corsJson(req, { error: "Invalid token payload" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.privateAccount === "boolean") {
    updates.privateAccount = body.privateAccount;
  }

  if (typeof body.notificationEnabled === "boolean") {
    updates.notificationEnabled = body.notificationEnabled;
  }

  if (typeof body.name === "string" && body.name.trim().length > 0) {
    updates.name = body.name.trim();
  }

  if (typeof body.bio === "string") {
    updates.bio = body.bio.trim();
  }

  if (typeof body.billingAddress === "string") {
    updates.billingAddress = body.billingAddress.trim();
  }

  if (body.profilePic && typeof body.profilePic === "object") {
    const pic = body.profilePic as Record<string, unknown>;
    if (typeof pic.small === "string" || typeof pic.medium === "string" || typeof pic.large === "string") {
      updates.profilePic = {
        small: typeof pic.small === "string" ? pic.small : "",
        medium: typeof pic.medium === "string" ? pic.medium : "",
        large: typeof pic.large === "string" ? pic.large : "",
      };
      updates.hasProfilePicture = true;
    }
  }

  if (Object.keys(updates).length === 0) {
    return corsJson(req, { error: "No valid fields to update" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: updates },
    { new: true, select: "name bio billingAddress profilePic hasProfilePicture privateAccount notificationEnabled" }
  ).lean();

  if (!updated) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  const u2 = updated as unknown as {
    name: string; bio: string; billingAddress: string;
    profilePic: { small: string; medium: string; large: string } | null;
    hasProfilePicture: boolean; privateAccount: boolean; notificationEnabled: boolean;
  };
  return corsJson(req, {
    name: u2.name ?? "",
    bio: u2.bio ?? "",
    billingAddress: u2.billingAddress ?? "",
    profilePic: u2.profilePic ?? null,
    hasProfilePicture: u2.hasProfilePicture ?? false,
    privateAccount: u2.privateAccount ?? false,
    notificationEnabled: u2.notificationEnabled ?? true,
  });
}
