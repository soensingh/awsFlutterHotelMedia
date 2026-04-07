import jwt, { type Secret } from "jsonwebtoken";
import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// POST /api/mobile/auth/change-password
// Headers: Authorization: Bearer <token>
// Body:    { currentPassword: string, newPassword: string }
// Returns: { success: true }
export async function POST(req: Request) {
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

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = (await req.json()) as { currentPassword?: string; newPassword?: string };
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }

  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== "string" || currentPassword.trim() === "") {
    return corsJson(req, { error: "Current password is required" }, { status: 400 });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return corsJson(req, { error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const user = await User.findById(userId);

  if (!user || user.isDeleted) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  const isMatch = await (user as unknown as { comparePassword: (p: string) => Promise<boolean> }).comparePassword(currentPassword);
  if (!isMatch) {
    return corsJson(req, { error: "Current password is incorrect" }, { status: 400 });
  }

  const hashed = await (User as unknown as { hashPassword: (p: string) => Promise<string> }).hashPassword(newPassword);
  user.password = hashed as unknown as typeof user.password;
  await (user as unknown as { save: () => Promise<void> }).save();

  return corsJson(req, { success: true });
}
