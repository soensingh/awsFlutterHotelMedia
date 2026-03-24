import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUpdateModel } from "../../model";
import { toApiUpdate } from "../../serializers";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_req: Request, context: RouteContext) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const Update = await getCmsUpdateModel();

  const updateDoc = await Update.findOne({ _id: id, createdBy: session.id });
  if (!updateDoc) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  const betaReady = updateDoc.betaStatus === "rolled-out";
  if (!betaReady) {
    return NextResponse.json({ error: "Roll out beta first" }, { status: 400 });
  }

  if (updateDoc.liveStatus === "rolled-out") {
    return NextResponse.json({ error: "Update already rolled out" }, { status: 400 });
  }

  updateDoc.liveStatus = "rolled-out";
  updateDoc.liveRolledOutAt = new Date();
  updateDoc.isRolledOut = true;
  updateDoc.isInBeta = false;
  updateDoc.status = "rolled-out";

  await updateDoc.save();

  return NextResponse.json({ success: true, update: toApiUpdate(updateDoc) });
}
