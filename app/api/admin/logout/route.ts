import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
} from "../../../../lib/admin-session";

export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/admin-login", request.url),
  );

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    "",
    {
      ...adminCookieOptions(),
      maxAge: 0,
    },
  );

  return response;
}