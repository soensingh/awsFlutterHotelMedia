import "server-only";

import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { env } from "@/lib/config/env";
import { getCmsUserModel } from "@/app/api/cms/auth/model";

type CmsSession = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type CmsJwtPayload = jwt.JwtPayload & {
  sub?: string;
  sid?: string;
};

export async function getCmsSession(): Promise<CmsSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(env.JWT_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    }) as CmsJwtPayload;

    if (!payload.sub || !payload.sid) {
      return null;
    }

    const User = await getCmsUserModel();
    const user = await User.findOne({
      _id: payload.sub,
      sessionTokenId: payload.sid,
      isSuspended: false,
    }).select("_id name email role");

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}
