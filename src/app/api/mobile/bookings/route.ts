import jwt, { type Secret } from "jsonwebtoken";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "@/lib/config/db";
import { corsJson, corsOptions } from "../auth/cors";
import { env } from "@/lib/config/env";

export const runtime = "nodejs";

// ── Booking model ─────────────────────────────────────────────────────────────

const bookingSchema = new Schema(
  {
    status: { type: String, default: "pending" },
    adults: { type: Number, default: 0 },
    children: { type: Number, default: 0 },
    childrenAge: { type: [Schema.Types.Mixed], default: [] },
    isTravellingWithPet: { type: Boolean, default: false },
    bookedFor: { type: String, default: "myself" },
    subTotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    convinceCharge: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    type: { type: String, default: "" },
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    guestDetails: { type: [Schema.Types.Mixed], default: [] },
    bookingID: { type: String, default: "" },
    userID: { type: Schema.Types.ObjectId, required: true },
    businessProfileID: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "bookings" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBookingModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (
    (db.models.Booking as Model<any>) || db.model("Booking", bookingSchema)
  );
}

// ── Business profile model (for name lookup) ──────────────────────────────────

const businessProfileSchema = new Schema(
  { businessName: String, name: String },
  { strict: false, collection: "businessprofiles" }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getBusinessProfileModel(): Promise<Model<any>> {
  const db = await connectDB("main");
  return (
    (db.models.BusinessProfile as Model<any>) ||
    db.model("BusinessProfile", businessProfileSchema)
  );
}

// ── Auth helper ───────────────────────────────────────────────────────────────

function verifyToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET_MOBILE as Secret, {
      issuer: env.JWT_ISSUER_MOBILE,
      audience: env.JWT_AUDIENCE_MOBILE,
    }) as jwt.JwtPayload;
    return (decoded.sub ?? decoded.id ?? decoded.userId)?.toString() ?? null;
  } catch {
    return null;
  }
}

// ── CORS preflight ────────────────────────────────────────────────────────────

export async function OPTIONS(req: Request) {
  return corsOptions(req);
}

// ── GET /api/mobile/bookings ──────────────────────────────────────────────────
// Query:    ?limit=20&cursor=<lastBookingId>
// Response: { bookings: [...], hasMore: boolean }

export async function GET(req: Request) {
  const userId = verifyToken(req);
  if (!userId) {
    return corsJson(req, { error: "Unauthorized" }, { status: 401 });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return corsJson(req, { error: "Invalid userId" }, { status: 400 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 50);
  const cursor = url.searchParams.get("cursor");

  const myId = new mongoose.Types.ObjectId(userId);
  const Booking = await getBookingModel();
  const BusinessProfile = await getBusinessProfileModel();

  interface BookingDoc {
    _id: mongoose.Types.ObjectId;
    status: string;
    adults: number;
    children: number;
    isTravellingWithPet: boolean;
    bookedFor: string;
    subTotal: number;
    discount: number;
    tax: number;
    convinceCharge: number;
    grandTotal: number;
    type: string;
    checkIn: Date | null;
    checkOut: Date | null;
    bookingID: string;
    businessProfileID: mongoose.Types.ObjectId | null;
    createdAt: Date;
  }

  const query: Record<string, unknown> = { userID: myId };
  if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const docs = await Booking.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<BookingDoc[]>();

  const hasMore = docs.length > limit;
  const slice = hasMore ? docs.slice(0, limit) : docs;

  if (slice.length === 0) {
    return corsJson(req, { bookings: [], hasMore: false });
  }

  // Collect unique businessProfileIDs for name lookup
  const bizIds = [
    ...new Set(
      slice
        .map((d) => d.businessProfileID?.toString())
        .filter((id): id is string => !!id)
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const bizProfiles =
    bizIds.length > 0
      ? await BusinessProfile.find({ _id: { $in: bizIds } })
          .select("_id businessName name")
          .lean<{
            _id: mongoose.Types.ObjectId;
            businessName?: string;
            name?: string;
          }[]>()
      : [];

  const bizMap = new Map(
    bizProfiles.map((b) => [
      b._id.toString(),
      b.businessName ?? b.name ?? null,
    ])
  );

  const bookings = slice.map((doc) => ({
    id: doc._id.toString(),
    bookingId: doc.bookingID,
    status: doc.status,
    type: doc.type,
    checkIn: doc.checkIn ?? null,
    checkOut: doc.checkOut ?? null,
    adults: doc.adults,
    children: doc.children,
    grandTotal: doc.grandTotal,
    subTotal: doc.subTotal,
    discount: doc.discount,
    tax: doc.tax,
    convinceCharge: doc.convinceCharge,
    isTravellingWithPet: doc.isTravellingWithPet,
    bookedFor: doc.bookedFor,
    businessName: doc.businessProfileID
      ? (bizMap.get(doc.businessProfileID.toString()) ?? null)
      : null,
    createdAt: doc.createdAt,
  }));

  return corsJson(req, {
    bookings,
    hasMore,
    nextCursor: hasMore ? slice[slice.length - 1]._id.toString() : null,
  });
}
