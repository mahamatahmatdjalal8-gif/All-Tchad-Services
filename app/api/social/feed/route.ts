import { getPublicSocialData } from "../../../social-data";

export async function GET() {
  return Response.json(await getPublicSocialData());
}
