import 'dotenv/config';
import { createServer } from 'http';
import { parse } from 'url';
import open from 'open';
import { createOAuthClient, saveToken, SCOPES } from './auth.js';

async function setup() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in .env');
    process.exit(1);
  }

  const client = createOAuthClient();
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // force refresh token to be returned
  });

  console.log('\nOpening browser for YouTube authorization...');
  console.log('If the browser does not open, visit this URL:\n');
  console.log(authUrl, '\n');

  await open(authUrl);

  await new Promise<void>((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const { query } = parse(req.url!, true);

      if (!query.code) {
        res.writeHead(400);
        res.end('Missing authorization code');
        return;
      }

      try {
        const { tokens } = await client.getToken(query.code as string);
        saveToken(tokens);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family:sans-serif;max-width:400px;margin:80px auto;text-align:center;">
            <h2>✓ Authorization successful!</h2>
            <p>You can close this tab and return to the terminal.</p>
          </body></html>
        `);
        console.log('Authorization successful! Token saved to .token.json');
        server.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    });

    server.listen(8080, () =>
      console.log('Waiting for OAuth callback on http://localhost:8080 ...'),
    );

    server.on('error', reject);
  });

  console.log('\nSetup complete. Run the digest with: npm run digest\n');
}

setup().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
