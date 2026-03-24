import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUpdateModel } from "./model";
import { toApiUpdate } from "./serializers";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const Update = await getCmsUpdateModel();
  const updates = await Update.find({ createdBy: session.id })
    .sort({ updatedAt: -1 })
    .select("_id name description status isRolledOut isInBeta updatedAt betaStatus betaRolledOutAt liveStatus liveRolledOutAt")
    .lean();

  const data = updates.map((item) => toApiUpdate(item));

  return NextResponse.json({ updates: data });
}

export async function POST(req: Request) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, description } = await req.json();

  const nextName = String(name ?? "").trim();
  const nextDescription = String(description ?? "").trim();

  if (nextName.length < 3) {
    return NextResponse.json({ error: "Update name must be at least 3 characters" }, { status: 400 });
  }

  const Update = await getCmsUpdateModel();
  const created = await Update.create({
    name: nextName,
    description: nextDescription,
    isInBeta: true,
    isRolledOut: false,
    status: "draft",
    betaStatus: "draft",
    betaRolledOutAt: null,
    liveStatus: "draft",
    liveRolledOutAt: null,
    createdBy: session.id,
  });

  return NextResponse.json(
    {
      success: true,
      update: toApiUpdate(created),
    },
    { status: 201 }
  );
}
