import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getStoryModel, StoryDoc } from "./models";
import { getUserConnectionModel } from "../connections/models";
import { getMobileUserModel } from "../auth/model";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

async function verifyUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
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

// ── GET /api/mobile/stories ────────────────────────────────────────────────
// Returns stories from users I follow, grouped by user.
// Also includes my own stories (index 0).
export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const myId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  const Story = await getStoryModel();
  const Connection = await getUserConnectionModel();

  // Users I follow (accepted connections where I am the follower)
  const followingDocs = await Connection.find(
    { follower: myId, status: "accepted" },
    { following: 1 }
  ).lean();
  const followingIds = followingDocs.map((c) => c.following as mongoose.Types.ObjectId);

  // Include myself so own stories appear first
  const authorIds = [myId, ...followingIds];

  // Active, non-deleted stories from those authors
  const stories = await Story.find({
    userID: { $in: authorIds },
    expiresAt: { $gt: now },
    isDeleted: false,
  })
    .sort({ userID: 1, createdAt: 1 })
    .lean();

  if (stories.length === 0) return corsJson(req, { groups: [] });

  // Fetch author profiles in one query
  const uniqueAuthorIds = [...new Set(stories.map((s) => (s.userID as mongoose.Types.ObjectId).toString()))];
  const User = await getMobileUserModel();
  const users = await User.find(
    { _id: { $in: uniqueAuthorIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { name: 1, username: 1, profilePic: 1 }
  ).lean();
  const userMap = Object.fromEntries(users.map((u) => [
    (u._id as mongoose.Types.ObjectId).toString(),
    u,
  ]));

  // Group stories by author
  const groupMap = new Map<string, { user: unknown; stories: unknown[]; hasUnseen: boolean }>();

  for (const s of stories) {
    const authorId = (s.userID as mongoose.Types.ObjectId).toString();
    if (!groupMap.has(authorId)) {
      const u = userMap[authorId];
      groupMap.set(authorId, {
        user: {
          id: authorId,
          name: (u as { name?: string })?.name ?? "",
          username: (u as { username?: string })?.username ?? "",
          profilePicSmall: ((u as { profilePic?: { small?: string } })?.profilePic?.small) ?? "",
        },
        stories: [],
        hasUnseen: false,
      });
    }
    const group = groupMap.get(authorId)!;
    const isViewed = (s.viewedBy as unknown[]).some(
      (v) => v?.toString() === userId
    );
    if (!isViewed) group.hasUnseen = true;
    (group.stories as unknown[]).push({
      id: (s._id as mongoose.Types.ObjectId).toString(),
      mediaUrl: s.mediaUrl,
      mediaType: s.mediaType,
      thumbnail: s.thumbnail,
      caption: s.caption,
      isViewed,
      createdAt: s.createdAt,
    });
  }

  // Own stories always first, then chronological by first story time
  const groups = [...groupMap.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => (a.id === userId ? -1 : b.id === userId ? 1 : 0));

  return corsJson(req, { groups });
}

// ── POST /api/mobile/stories ───────────────────────────────────────────────
// Body: { mediaUrl, mediaType?, caption?, thumbnail?, mentions? }
export async function POST(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let body: {
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    thumbnail?: string;
    mentions?: { userId: string; username: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return corsJson(req, { error: "Invalid JSON" }, { status: 400 });
  }

  const { mediaUrl, mediaType = "image", caption = "", thumbnail = "", mentions = [] } = body;
  if (!mediaUrl) return corsJson(req, { error: "mediaUrl required" }, { status: 400 });

  const Story = await getStoryModel();
  const authorId  = new mongoose.Types.ObjectId(userId);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

  const mentionsNorm = (mentions ?? []).map((m) => ({
    userId: new mongoose.Types.ObjectId(m.userId),
    username: m.username ?? "",
  }));

  const story = (await Story.create({
    userID: authorId,
    mediaUrl,
    mediaType,
    caption,
    thumbnail,
    expiresAt,
    viewedBy: [],
    isDeleted: false,
    mentions: mentionsNorm,
  })) as StoryDoc;

  // Notifications for mentioned users
  if (mentionsNorm.length > 0) {
    try {
      const { getNotificationModel } = await import("../notifications/model");
      const { getMobileUserModel } = await import("../auth/model");
      const Notification = await getNotificationModel();
      const User = await getMobileUserModel();
      const author = await User.findById(authorId, { username: 1 }).lean();
      const authorUsername = (author as { username?: string })?.username ?? "someone";
      await Notification.insertMany(
        mentionsNorm.map((m) => ({
          userID:       m.userId,
          targetUserID: authorId,
          title:        "You were mentioned",
          description:  `@${authorUsername} mentioned you in a story`,
          type:         "mention",
          metadata:     { storyId: (story._id as mongoose.Types.ObjectId).toString() },
          isSeen:       false,
          isDeleted:    false,
        }))
      );
    } catch (e) {
      console.error("Story mention notification error:", e);
    }
  }

  return corsJson(req, {
    story: {
      id: (story._id as mongoose.Types.ObjectId).toString(),
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      expiresAt: story.expiresAt,
    },
  });
}
