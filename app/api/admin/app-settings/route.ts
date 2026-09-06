import { NextRequest, NextResponse } from "next/server";
import { getAdminApiUser } from "../../../admin-access";
import {
  readAppSettings,
  updateAppSettings,
} from "../../../../lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminApiUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Accès administrateur requis." },
      { status: 403 },
    );
  }

  try {
    const settings = await readAppSettings();

    return NextResponse.json({
      settings,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Impossible de charger les paramètres de l’application.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const admin = await getAdminApiUser();

  if (!admin) {
    return NextResponse.json(
      { error: "Accès administrateur requis." },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();

    const settings = await updateAppSettings(body);

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          "Impossible d’enregistrer les paramètres.",
      },
      { status: 500 },
    );
  }
}