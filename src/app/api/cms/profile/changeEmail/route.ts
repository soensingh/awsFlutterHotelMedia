import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await req.json();
  const nextEmail = String(email ?? "").toLowerCase().trim();

  const User = await getCmsUserModel();
  if (!User.validateEmail(nextEmail)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const existing = await User.findOne({ email: nextEmail }).select("_id");
  if (existing && existing._id.toString() !== session.id) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  await User.updateOne(
    { _id: session.id, isSuspended: false },
    {
      $set: {
        email: nextEmail,
      },
    }
  );

  return NextResponse.json({
    success: true,
    user: {
      id: session.id,
      email: nextEmail,
    },
  });
}
