import { getMobileUserModel } from "../model";
import { corsJson, corsOptions } from "../cors";

export const runtime = "nodejs";

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// Dev-only endpoint: sets a fixed OTP (123456) in MongoDB WITHOUT sending SMS.
// Returns 403 in production. Use with the in-app bypass button (kDebugMode).
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return corsJson(req, { error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json();
  const dialCode = String(body.dialCode ?? "").trim();
  const phoneNumber = String(body.phoneNumber ?? "").trim();

  if (!dialCode || !phoneNumber) {
    return corsJson(req, { error: "dialCode and phoneNumber are required" }, { status: 400 });
  }

  const User = await getMobileUserModel();
  const user = await User.findOne({ dialCode, phoneNumber });

  if (!user || user.isDeleted) {
    return corsJson(req, { error: "User not found" }, { status: 404 });
  }

  const DEV_OTP = "123456";
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        otp: DEV_OTP,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    }
  );

  return corsJson(req, { message: "Dev OTP set", otp: DEV_OTP });
}
