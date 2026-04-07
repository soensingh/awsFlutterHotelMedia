import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getMobileUserModel } from "../auth/model";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

async function verifyUserId(req: Request): Promise<string | null> {
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

// ── POST /api/mobile/presence  ─ heartbeat (mark online) ─────────────────────
export async function POST(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const User = await getMobileUserModel();
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        isOnline: true,
        // 90-second grace: if no further heartbeat arrives, client is considered offline
        onlineUntil: new Date(Date.now() + 90_000),
      },
    }
  );

  return corsJson(req, { ok: true });
}

// ── DELETE /api/mobile/presence  ─ go offline ────────────────────────────────
export async function DELETE(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const User = await getMobileUserModel();
  await User.updateOne(
    { _id: new mongoose.Types.ObjectId(userId) },
    {
      $set: {
        isOnline: false,
        onlineUntil: null,
        lastSeen: new Date(),
      },
    }
  );

  return corsJson(req, { ok: true });
}

// ── GET /api/mobile/presence?ids=id1,id2,...  ─ batch poll ───────────────────
export async function GET(req: Request) {
  const userId = await verifyUserId(req);
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const rawIds = url.searchParams.get("ids") ?? "";
  const ids = rawIds.split(",").filter(Boolean).slice(0, 50);

  if (ids.length === 0) return corsJson(req, { presence: {} });

  const User = await getMobileUserModel();
  const now = new Date();
  const objectIds = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const users = await User.find(
    { _id: { $in: objectIds } },
    { isOnline: 1, onlineUntil: 1 }
  ).lean();

  const presence: Record<string, boolean> = {};
  for (const u of users) {
    const id = (u._id as mongoose.Types.ObjectId).toString();
    // user is online only if both the flag is set AND the grace window hasn't expired
    presence[id] =
      u.isOnline === true &&
      u.onlineUntil != null &&
      (u.onlineUntil as Date) > now;
  }

  return corsJson(req, { presence }, { headers: { "Cache-Control": "private, no-store" } });
}
