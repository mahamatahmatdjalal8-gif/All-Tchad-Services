import { NextResponse } from "next/server";
import {
  defaultAppSettings,
  readAppSettings,
} from "../../../lib/app-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await readAppSettings();

    return NextResponse.json({
      settings,
    });
  } catch (error) {
    console.error("Lecture configuration :", error);

    return NextResponse.json({
      settings: defaultAppSettings,
    });
  }
}