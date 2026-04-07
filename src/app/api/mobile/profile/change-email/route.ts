import jwt, { type Secret } from "jsonwebtoken";
import { getFirebaseAdmin } from "@/lib/config/firebase-admin";
import { getMobileUserModel } from "../../auth/model";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// POST /api/mobile/profile/change-email
// Auth:   Authorization: Bearer <appJwt>
// Body:   { newEmail: string, firebaseIdToken: string }
// Rules:  OTP must have been sent to current phone; max 1 change per 30 days
export async function POST(req: Request) {
  // 1. Verify app JWT
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return corsJson(req, { error: "Unauthorized" }, { status: 401 });

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
  if (!userId) return corsJson(req, { error: "Invalid token payload" }, { status: 401 });

  // 2. Parse body
  let body: { newEmail?: string; firebaseIdToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }

  const { newEmail, firebaseIdToken } = body;

  if (typeof newEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
    return corsJson(req, { error: "Invalid email address" }, { status: 400 });
  }
  if (typeof firebaseIdToken !== "string" || !firebaseIdToken.trim()) {
    return corsJson(req, { error: "firebaseIdToken is required" }, { status: 400 });
  }

  // 3. Verify Firebase ID token
  let decodedFirebase: { phone_number?: string; uid: string };
  try {
    const firebaseApp = getFirebaseAdmin();
    decodedFirebase = (await firebaseApp.auth().verifyIdToken(firebaseIdToken)) as typeof decodedFirebase;
  } catch {
    return corsJson(req, { error: "Invalid Firebase token" }, { status: 401 });
  }

  // 4. Confirm Firebase phone matches this user's current registered phone
  const User = await getMobileUserModel();
  const user = await User.findById(userId).lean();
  if (!user || user.isDeleted) return corsJson(req, { error: "User not found" }, { status: 404 });

  const firebasePhone = decodedFirebase.phone_number ?? "";
  const userFullPhone = `+${user.dialCode}${user.phoneNumber}`;
  if (firebasePhone !== userFullPhone) {
    return corsJson(req, { error: "Phone verification failed" }, { status: 401 });
  }

  // 5. Check 30-day cooldown
  const u = user as typeof user & { lastEmailChange?: Date | null };
  if (u.lastEmailChange) {
    const elapsed = Date.now() - new Date(u.lastEmailChange).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (elapsed < thirtyDays) {
      const nextAllowed = new Date(new Date(u.lastEmailChange).getTime() + thirtyDays).toISOString();
      return corsJson(req, { error: "Email can only be changed once every 30 days", nextAllowed }, { status: 429 });
    }
  }

  // 6. Check new email not already in use by another account
  const normalised = newEmail.trim().toLowerCase();
  const conflict = await User.findOne({ email: normalised, isDeleted: false }).lean();
  if (conflict && String(conflict._id) !== userId) {
    return corsJson(req, { error: "Email already in use" }, { status: 409 });
  }

  // 7. Update
  await User.findByIdAndUpdate(userId, { $set: { email: normalised, lastEmailChange: new Date() } });

  return corsJson(req, { success: true });
}
