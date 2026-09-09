import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  isAdminEmail,
} from "../../../admin-access";

import {
  ADMIN_SESSION_COOKIE,
  adminCookieOptions,
  createAdminSessionToken,
  verifyAdminPassword,
} from "../../../../lib/admin-session";

export const runtime = "nodejs";

function forbiddenRequest() {
  return NextResponse.json(
    {
      error: "Requête refusée.",
    },
    {
      status: 403,
    },
  );
}

export async function POST(
  request: NextRequest,
) {
  try {
    const origin =
      request.headers.get("origin");

    if (
      origin &&
      origin !== request.nextUrl.origin
    ) {
      return forbiddenRequest();
    }

    const fetchSite =
      request.headers.get(
        "sec-fetch-site",
      );

    if (
      fetchSite &&
      fetchSite !== "same-origin"
    ) {
      return forbiddenRequest();
    }

    const body =
      await request.json() as {
        email?: unknown;
        password?: unknown;
      };

    const email =
      typeof body.email === "string"
        ? body.email
            .trim()
            .toLowerCase()
            .slice(0, 200)
        : "";

    const password =
      typeof body.password === "string"
        ? body.password.slice(0, 256)
        : "";

    const passwordOk =
      verifyAdminPassword(password);

    const emailOk =
      Boolean(email) &&
      isAdminEmail(email);

    if (
      !email ||
      !password ||
      !emailOk ||
      !passwordOk
    ) {
      return NextResponse.json(
        {
          error:
            "Email ou mot de passe incorrect.",
        },
        {
          status: 401,
        },
      );
    }

    const token =
      createAdminSessionToken(email);

    const response =
      NextResponse.json({
        success: true,
      });

    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      token,
      adminCookieOptions(),
    );

    return response;
  } catch (error) {
    console.error(
      "Connexion administrateur :",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Connexion administrateur momentanément indisponible.",
      },
      {
        status: 500,
      },
    );
  }
}