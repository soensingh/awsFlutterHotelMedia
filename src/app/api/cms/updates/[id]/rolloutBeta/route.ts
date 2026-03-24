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

  const updated = await Update.findOneAndUpdate(
    { _id: id, createdBy: session.id },
    {
      $set: {
        betaStatus: "rolled-out",
        betaRolledOutAt: new Date(),
        isInBeta: true,
        status: "rolled-out",
      },
    },
    { new: true }
  );

  if (!updated) {
    return NextResponse.json({ error: "Update not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, update: toApiUpdate(updated) });
}
