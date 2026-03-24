import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

export const runtime = "nodejs";

const ALLOWED_TIMEZONES = new Set([
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
]);

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { timeZone } = await req.json();
  const nextTimeZone = String(timeZone ?? "").trim();

  if (!ALLOWED_TIMEZONES.has(nextTimeZone)) {
    return NextResponse.json({ error: "Invalid time zone" }, { status: 400 });
  }

  const User = await getCmsUserModel();
  await User.updateOne(
    { _id: session.id, isSuspended: false },
    {
      $set: {
        timeZone: nextTimeZone,
      },
    }
  );

  return NextResponse.json({
    success: true,
    user: {
      id: session.id,
      timeZone: nextTimeZone,
    },
  });
}
