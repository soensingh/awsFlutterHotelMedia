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

  if (updateDoc.liveStatus === "rolled-out") {
    updateDoc.liveStatus = "rolled-back";
    updateDoc.isRolledOut = false;
    updateDoc.isInBeta = true;
    updateDoc.status = "draft";
    await updateDoc.save();
    return NextResponse.json({ success: true, target: "update", update: toApiUpdate(updateDoc) });
  }

  const betaReady = updateDoc.betaStatus === "rolled-out";
  if (!betaReady) {
    return NextResponse.json({ error: "Nothing to rollback" }, { status: 400 });
  }

  updateDoc.betaStatus = "rolled-back";
  updateDoc.betaRolledOutAt = null;
  updateDoc.isInBeta = true;
  updateDoc.status = "draft";
  await updateDoc.save();

  return NextResponse.json({ success: true, target: "beta", update: toApiUpdate(updateDoc) });
}
