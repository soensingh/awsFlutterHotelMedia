import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  const current = String(currentPassword ?? "");
  const next = String(newPassword ?? "");

  const User = await getCmsUserModel();
  if (!User.validatePassword(next)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const user = await User.findOne({ _id: session.id, isSuspended: false });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const validCurrent = await user.comparePassword(current);
  if (!validCurrent) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const hashed = await User.hashPassword(next);
  const updateResult = await User.updateOne(
    { _id: session.id },
    {
      $set: {
        password: hashed,
      },
    }
  );

  if (!updateResult.matchedCount) {
    return NextResponse.json({ error: "Password update failed" }, { status: 500 });
  }

  const updatedUser = await User.findById(session.id);
  if (!updatedUser) {
    return NextResponse.json({ error: "Password update failed" }, { status: 500 });
  }

  const verifyNewPassword = await updatedUser.comparePassword(next);
  if (!verifyNewPassword) {
    return NextResponse.json({ error: "Password update verification failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
