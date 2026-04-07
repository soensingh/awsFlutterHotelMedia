import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../auth/model";
import { getNotificationModel } from "./model";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

/**
 * GET /api/mobile/notifications
 * Query params:
 *   limit   = 20 (max 50)
 *   cursor  = last notification _id for pagination
 * Response: { notifications, hasMore, unseenCount }
 */
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
  const limitParam = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(limitParam, 1), 50);
  const cursor = url.searchParams.get("cursor") ?? null;

  const Notification = await getNotificationModel();
  const User = await getMobileUserModel();

  const userOid = new mongoose.Types.ObjectId(userId);

  // Base filter
  const filter: Record<string, unknown> = {
    userID: userOid,
    isDeleted: false,
  };
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    // Cursor-based pagination: get notifications older than cursor
    filter._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const [docs, unseenCount] = await Promise.all([
    Notification.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean(),
    Notification.countDocuments({ userID: userOid, isDeleted: false, isSeen: false }),
  ]);

  const hasMore = docs.length > limit;
  if (hasMore) docs.pop();

  // Collect unique actor IDs to join profile pics in one query
  const actorIds = [
    ...new Set(
      docs
        .map((d) => d.targetUserID?.toString())
        .filter((id): id is string => !!id && mongoose.Types.ObjectId.isValid(id))
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  type UserLean = { _id: unknown; name?: string; username?: string; profilePic?: { small?: string } };
  const actors: UserLean[] = actorIds.length
    ? await User.find(
        { _id: { $in: actorIds } },
        { _id: 1, name: 1, username: 1, "profilePic.small": 1 }
      ).lean()
    : [];

  const actorMap = new Map<string, UserLean>();
  for (const a of actors) {
    actorMap.set((a._id as mongoose.Types.ObjectId).toString(), a);
  }

  const notifications = docs.map((n) => {
    const actorId = n.targetUserID?.toString() ?? null;
    const actor = actorId ? actorMap.get(actorId) : null;
    return {
      id: (n._id as mongoose.Types.ObjectId).toString(),
      title: n.title,
      description: n.description,
      type: n.type,
      metadata: n.metadata ?? {},
      isSeen: n.isSeen,
      createdAt: (n as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? null,
      actorId: actorId ?? null,
      actorName: actor?.name ?? null,
      actorUsername: actor?.username ?? null,
      actorPicSmall: actor?.profilePic?.small ?? null,
    };
  });

  return corsJson(req, { notifications, hasMore, unseenCount });
}

/**
 * PATCH /api/mobile/notifications
 * Marks all notifications as seen for the current user.
 * Response: { ok: true }
 */
export async function PATCH(req: Request) {
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

  const Notification = await getNotificationModel();
  await Notification.updateMany(
    { userID: new mongoose.Types.ObjectId(userId), isSeen: false },
    { $set: { isSeen: true } }
  );

  return corsJson(req, { ok: true });
}
