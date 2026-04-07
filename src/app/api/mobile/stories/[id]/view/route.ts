import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import { getStoryModel } from "../../models";
import { corsJson, corsOptions } from "../../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// POST /api/mobile/stories/[id]/view — mark a story as viewed
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  let userId: string | null = null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    userId = (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? null;
  } catch {
    return corsJson(req, { error: "Invalid token" }, { status: 401 });
  }
  if (!userId) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

  const { id: storyId } = await params;
  if (!mongoose.isValidObjectId(storyId)) {
    return corsJson(req, { error: "Invalid story ID" }, { status: 400 });
  }

  const Story = await getStoryModel();
  await Story.updateOne(
    { _id: new mongoose.Types.ObjectId(storyId) },
    { $addToSet: { viewedBy: new mongoose.Types.ObjectId(userId) } }
  );

  return corsJson(req, { ok: true });
}
