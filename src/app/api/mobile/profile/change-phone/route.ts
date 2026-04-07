import jwt, { type Secret } from "jsonwebtoken";
import { getFirebaseAdmin } from "@/lib/config/firebase-admin";
import { getMobileUserModel } from "../../auth/model";
import { corsJson, corsOptions } from "../../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// POST /api/mobile/profile/change-phone
// Auth:   Authorization: Bearer <appJwt>
// Body:   { newPhone: string, dialCode: string, firebaseIdToken: string }
// Rules:  Firebase OTP must have been sent to the NEW number; max 1 change per 60 days
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
  let body: { newPhone?: string; dialCode?: string; firebaseIdToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return corsJson(req, { error: "Invalid JSON body" }, { status: 400 });
  }

  const { newPhone, dialCode, firebaseIdToken } = body;

  if (typeof newPhone !== "string" || newPhone.trim() === "") {
    return corsJson(req, { error: "newPhone is required" }, { status: 400 });
  }
  if (typeof dialCode !== "string" || dialCode.trim() === "") {
    return corsJson(req, { error: "dialCode is required" }, { status: 400 });
  }
  if (typeof firebaseIdToken !== "string" || !firebaseIdToken.trim()) {
    return corsJson(req, { error: "firebaseIdToken is required" }, { status: 400 });
  }

  const dialCodeClean = dialCode.trim().replace(/^\+/, "");
  const newPhoneClean = newPhone.trim();
  const requestedFull = `+${dialCodeClean}${newPhoneClean}`;

  // 3. Verify Firebase ID token — phone_number must equal the requested new number
  let decodedFirebase: { phone_number?: string; uid: string };
  try {
    const firebaseApp = getFirebaseAdmin();
    decodedFirebase = (await firebaseApp.auth().verifyIdToken(firebaseIdToken)) as typeof decodedFirebase;
  } catch {
    return corsJson(req, { error: "Invalid Firebase token" }, { status: 401 });
  }

  const firebasePhone = decodedFirebase.phone_number ?? "";
  if (firebasePhone !== requestedFull) {
    return corsJson(req, { error: "Phone verification failed — token does not match the submitted number" }, { status: 401 });
  }

  // 4. Load current user
  const User = await getMobileUserModel();
  const user = await User.findById(userId).lean();
  if (!user || user.isDeleted) return corsJson(req, { error: "User not found" }, { status: 404 });

  // 5. Check 60-day cooldown
  const u = user as typeof user & { lastPhoneChange?: Date | null };
  if (u.lastPhoneChange) {
    const elapsed = Date.now() - new Date(u.lastPhoneChange).getTime();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    if (elapsed < sixtyDays) {
      const nextAllowed = new Date(new Date(u.lastPhoneChange).getTime() + sixtyDays).toISOString();
      return corsJson(req, { error: "Phone number can only be changed once every 60 days", nextAllowed }, { status: 429 });
    }
  }

  // 6. Check new number not already registered to another account
  const allUsers = await User.find({ isDeleted: false }).lean();
  const conflict = allUsers.find((other) => {
    if (String(other._id) === userId) return false;
    const full = `${other.dialCode}${other.phoneNumber}`;
    return full === `${dialCodeClean}${newPhoneClean}` || `+${full}` === requestedFull;
  });
  if (conflict) {
    return corsJson(req, { error: "Phone number already registered" }, { status: 409 });
  }

  // 7. Update
  await User.findByIdAndUpdate(userId, {
    $set: { dialCode: dialCodeClean, phoneNumber: newPhoneClean, lastPhoneChange: new Date() },
  });

  return corsJson(req, { success: true });
}
