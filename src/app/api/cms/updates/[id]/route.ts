import { NextResponse } from "next/server";
import { getCmsSession } from "@/lib/cms/session";
import { getCmsUpdateModel } from "../model";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getCmsSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const Update = await getCmsUpdateModel();

  try {
    const deleted = await Update.findOneAndDelete({ _id: id, createdBy: session.id }).select("_id");

    if (!deleted) {
      return NextResponse.json({ error: "Update not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ error: "Invalid update id" }, { status: 400 });
  }
}