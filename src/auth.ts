import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const TOKEN_PATH = join(process.cwd(), '.token.json');
const REDIRECT_URI = 'http://localhost:8080/oauth/callback';
export const SCOPES = ['https://www.googleapis.com/auth/youtube.readonly'];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    REDIRECT_URI,
  );
}

export async function getAuthClient(): Promise<OAuth2Client> {
  if (!existsSync(TOKEN_PATH)) {
    throw new Error('Not authenticated. Run: npm run setup');
  }

  const client = createOAuthClient();
  const token = JSON.parse(readFileSync(TOKEN_PATH, 'utf-8'));
  client.setCredentials(token);

  // Refresh token if it expires within 60 seconds
  if (token.expiry_date && token.expiry_date < Date.now() + 60_000) {
    const { credentials } = await client.refreshAccessToken();
    writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
    client.setCredentials(credentials);
  }

  return client;
}

export function saveToken(token: object): void {
  writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
}
