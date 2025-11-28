import { OAuth2Client } from "google-auth-library";
import { appConfig } from "../config/app.config";

const client = new OAuth2Client(appConfig.GOOGLE_CLIENT_ID);

export async function verifyGoogleToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: appConfig.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
}
