import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  const nextName = String(name ?? "").trim();

  if (nextName.length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
  }

  const User = await getCmsUserModel();
  await User.updateOne(
    { _id: session.id, isSuspended: false },
    {
      $set: {
        name: nextName,
      },
    }
  );

  return NextResponse.json({
    success: true,
    user: {
      id: session.id,
      name: nextName,
    },
  });
}
