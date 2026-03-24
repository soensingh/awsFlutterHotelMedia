import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

export const runtime = "nodejs";

const ALLOWED_LOCALES = new Set(["en", "hi", "ar"]);

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locale } = await req.json();
  const nextLocale = String(locale ?? "").trim();

  if (!ALLOWED_LOCALES.has(nextLocale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const User = await getCmsUserModel();
  await User.updateOne(
    { _id: session.id, isSuspended: false },
    {
      $set: {
        locale: nextLocale,
      },
    }
  );

  return NextResponse.json({
    success: true,
    user: {
      id: session.id,
      locale: nextLocale,
    },
  });
}
